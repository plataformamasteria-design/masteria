// Package store handles PostgreSQL connections for both whatsmeow's internal
// device store and the shared application database used by MasterIA.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lib/pq"
	"github.com/rs/zerolog/log"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"google.golang.org/protobuf/proto"
)

// DB holds the shared application database connection.
var DB *sql.DB

// Container holds the whatsmeow sqlstore container for device management.
var Container *sqlstore.Container

// DeviceJIDColumn is the name of the column storing the JID (jid or our_jid)
var DeviceJIDColumn = "jid"



// Init opens and configures both the whatsmeow device store and the
// shared application database connection.
func Init(databaseURL string) error {
	var err error

	// Open the database connection
	DB, err = sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	DB.SetMaxOpenConns(15)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(30 * time.Minute)
	DB.SetConnMaxIdleTime(5 * time.Minute)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := DB.PingContext(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Info().Msg("📦 Database connection established")

	// Set PostgreSQL array wrapper for whatsmeow
	sqlstore.PostgresArrayWrapper = pq.Array

	// Initialize whatsmeow device store using the same DB connection
	Container = sqlstore.NewWithDB(DB, "postgres", nil)

	// Configure WhatsApp Device Properties globally (Once on startup)
	store.DeviceProps.Os = proto.String("Master IA")
	store.DeviceProps.PlatformType = waProto.DeviceProps_CHROME.Enum()
	store.DeviceProps.RequireFullSync = proto.Bool(false)

	// Run whatsmeow schema migrations (creates whatsmeow_* tables)
	if err := Container.Upgrade(context.Background()); err != nil {
		return fmt.Errorf("failed to upgrade whatsmeow schema: %w", err)
	}

	log.Info().Msg("✅ WhatsMeow device store initialized (schema upgraded)")

	// ✅ CRITICAL PATCH: Fix WhatsMeow foreign keys to allow cascading deletes!
	// Strategy: Query pg_constraint to find ALL FK constraints referencing whatsmeow_device,
	// drop them, then re-add with ON DELETE CASCADE. This handles any constraint naming scheme.
	
	// First, detect the primary key column of whatsmeow_device
	var deviceCol string
	err = DB.QueryRow(`
		SELECT a.attname
		FROM   pg_index i
		JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		WHERE  i.indrelid = 'whatsmeow_device'::regclass
		AND    i.indisprimary
		LIMIT 1;
	`).Scan(&deviceCol)
	
	if err == nil && deviceCol != "" {
		DeviceJIDColumn = deviceCol
		log.Info().Str("column", deviceCol).Msg("Detected WhatsMeow device primary key column")
		
		// Find ALL existing FK constraints that reference whatsmeow_device
		rows, qErr := DB.Query(`
			SELECT 
				tc.table_name, 
				tc.constraint_name,
				kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu 
				ON tc.constraint_name = kcu.constraint_name 
				AND tc.table_schema = kcu.table_schema
			JOIN information_schema.referential_constraints rc 
				ON tc.constraint_name = rc.constraint_name
			JOIN information_schema.constraint_column_usage ccu 
				ON rc.unique_constraint_name = ccu.constraint_name
			WHERE tc.constraint_type = 'FOREIGN KEY'
			AND ccu.table_name = 'whatsmeow_device'
			AND tc.table_schema = 'public';
		`)
		
		if qErr == nil {
			defer rows.Close()
			type fkInfo struct {
				Table      string
				Constraint string
				Column     string
			}
			var fks []fkInfo
			for rows.Next() {
				var fk fkInfo
				if scanErr := rows.Scan(&fk.Table, &fk.Constraint, &fk.Column); scanErr == nil {
					fks = append(fks, fk)
				}
			}
			
			for _, fk := range fks {
				// Drop the existing constraint (whatever its name is)
				dropQ := fmt.Sprintf(`ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s`, fk.Table, fk.Constraint)
				if _, e := DB.Exec(dropQ); e != nil {
					log.Warn().Err(e).Str("table", fk.Table).Str("constraint", fk.Constraint).Msg("Failed to drop FK")
				}
				// Re-add with CASCADE
				addQ := fmt.Sprintf(`ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES whatsmeow_device(%s) ON DELETE CASCADE`,
					fk.Table, fk.Constraint, fk.Column, deviceCol)
				if _, e := DB.Exec(addQ); e != nil {
					log.Warn().Err(e).Str("table", fk.Table).Str("constraint", fk.Constraint).Msg("Failed to add CASCADE FK")
				} else {
					log.Info().Str("table", fk.Table).Str("constraint", fk.Constraint).Msg("✅ Patched FK to CASCADE")
				}
			}
			log.Info().Int("count", len(fks)).Msg("✅ WhatsMeow FK cascade patch complete")
		} else {
			log.Warn().Err(qErr).Msg("Failed to query existing FK constraints")
		}
	} else {
		log.Warn().Err(err).Msg("Failed to detect WhatsMeow device primary key column; skipping FK patch")
	}

	// Start internal GC
	go StartDeviceGC()

	return nil
}

// Close closes the database connection.
func Close() {
	if DB != nil {
		DB.Close()
		log.Info().Msg("Database connection closed")
	}
}

// GetDeviceForSession retrieves or creates a device store entry for a given connection ID.
// Uses the JID association table to map connection IDs to whatsmeow device IDs.
func GetDeviceForSession(connectionID string) (*store.Device, error) {
	// Try to find an existing device linked to this connection
	device, err := findDeviceByConnectionID(connectionID)
	if err != nil {
		return nil, err
	}

	if device != nil {
		log.Info().Str("connectionId", connectionID).Msg("Found existing device for session")
		return device, nil
	}

	// No existing device — create a new one
	device = Container.NewDevice()
	log.Info().Str("connectionId", connectionID).Msg("Created new device for session")

	return device, nil
}

// findDeviceByConnectionID looks up a device via the mapping table.
func findDeviceByConnectionID(connectionID string) (*store.Device, error) {
	// Check mapping table
	var deviceJID string
	err := DB.QueryRow(
		`SELECT device_jid FROM whatsmeow_device_connection_map WHERE connection_id = $1`,
		connectionID,
	).Scan(&deviceJID)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("error querying device map: %w", err)
	}

	// Find device in whatsmeow store by JID
	devices, err := Container.GetAllDevices(context.Background())
	if err != nil {
		return nil, fmt.Errorf("error getting devices: %w", err)
	}

	for _, dev := range devices {
		if dev.ID != nil && dev.ID.String() == deviceJID {
			return dev, nil
		}
	}

	// Mapping exists but device was cleaned up
	_, _ = DB.Exec(`DELETE FROM whatsmeow_device_connection_map WHERE connection_id = $1`, connectionID)
	return nil, nil
}

