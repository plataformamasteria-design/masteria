// Package client implements the session manager that handles WhatsApp
// sessions via WhatsMeow. This is the Go equivalent of session-manager.ts.
package client

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	"whatsmeow-service/internal/handlers"
	"whatsmeow-service/internal/models"
	"whatsmeow-service/internal/store"
	"whatsmeow-service/internal/ws"
)

// SessionManager manages all WhatsApp sessions. It is the Go equivalent
// of the BaileysSessionManager class in session-manager.ts.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*models.Session
	emitter  *ws.Emitter

	// Profile picture cache
	ppCacheMu sync.RWMutex
	ppCache   map[string]ppCacheEntry

	// Granular session locks
	locksMu      sync.Mutex
	sessionLocks map[string]*sync.Mutex

	// Anti-recreate debounce map
	deletedSessions map[string]time.Time
}

type ppCacheEntry struct {
	URL       *string
	Timestamp time.Time
}

const ppCacheTTL = 10 * time.Minute

// NewSessionManager creates a new SessionManager with the given Socket.IO emitter.
func NewSessionManager(emitter *ws.Emitter) *SessionManager {
	sm := &SessionManager{
		sessions:        make(map[string]*models.Session),
		emitter:         emitter,
		ppCache:         make(map[string]ppCacheEntry),
		sessionLocks:    make(map[string]*sync.Mutex),
		deletedSessions: make(map[string]time.Time),
	}

	// Start internal background tasks
	go sm.cacheCleanup()
	go sm.sessionGC()

	return sm
}

// cacheCleanup periodically purges expired profile picture cache entries.
func (sm *SessionManager) cacheCleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		sm.ppCacheMu.Lock()
		now := time.Now()
		for k, v := range sm.ppCache {
			if now.Sub(v.Timestamp) > ppCacheTTL {
				delete(sm.ppCache, k)
			}
		}
		sm.ppCacheMu.Unlock()
	}
}

// getSessionLock gets or creates a granular mutex for a given session ID.
func (sm *SessionManager) getSessionLock(connectionID string) *sync.Mutex {
	sm.locksMu.Lock()
	defer sm.locksMu.Unlock()
	lock, exists := sm.sessionLocks[connectionID]
	if !exists {
		lock = &sync.Mutex{}
		sm.sessionLocks[connectionID] = lock
	}
	return lock
}

// sessionGC runs periodically to clean up ghost/zombie sessions and runs the Watchdog.
func (sm *SessionManager) sessionGC() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		sm.mu.Lock()
		for id, session := range sm.sessions {
			// Panic Recovery per session to avoid crashing the whole GC loop
			func() {
				defer func() {
					if r := recover(); r != nil {
						log.Error().Interface("panic", r).Str("connectionId", id).Msg("🚨 [WATCHDOG] Panic recovered during session check")
					}
				}()

				status := session.GetStatus()
				lastActivity := session.GetLastActivity()
			timeSinceActivity := time.Since(lastActivity)

			// 1. WATCHDOG: Log warnings for inactive connected sessions (more than 10 mins)
			if status == "connected" && timeSinceActivity > 10*time.Minute && session.Client != nil && session.Client.IsConnected() {
				log.Warn().
					Str("connectionId", id).
					Dur("inactiveTime", timeSinceActivity).
					Msg("🐕 [WATCHDOG] Session is connected but inactive for a long time. Potential freeze.") // No restart, just log
			}

			// 2. GARBAGE COLLECTOR: Clean up zombie 'connecting' sessions (more than 15 mins stuck)
			if status == "connecting" && timeSinceActivity > 15*time.Minute {
				log.Error().
					Str("connectionId", id).
					Dur("stuckTime", timeSinceActivity).
					Msg("🧹 [GC] Session stuck in 'connecting' for too long. Disconnecting and pruning from memory.")
				
				if session.Client != nil {
					session.Client.Disconnect()
					time.Sleep(100 * time.Millisecond)
				}
				delete(sm.sessions, id)
			}
			}()
		}
		sm.mu.Unlock()
	}
}

