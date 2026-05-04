// WhatsMeow Microservice - Main Server
// Standalone HTTP + Socket.IO server for WhatsApp session management via WhatsMeow.
// Drop-in replacement for the Baileys Node.js microservice.
//
// Connects to the same PostgreSQL database as MasterIA.
// Exposes the same REST API and Socket.IO events.
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"whatsmeow-service/internal/client"
	"whatsmeow-service/internal/handlers"
	"whatsmeow-service/internal/models"
	appStore "whatsmeow-service/internal/store"
	"whatsmeow-service/internal/ws"
)

var serverStartTime = time.Now()

func main() {
	// --- Load .env file ---
	loadEnvFile(".env")

	// --- Configure logging ---
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	logLevel := zerolog.InfoLevel
	if os.Getenv("DEBUG") == "true" {
		logLevel = zerolog.DebugLevel
	}
	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "15:04:05"}).
		With().Timestamp().Caller().Logger().Level(logLevel)

	// --- Configuration ---
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal().Msg("DATABASE_URL is not set")
	}

	// --- Initialize database ---
	log.Info().Msg("Initializing database connection...")
	if err := appStore.Init(databaseURL); err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer appStore.Close()

	// Ensure mapping table exists
	if err := appStore.EnsureMappingTable(); err != nil {
		log.Fatal().Err(err).Msg("Failed to ensure mapping table")
	}

	// --- Initialize Socket.IO ---
	emitter, err := ws.NewEmitter()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize Socket.IO")
	}

	// --- Initialize Session Manager ---
	sessionManager := client.NewSessionManager(emitter)

	// --- Setup HTTP Router ---
	router := mux.NewRouter()

	// Health check (Real Metrics)
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		stats := sessionManager.GetSessionsStats()
		uptime := time.Since(serverStartTime).Round(time.Second).String()
		
		// Map boolean flags
		dbHealthy := true
		dbLatency := time.Duration(0)
		
		dbStart := time.Now()
		if err := appStore.DB.Ping(); err != nil {
			dbHealthy = false
			log.Error().Err(err).Msg("[HEALTH] Database ping failed")
		} else {
			dbLatency = time.Since(dbStart)
		}

		response := map[string]interface{}{
			"status": "ok",
			"service": "whatsmeow-service",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"uptime": uptime,
			"database": map[string]interface{}{
				"connected": dbHealthy,
				"latencyMs": dbLatency.Milliseconds(),
			},
			"sessions": map[string]interface{}{
				"total": stats.Total,
				"byStatus": stats.ByStatus,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		if !dbHealthy {
			w.WriteHeader(http.StatusServiceUnavailable)
			response["status"] = "degraded"
		} else {
			w.WriteHeader(http.StatusOK)
		}
		
		json.NewEncoder(w).Encode(response)
	}).Methods("GET")

	// API routes with auth middleware
	apiRouter := router.PathPrefix("/api").Subrouter()
	apiRouter.Use(handlers.APIKeyAuth)

	api := &handlers.API{SM: sessionManager}
	api.RegisterRoutes(apiRouter)

	// Socket.IO handler on /baileys-ws path (compatibility with MasterIA)
	router.PathPrefix("/baileys-ws").Handler(emitter.ServeHTTP())

	// CORS middleware
	corsRouter := corsMiddleware(router)

	// Static file server for downloaded media (images, videos, stickers)
	// Files are saved by events.go downloadAndServeMedia() and cleaned up after 1 hour
	mediaDir := handlers.MediaDir
	log.Info().Str("dir", mediaDir).Msg("📁 Serving media files from")
	if err := os.MkdirAll(mediaDir, 0755); err != nil {
		log.Error().Err(err).Msg("Failed to create media directory")
	}
	router.PathPrefix("/media/").Handler(
		http.StripPrefix("/media/", http.FileServer(http.Dir(mediaDir))),
	)

	// --- Create HTTP Server ---
	srv := &http.Server{
		Addr:         "0.0.0.0:" + port,
		Handler:      corsRouter,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// --- Start Server ---
	go func() {
		log.Info().Str("port", port).Msg("🚀 WhatsMeow Service listening")
		log.Info().Msgf("   Health: http://0.0.0.0:%s/health", port)
		log.Info().Msgf("   WebSocket: ws://0.0.0.0:%s/baileys-ws", port)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	// --- Auto-resume sessions ---
	go func() {
		// Small delay to let server start
		time.Sleep(1 * time.Second)

		log.Info().Msg("🔄 Starting WhatsApp session auto-resume...")
		success, failed := sessionManager.ResumeAllSessions()
		log.Info().Int("success", success).Int("failed", failed).Msg("✅ Sessions resumed")
	}()

	// --- Media cleanup goroutine: remove files older than 1 hour ---
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			cleanupOldMediaFiles(handlers.MediaDir, 1*time.Hour)
		}
	}()

	// --- Graceful Shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("🛑 Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}

// corsMiddleware adds CORS headers (matches the Express cors() middleware).
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loadEnvFile loads environment variables from a .env file.
func loadEnvFile(filename string) {
	f, err := os.Open(filename)
	if err != nil {
		return // .env file is optional
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		// Remove surrounding quotes
		value = strings.Trim(value, `"'`)
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}

// Keep models import reference
var _ models.SessionStats

// cleanupOldMediaFiles removes temporary media files older than maxAge.
func cleanupOldMediaFiles(dir string, maxAge time.Duration) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	now := time.Now()
	removed := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) > maxAge {
			os.Remove(filepath.Join(dir, entry.Name()))
			removed++
		}
	}
	if removed > 0 {
		log.Info().Int("count", removed).Msg("🧹 Cleaned up old media files")
	}
}