// SaveDeviceMapping stores the association between a connection ID and a whatsmeow device JID.
func SaveDeviceMapping(connectionID string, deviceJID string) error {
	_, err := DB.Exec(`
		INSERT INTO whatsmeow_device_connection_map (connection_id, device_jid, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (connection_id)
		DO UPDATE SET device_jid = $2, updated_at = NOW()
	`, connectionID, deviceJID)
	return err
}

// DeleteDeviceMapping removes the connection-to-device association.
func DeleteDeviceMapping(connectionID string) error {
	_, err := DB.Exec(`DELETE FROM whatsmeow_device_connection_map WHERE connection_id = $1`, connectionID)
	return err
}

// EnsureMappingTable creates the connection-to-device mapping table if it doesn't exist.
func EnsureMappingTable() error {
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS whatsmeow_device_connection_map (
			connection_id TEXT PRIMARY KEY,
			device_jid TEXT NOT NULL,
			updated_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create mapping table: %w", err)
	}
	log.Info().Msg("✅ Device-connection mapping table ensured")
	return nil
}

// StartDeviceGC periodically purges unlinked or failed pairing devices.
func StartDeviceGC() {
	ticker := time.NewTicker(10 * time.Minute)
	// We wait 10 mins before first run
	for range ticker.C {
		// WhatsMeow adds devices without JID until QR is paired.
		// We only delete those that are not linked in the connection map within the last hour.
		query := fmt.Sprintf(`
			DELETE FROM whatsmeow_device 
			WHERE (%s IS NULL OR %s = '')
			AND %s NOT IN (
				SELECT device_jid FROM whatsmeow_device_connection_map 
				WHERE updated_at >= NOW() - INTERVAL '1 hour'
			)
		`, DeviceJIDColumn, DeviceJIDColumn, DeviceJIDColumn)
		
		res, err := DB.Exec(query)
		if err == nil {
			rows, _ := res.RowsAffected()
			if rows > 0 {
				log.Info().Int64("deleted_orphans", rows).Msg("🧹 [GC] Cleaned up orphaned whatsmeow devices")
			}
		} else {
			log.Warn().Err(err).Msg("Failed to run device GC")
		}
	}
}