// CreateSession creates and starts a new WhatsApp session.
func (sm *SessionManager) CreateSession(connectionID, companyID string) error {
	lock := sm.getSessionLock(connectionID)
	lock.Lock()
	defer lock.Unlock()

	// Single Source of Truth Validation
	sm.mu.RLock()
	existing, exists := sm.sessions[connectionID]
	deletedAt, wasDeleted := sm.deletedSessions[connectionID]
	sm.mu.RUnlock()

	// Debounce: prevent recreating a session that was just deleted less than 5 seconds ago
	if wasDeleted && time.Since(deletedAt) < 5*time.Second {
		log.Warn().Str("connectionId", connectionID).Msg("CreateSession called too soon after deletion (debounce). Ignoring.")
		return nil
	}

	if exists {
		status := existing.GetStatus()
		if status == "connected" || status == "connecting" || status == "qr" {
			log.Info().
				Str("connectionId", connectionID).
				Str("status", status).
				Msg("Session already running or awaiting QR. Ignoring duplicate create request.")
			return nil
		}

		// If it exists but is failed/disconnected, clean it up before creating new
		if existing.Client != nil {
			log.Info().Str("connectionId", connectionID).Msg("🧹 Disconnecting previous zombie client instance before re-creating")
			existing.Client.Disconnect()
			time.Sleep(200 * time.Millisecond)
		}
		
		sm.mu.Lock()
		delete(sm.sessions, connectionID)
		sm.mu.Unlock()
	}

	return sm.doCreateSession(connectionID, companyID)
}

// doCreateSession performs the actual session creation (expects caller to hold connection lock).
func (sm *SessionManager) doCreateSession(connectionID, companyID string) error {
	t0 := time.Now()

	// Validate connection exists in database
	var configName sql.NullString
	var phone sql.NullString
	err := store.DB.QueryRow(
		`SELECT config_name, phone FROM connections WHERE id = $1 AND company_id = $2 LIMIT 1`,
		connectionID, companyID,
	).Scan(&configName, &phone)
	if err == sql.ErrNoRows {
		return fmt.Errorf("connection %s not found or does not belong to company %s", connectionID, companyID)
	}
	if err != nil {
		return fmt.Errorf("error querying connection: %w", err)
	}

	log.Info().
		Str("connectionId", connectionID).
		Str("phone", phone.String).
		Dur("dbLookup", time.Since(t0)).
		Msg("Creating session")


	// Get or create device store
	deviceStore, err := store.GetDeviceForSession(connectionID)
	if err != nil {
		return fmt.Errorf("error getting device store: %w", err)
	}

	log.Info().Dur("authLoad", time.Since(t0)).Str("connectionId", connectionID).Msg("⏱️ Auth loaded")

	// Create WhatsMeow client with logger
	clientLog := waLog.Stdout("WA-"+connectionID[:8], "INFO", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)

	// ✅ BAILEYS PARITY: Configure client to match Baileys' proven connection strategy.
	// Baileys used: syncFullHistory: false, markOnlineOnConnect: false
	client.EnableAutoReconnect = true                 // Auto-reconnect on transient failures
	client.EmitAppStateEventsOnFullSync = false        // Don't emit app state events during full sync
	// NOTE: We do NOT set ManualHistorySyncDownload = true because it blocks WhatsMeow's
	// internal event pipeline waiting for manual download calls. Instead, we let WhatsMeow
	// handle history sync internally and simply skip heavy processing in our HistorySync handler.

	// Set PushName for device identification (required for SendPresence later if needed)
	if client.Store.PushName == "" {
		client.Store.PushName = configName.String
		if client.Store.PushName == "" {
			client.Store.PushName = "Master IA"
		}
	}


	// Create session object with cancellation context
	ctx, cancel := context.WithCancel(context.Background())
	session := &models.Session{
		Client:       client,
		ConnectionID: connectionID,
		CompanyID:    companyID,
		Status:       "connecting",
		RetryCount:   0,
		LastActivity: time.Now(),
		QRChan:       make(chan string, 5),
		StatusChan:   make(chan models.StatusEvent, 5),
		CancelFunc:   cancel,
	}

	// Store session
	sm.mu.Lock()
	sm.sessions[connectionID] = session
	sm.mu.Unlock()

	// Emit session created
	sm.emitter.EmitSessionCreated(companyID, models.SessionUpdate{
		ID:     connectionID,
		Status: "connecting",
		Name:   configName.String,
	})

	// Registar event handler (Removed manual reconnect)
	evtHandler := &handlers.EventHandler{
		Session: session,
		Emitter: sm.emitter,
		DeleteFunc: func(connID string) {
			sm.deleteSessionInternal(connID)
		},
	}
	client.AddEventHandler(evtHandler.Handle)

	// Handle QR code or reconnect
	if client.Store.ID == nil {
		// New device — needs QR scan
		qrChan, _ := client.GetQRChannel(ctx)

		go func() {
			for evt := range qrChan {
				switch evt.Event {
				case "code":
					session.SetQR(evt.Code)
					session.SetStatus("qr")
					log.Info().
						Str("connectionId", connectionID).
						Dur("elapsed", time.Since(t0)).
						Msg("⚡ QR generated")

					// Notify SSE listeners
					select {
					case session.QRChan <- evt.Code:
					default:
					}

					// Emit via Socket.IO
					sm.emitter.EmitQRCodeUpdated(companyID, connectionID, evt.Code)
					sm.emitter.EmitConnectionStatusChanged(companyID, connectionID, "qr", "")

					// Persist to DB in background
					go store.DB.Exec(
						`UPDATE connections SET qr_code = $1, status = 'connecting' WHERE id = $2`,
						evt.Code, connectionID,
					)

				case "timeout":
					log.Warn().Str("connectionId", connectionID).Msg("QR code timeout")
					session.SetStatus("failed")
					store.DB.Exec(`UPDATE connections SET status = 'failed', qr_code = NULL WHERE id = $1`, connectionID)
					sm.emitter.EmitConnectionStatusChanged(companyID, connectionID, "failed", "")
					return // ✅ EXIT goroutine on timeout

				case "success":
					log.Info().Str("connectionId", connectionID).Msg("✅ QR code scanned — pairing complete, exiting QR loop")
					session.SetStatus("connecting")

					// ✅ CRITICAL FIX: WhatsMeow sets client.IsLoggedIn() = true IMMEDIATELY
					// after auth, but the Connected event only fires AFTER prekey upload +
					// SetPassive which takes 2-3 minutes on first pairing.
					// We poll IsLoggedIn() to detect auth instantly and update the frontend.
					go func() {
						for i := 0; i < 120; i++ { // Poll for up to 60 seconds
							time.Sleep(500 * time.Millisecond)
							if session.GetStatus() == "connected" {
								return // handleConnected already fired, nothing to do
							}
							if session.GetStatus() == "invalid" || session.GetStatus() == "failed" {
								return // session died
							}
							if client.IsLoggedIn() {
								log.Info().
									Str("connectionId", connectionID).
									Msg("🔓 Auth detected via IsLoggedIn() — marking connected (prekey upload still in progress)")

								// Get phone before Connected event
								phone := ""
								if client.Store != nil && client.Store.ID != nil {
									phone = client.Store.ID.User
								}

								session.SetStatus("connected")
								session.Phone = phone
								session.RetryCount = 0
								session.ConnectedAt = time.Now()
								session.UpdateActivity()

								// Save device mapping
								if client.Store != nil && client.Store.ID != nil {
									if err := store.SaveDeviceMapping(connectionID, client.Store.ID.String()); err != nil {
										log.Error().Err(err).Msg("Failed to save device mapping")
									}
								}

								// Update DB
								now := time.Now()
								isActive := true
								store.DB.Exec(`
									UPDATE connections SET status = 'connected', phone = $1, qr_code = NULL, 
									is_active = $2, last_connected = $3 WHERE id = $4
								`, phone, isActive, now, connectionID)

								// Emit to frontend
								sm.emitter.EmitConnectionStatusChanged(companyID, connectionID, "connected", phone)
								sm.emitter.EmitSessionUpdated(companyID, models.SessionUpdate{
									ID:            connectionID,
									Status:        "connected",
									Phone:         phone,
									IsActive:      &isActive,
									LastConnected: &now,
								})

								// Notify SSE
								select {
								case session.StatusChan <- models.StatusEvent{Status: "connected", Phone: phone}:
								default:
								}

								// ✅ Send presence 'available' after a short delay
								// This makes the phone show "Online" instead of "Last seen at..."
								go func() {
									time.Sleep(5 * time.Second)
									if client.IsLoggedIn() && session.GetStatus() == "connected" {
										err := client.SendPresence(context.Background(), types.PresenceAvailable)
										if err != nil {
											log.Warn().Err(err).Str("connectionId", connectionID).Msg("Failed to send delayed presence")
										} else {
											log.Info().Str("connectionId", connectionID).Msg("✅ Presence 'available' sent — phone should show Online")
										}
									}
								}()
								return
							}
						}
						log.Warn().Str("connectionId", connectionID).Msg("⚠️ IsLoggedIn() polling timed out after 60s")
					}()

					return // EXIT QR goroutine
				}
			}
			log.Debug().Str("connectionId", connectionID).Msg("QR channel closed")
		}()
	}

	// Connect Shield
	if client.IsConnected() {
		log.Info().Str("connectionId", connectionID).Msg("Client is already connected. Skipping duplicate Connect().")
	} else {
		if err := client.Connect(); err != nil {
			log.Error().Err(err).Str("connectionId", connectionID).Msg("Failed to connect")
			sm.mu.Lock()
			delete(sm.sessions, connectionID)
			sm.mu.Unlock()
			store.DB.Exec(`UPDATE connections SET status = 'failed', qr_code = NULL WHERE id = $1`, connectionID)
			return fmt.Errorf("connect error: %w", err)
		}
	}

	deviceID := "unpaired"
	if client.Store.ID != nil {
		deviceID = client.Store.ID.String()
	}

	log.Info().
		Str("connectionId", connectionID).
		Str("SESSION", connectionID).
		Str("DEVICE", deviceID).
		Bool("CONNECTED", client.IsConnected()).
		Dur("total", time.Since(t0)).
		Msg("Session setup complete")

	return nil
}

// DeleteSession disconnects and removes a session (External use).
func (sm *SessionManager) DeleteSession(connectionID string) error {
	lock := sm.getSessionLock(connectionID)
	lock.Lock()
	defer lock.Unlock()

	sm.mu.Lock()
	session, exists := sm.sessions[connectionID]
	if !exists {
		sm.mu.Unlock()
		store.DB.Exec(`UPDATE connections SET status = 'disconnected' WHERE id = $1`, connectionID)
		return nil
	}
	delete(sm.sessions, connectionID) // remove immediately from memory
	sm.deletedSessions[connectionID] = time.Now()
	sm.mu.Unlock()

	// Disconnect client physically
	if session.Client != nil {
		if session.GetStatus() == "connected" {
			session.Client.Logout(context.Background())
		} else {
			session.Client.Disconnect()
		}
	}

	sm.performTeardown(connectionID, session)
	return nil
}

// deleteSessionInternal removes a session from memory without explicit disconnect (Internal use context).
func (sm *SessionManager) deleteSessionInternal(connectionID string) {
	lock := sm.getSessionLock(connectionID)
	lock.Lock()
	defer lock.Unlock()

	sm.mu.Lock()
	session, exists := sm.sessions[connectionID]
	if exists {
		delete(sm.sessions, connectionID)
	}
	sm.deletedSessions[connectionID] = time.Now()
	sm.mu.Unlock()

	if !exists {
		store.DB.Exec(`UPDATE connections SET status = 'disconnected' WHERE id = $1`, connectionID)
		return
	}

	sm.performTeardown(connectionID, session)
}

// performTeardown cleans channels and Database traces
func (sm *SessionManager) performTeardown(connectionID string, session *models.Session) {
	// Close channels
	select {
	case session.StatusChan <- models.StatusEvent{Status: "disconnected"}:
	default:
	}

	// Update database
	var companyID string
	err := store.DB.QueryRow(`SELECT company_id FROM connections WHERE id = $1`, connectionID).Scan(&companyID)
	store.DB.Exec(`UPDATE connections SET status = 'disconnected', qr_code = NULL WHERE id = $1`, connectionID)

	if err == nil && companyID != "" {
		sm.emitter.EmitSessionDeleted(companyID, connectionID)
	}
}

// SendMessage sends a text message via WhatsApp.
func (sm *SessionManager) SendMessage(connectionID, to string, content interface{}) (string, error) {
	sm.mu.RLock()
	session, exists := sm.sessions[connectionID]
	sm.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("sessão não encontrada")
	}

	if session.Client == nil || !session.Client.IsConnected() {
		return "", fmt.Errorf("sessão não conectada")
	}

	log.Info().
		Str("connectionId", connectionID).
		Str("to", to).
		Msg("📥 INCOMING SEND REQUEST")

	// Format JID
	jid, err := models.FormatJID(to)
	if err != nil {
		return "", err
	}

	// Build message
	var msg *waProto.Message
	switch v := content.(type) {
	case string:
		msg = &waProto.Message{
			Conversation: proto.String(v),
		}
	case map[string]interface{}:
		if text, ok := v["text"].(string); ok {
			msg = &waProto.Message{
				Conversation: proto.String(text),
			}
		} else {
			return "", fmt.Errorf("unsupported message content format")
		}
	default:
		// Try to treat as string
		text := fmt.Sprintf("%v", content)
		msg = &waProto.Message{
			Conversation: proto.String(text),
		}
	}

	log.Info().
		Str("connectionId", connectionID).
		Str("jid", jid.String()).
		Msg("🚀 SENDING MESSAGE")

	// Send message directly (Fast Path)
	resp, err := session.Client.SendMessage(context.Background(), jid, msg)
	
	// Fallback Path: if it failed and it's a Brazilian number, try to correct the 9th digit
	if err != nil && strings.HasPrefix(jid.User, "55") {
		log.Warn().Err(err).Str("jid", jid.String()).Msg("Primary send failed. Attempting 9th digit fallback...")
		
		digits := jid.User
		var fallbackJid string
		if len(digits) == 12 {
			fallbackJid = "55" + digits[2:4] + "9" + digits[4:] + "@s.whatsapp.net"
		} else if len(digits) == 13 && digits[4] == '9' {
			fallbackJid = "55" + digits[2:4] + digits[5:] + "@s.whatsapp.net"
		}

		if fallbackJid != "" {
			// Validate fallback JID via Meta API
			result, errIsOn := session.Client.IsOnWhatsApp(context.Background(), []string{fallbackJid})
			if errIsOn == nil && len(result) > 0 && result[0].IsIn {
				log.Info().Str("old", jid.String()).Str("new", result[0].JID.String()).Msg("Fallback JID validated. Retrying send.")
				jid = result[0].JID
				resp, err = session.Client.SendMessage(context.Background(), jid, msg)
			} else {
				log.Warn().Str("fallbackJid", fallbackJid).Msg("Fallback JID not valid either")
			}
		}
	}

	if err != nil {
		log.Error().Err(err).Msg("❌ SEND ERROR")
		return "", err
	}
	log.Info().Str("messageId", resp.ID).Msg("✅ MESSAGE SENT")

	// Persist outbound message in background
	go func() {
		textContent := ""
		if msg.Conversation != nil {
			textContent = msg.GetConversation()
		}
		ts := time.Now().Unix()
		store.DB.Exec(`
			INSERT INTO baileys_messages (id, connection_id, jid, message_id, from_me, timestamp, text, content)
			VALUES (gen_random_uuid(), $1, $2, $3, true, $4, $5, NULL)
			ON CONFLICT (message_id) DO NOTHING
		`, connectionID, jid.String(), resp.ID, ts, textContent)
	}()

	return resp.ID, nil
}

// EnsureSession ensures a session is active, creating it if necessary.
func (sm *SessionManager) EnsureSession(connectionID, companyID string) models.EnsureSessionResponse {
	sm.mu.RLock()
	existing, exists := sm.sessions[connectionID]
	sm.mu.RUnlock()

	if exists {
		status := existing.GetStatus()
		return models.EnsureSessionResponse{
			Success: status == "connected",
			Status:  status,
			Message: fmt.Sprintf("Session status: %s", status),
		}
	}

	// Check if device exists in store
	device, err := store.GetDeviceForSession(connectionID)
	if err != nil {
		return models.EnsureSessionResponse{Success: false, Status: "failed", Message: err.Error()}
	}

	if device != nil && device.ID != nil {
		// Has auth — try to restore
		err := sm.CreateSession(connectionID, companyID)
		if err != nil {
			return models.EnsureSessionResponse{Success: false, Status: "failed", Message: err.Error()}
		}

		// Wait a bit for connection
		time.Sleep(2 * time.Second)

		sm.mu.RLock()
		restored, ok := sm.sessions[connectionID]
		sm.mu.RUnlock()

		if ok {
			status := restored.GetStatus()
			return models.EnsureSessionResponse{
				Success: status == "connected",
				Status:  status,
				Message: func() string {
					if status == "connected" {
						return "Restored from auth"
					}
					return "Awaiting connection"
				}(),
			}
		}
	}

	store.DB.Exec(`UPDATE connections SET status = 'disconnected' WHERE id = $1`, connectionID)
	return models.EnsureSessionResponse{Success: false, Status: "needs_qr", Message: "No auth found. Scan QR code."}
}

// ResumeAllSessions resumes all sessions that were previously connected.
func (sm *SessionManager) ResumeAllSessions() (success int, failed int) {
	log.Info().Msg("🔄 Starting auto-resume of active sessions...")

	rows, err := store.DB.Query(`
		SELECT id, company_id, phone FROM connections 
		WHERE status = 'connected' AND connection_type = 'baileys'
	`)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query connections for resume")
		return 0, 0
	}
	defer rows.Close()

	type connInfo struct {
		ID        string
		CompanyID string
		Phone     string
	}
	var conns []connInfo

	for rows.Next() {
		var c connInfo
		var phone sql.NullString
		if err := rows.Scan(&c.ID, &c.CompanyID, &phone); err != nil {
			continue
		}
		c.Phone = phone.String
		conns = append(conns, c)
	}

	log.Info().Int("count", len(conns)).Msg("Found sessions to resume")

	for _, c := range conns {
		sm.mu.RLock()
		existing, exists := sm.sessions[c.ID]
		sm.mu.RUnlock()

		if exists && existing.GetStatus() == "connected" {
			success++
			continue
		}

		// Check if device has auth
		device, err := store.GetDeviceForSession(c.ID)
		if err != nil || device == nil || device.ID == nil {
			log.Warn().Str("connectionId", c.ID).Msg("⚠️ No auth found, skipping")
			failed++
			continue
		}

		log.Info().Str("connectionId", c.ID).Str("phone", c.Phone).Msg("Resuming session...")

		if err := sm.CreateSession(c.ID, c.CompanyID); err != nil {
			log.Error().Err(err).Str("connectionId", c.ID).Msg("Failed to resume session")
			failed++
		} else {
			success++
		}
	}

	log.Info().Int("success", success).Int("failed", failed).Msg("Auto-resume complete")
	return success, failed
}

// GetSession returns a session by connection ID.
func (sm *SessionManager) GetSession(connectionID string) *models.Session {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.sessions[connectionID]
}

// GetSessionStatus returns the status of a session.
func (sm *SessionManager) GetSessionStatus(connectionID string) string {
	sm.mu.RLock()
	session, exists := sm.sessions[connectionID]
	sm.mu.RUnlock()

	if !exists {
		return ""
	}
	return session.GetStatus()
}

// GetBatchSessionStatus returns the status of multiple sessions.
func (sm *SessionManager) GetBatchSessionStatus(connectionIDs []string) map[string]*string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := make(map[string]*string)
	for _, id := range connectionIDs {
		if session, exists := sm.sessions[id]; exists {
			status := session.GetStatus()
			result[id] = &status
		} else {
			result[id] = nil
		}
	}
	return result
}

// GetSessionsStats returns aggregate session statistics.
func (sm *SessionManager) GetSessionsStats() models.SessionStats {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	stats := models.SessionStats{
		Total: len(sm.sessions),
		ByStatus: map[string]int{
			"connected":    0,
			"connecting":   0,
			"disconnected": 0,
			"qr":           0,
			"failed":       0,
		},
	}

	for _, session := range sm.sessions {
		status := session.GetStatus()
		stats.ByStatus[status]++
	}

	return stats
}

// ValidateWhatsAppNumber checks if a phone number is registered on WhatsApp.
func (sm *SessionManager) ValidateWhatsAppNumber(connectionID, phoneNumber string) (bool, string, error) {
	sm.mu.RLock()
	session, exists := sm.sessions[connectionID]
	sm.mu.RUnlock()

	if !exists {
		return false, "", fmt.Errorf("session not found")
	}
	if session.GetStatus() != "connected" {
		return false, "", fmt.Errorf("not connected: %s", session.GetStatus())
	}

	jid, err := models.FormatJID(phoneNumber)
	if err != nil {
		return false, "", err
	}

	results, err := session.Client.IsOnWhatsApp(context.Background(), []string{jid.String()})
	if err != nil {
		return false, "", err
	}

	if len(results) > 0 && results[0].IsIn {
		return true, results[0].JID.String(), nil
	}

	return false, "", nil
}

// GetProfilePicture returns a contact's profile picture URL.
func (sm *SessionManager) GetProfilePicture(jid string) *string {
	// Parse JID
	cleanJid := jid
	if !strings.Contains(jid, "@") {
		digits := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, jid)
		cleanJid = digits + "@s.whatsapp.net"
	}

	// Check cache
	sm.ppCacheMu.RLock()
	if cached, ok := sm.ppCache[cleanJid]; ok && time.Since(cached.Timestamp) < ppCacheTTL {
		sm.ppCacheMu.RUnlock()
		return cached.URL
	}
	sm.ppCacheMu.RUnlock()

	// Try all connected sessions
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	parsedJid, err := types.ParseJID(cleanJid)
	if err != nil {
		return nil
	}

	for _, session := range sm.sessions {
		if session.GetStatus() == "connected" && session.Client != nil {
			pic, err := session.Client.GetProfilePictureInfo(context.Background(), parsedJid, &whatsmeow.GetProfilePictureParams{})
			if err == nil && pic != nil {
				sm.ppCacheMu.Lock()
				sm.ppCache[cleanJid] = ppCacheEntry{URL: &pic.URL, Timestamp: time.Now()}
				sm.ppCacheMu.Unlock()
				return &pic.URL
			}
		}
	}

	sm.ppCacheMu.Lock()
	sm.ppCache[cleanJid] = ppCacheEntry{URL: nil, Timestamp: time.Now()}
	sm.ppCacheMu.Unlock()
	return nil
}

// ClearAuth clears the auth state for a connection.
func (sm *SessionManager) ClearAuth(connectionID string) error {
	// Delete session first
	sm.DeleteSession(connectionID)

	// Delete device mapping
	return store.DeleteDeviceMapping(connectionID)
}

// SyncChatHistory requests history for a specific JID.
func (sm *SessionManager) SyncChatHistory(connectionID, jidStr string) error {
	sm.mu.RLock()
	session, exists := sm.sessions[connectionID]
	sm.mu.RUnlock()

	if !exists || session.GetStatus() != "connected" || session.Client == nil {
		return fmt.Errorf("sessão não conectada")
	}

	jid, err := models.FormatJID(jidStr)
	if err != nil {
		return err
	}

	log.Info().Str("jid", jid.String()).Str("connectionId", connectionID).Msg("Requesting chat history")

	// Request message history
	_, err = session.Client.SendMessage(
		context.Background(),
		jid,
		&waProto.Message{Conversation: proto.String("")},
		whatsmeow.SendRequestExtra{Peer: true},
	)

	return err
}

// HasAuth checks if a connection has saved authentication.
func (sm *SessionManager) HasAuth(connectionID string) bool {
	device, err := store.GetDeviceForSession(connectionID)
	if err != nil {
		return false
	}
	return device != nil && device.ID != nil
}

// GetAllSessions returns a summary of all active sessions.
func (sm *SessionManager) GetAllSessions() []map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	var result []map[string]interface{}
	for id, session := range sm.sessions {
		result = append(result, map[string]interface{}{
			"id":     id,
			"status": session.GetStatus(),
			"phone":  session.Phone,
		})
	}
	return result
}

// GetMessagesForJID retrieves paginated messages for a JID.
func (sm *SessionManager) GetMessagesForJID(connectionID, jid string, limit int, cursor *int) ([]map[string]interface{}, *int, error) {
	query := `SELECT message_id, from_me, timestamp, text, content 
		FROM baileys_messages 
		WHERE connection_id = $1 AND jid = $2`
	args := []interface{}{connectionID, jid}
	argIdx := 3

	if cursor != nil {
		query += fmt.Sprintf(" AND timestamp < $%d", argIdx)
		args = append(args, *cursor)
		argIdx++
	}

	query += " ORDER BY timestamp DESC"
	query += fmt.Sprintf(" LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := store.DB.Query(query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var msgID string
		var fromMe bool
		var ts sql.NullInt64
		var text sql.NullString
		var content sql.NullString

		if err := rows.Scan(&msgID, &fromMe, &ts, &text, &content); err != nil {
			continue
		}

		msg := map[string]interface{}{
			"messageId": msgID,
			"fromMe":    fromMe,
			"timestamp": ts.Int64,
			"text":      text.String,
			"content":   nil,
		}
		messages = append(messages, msg)
	}

	var nextCursor *int
	if len(messages) == limit && len(messages) > 0 {
		lastTs := int(messages[len(messages)-1]["timestamp"].(int64))
		nextCursor = &lastTs
	}

	return messages, nextCursor, nil
}

// GetMessagesForConversation retrieves paginated messages for a conversation.
func (sm *SessionManager) GetMessagesForConversation(conversationID string, limit int, cursor *int) ([]map[string]interface{}, *int, error) {
	query := `SELECT message_id, from_me, timestamp, text, content 
		FROM baileys_messages 
		WHERE conversation_id = $1`
	args := []interface{}{conversationID}
	argIdx := 2

	if cursor != nil {
		query += fmt.Sprintf(" AND timestamp < $%d", argIdx)
		args = append(args, *cursor)
		argIdx++
	}

	query += " ORDER BY timestamp DESC"
	query += fmt.Sprintf(" LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := store.DB.Query(query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var msgID string
		var fromMe bool
		var ts sql.NullInt64
		var text sql.NullString
		var content sql.NullString

		if err := rows.Scan(&msgID, &fromMe, &ts, &text, &content); err != nil {
			continue
		}

		msg := map[string]interface{}{
			"messageId": msgID,
			"fromMe":    fromMe,
			"timestamp": ts.Int64,
			"text":      text.String,
			"content":   nil,
		}
		messages = append(messages, msg)
	}

	var nextCursor *int
	if len(messages) == limit && len(messages) > 0 {
		lastTs := int(messages[len(messages)-1]["timestamp"].(int64))
		nextCursor = &lastTs
	}

	_ = math.Min(0, 0) // keep math import

	return messages, nextCursor, nil
}
