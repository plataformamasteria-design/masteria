// Package handlers provides the HTTP API handlers.
// This file implements all 17 endpoints that the MasterIA baileys-bridge-client.ts
// communicates with. Every endpoint matches the exact path, method, request body,
// and response shape of the original Baileys Node.js service.
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"whatsmeow-service/internal/models"
)

// SessionManagerInterface defines the methods that the API handlers need
// from the session manager. This avoids a direct import of the client package
// and breaks the import cycle.
type SessionManagerInterface interface {
	CreateSession(connectionID, companyID string) error
	DeleteSession(connectionID string) error
	SendMessage(connectionID, to string, content interface{}) (string, error)
	EnsureSession(connectionID, companyID string) models.EnsureSessionResponse
	GetSession(connectionID string) *models.Session
	GetSessionStatus(connectionID string) string
	GetSessionsStats() models.SessionStats
	GetBatchSessionStatus(connectionIDs []string) map[string]*string
	ResumeAllSessions() (int, int)
	ValidateWhatsAppNumber(connectionID, phoneNumber string) (bool, string, error)
	GetProfilePicture(jid string) *string
	ClearAuth(connectionID string) error
	SyncChatHistory(connectionID, jidStr string) error
	GetMessagesForJID(connectionID, jid string, limit int, cursor *int) ([]map[string]interface{}, *int, error)
	GetMessagesForConversation(conversationID string, limit int, cursor *int) ([]map[string]interface{}, *int, error)
}

// API holds a reference to the session manager for HTTP handlers.
type API struct {
	SM SessionManagerInterface
}

// RegisterRoutes registers all API routes on the given router.
func (a *API) RegisterRoutes(r *mux.Router) {
	// Session management
	r.HandleFunc("/sessions/{connectionId}/create", a.CreateSession).Methods("POST")
	r.HandleFunc("/sessions/{connectionId}/send", a.SendMessage).Methods("POST")
	r.HandleFunc("/sessions/{connectionId}/ensure", a.EnsureSession).Methods("POST")
	r.HandleFunc("/sessions/{connectionId}", a.DeleteSession).Methods("DELETE")
	r.HandleFunc("/sessions/{connectionId}/status", a.GetSessionStatus).Methods("GET")
	r.HandleFunc("/sessions/{connectionId}/qr", a.GetQRCode).Methods("GET")
	r.HandleFunc("/sessions/{connectionId}/qr/stream", a.QRStream).Methods("GET")
	r.HandleFunc("/sessions/{connectionId}/clear-auth", a.ClearAuth).Methods("POST")
	r.HandleFunc("/sessions/{connectionId}/sync-history", a.SyncHistory).Methods("POST")
	r.HandleFunc("/sessions/{connectionId}/validate-number", a.ValidateNumber).Methods("POST")
	r.HandleFunc("/sessions/{connectionId}/profile-picture", a.GetProfilePicture).Methods("GET")
	r.HandleFunc("/sessions/{connectionId}/messages/{jid}", a.GetMessagesByJID).Methods("GET")

	// Batch operations
	r.HandleFunc("/sessions/stats", a.GetStats).Methods("GET")
	r.HandleFunc("/sessions/batch-status", a.BatchStatus).Methods("POST")
	r.HandleFunc("/sessions/resume-all", a.ResumeAll).Methods("POST")
	r.HandleFunc("/sessions/messages", a.GetMessagesByConversation).Methods("GET")
}

// --- JSON helpers ---

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// --- Handlers ---

// POST /api/sessions/:connectionId/create
func (a *API) CreateSession(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	var req models.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if req.CompanyID == "" {
		writeError(w, 400, "companyId is required")
		return
	}

	if err := a.SM.CreateSession(connectionID, req.CompanyID); err != nil {
		log.Error().Err(err).Str("connectionId", connectionID).Msg("[API] Error creating session")
		writeError(w, 500, err.Error())
		return
	}

	status := a.SM.GetSessionStatus(connectionID)
	writeJSON(w, 200, map[string]interface{}{
		"success":      true,
		"connectionId": connectionID,
		"status":       status,
	})
}

// POST /api/sessions/:connectionId/send
func (a *API) SendMessage(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	var req models.SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if req.To == "" || req.Content == nil {
		writeError(w, 400, "to and content are required")
		return
	}

	messageID, err := a.SM.SendMessage(connectionID, req.To, req.Content)
	if err != nil {
		log.Error().Err(err).Str("connectionId", connectionID).Msg("[API] Error sending message")
		writeError(w, 500, err.Error())
		return
	}

	if messageID != "" {
		writeJSON(w, 200, map[string]interface{}{
			"success":   true,
			"messageId": messageID,
		})
	} else {
		writeError(w, 500, "Failed to send message")
	}
}

// POST /api/sessions/:connectionId/ensure
func (a *API) EnsureSession(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	var req models.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if req.CompanyID == "" {
		writeError(w, 400, "companyId is required")
		return
	}

	result := a.SM.EnsureSession(connectionID, req.CompanyID)
	writeJSON(w, 200, result)
}

// DELETE /api/sessions/:connectionId
func (a *API) DeleteSession(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	if err := a.SM.DeleteSession(connectionID); err != nil {
		log.Error().Err(err).Str("connectionId", connectionID).Msg("[API] Error deleting session")
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"success": true})
}

// GET /api/sessions/:connectionId/status
func (a *API) GetSessionStatus(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	session := a.SM.GetSession(connectionID)

	resp := models.SessionStatusResponse{
		ConnectionID: connectionID,
		Status:       "none",
	}

	if session != nil {
		resp.Status = session.GetStatus()
		if session.Phone != "" {
			resp.Phone = &session.Phone
		}
		qr := session.GetQR()
		if qr != "" {
			resp.QR = &qr
		}
	}

	writeJSON(w, 200, resp)
}

// GET /api/sessions/:connectionId/qr
func (a *API) GetQRCode(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	session := a.SM.GetSession(connectionID)

	if session == nil {
		writeError(w, 404, "Session not found")
		return
	}

	qr := session.GetQR()
	writeJSON(w, 200, map[string]interface{}{
		"connectionId": connectionID,
		"qr":           nilIfEmpty(qr),
		"status":       session.GetStatus(),
	})
}

// GET /api/sessions/:connectionId/qr/stream (SSE)
func (a *API) QRStream(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	log.Info().Str("connectionId", connectionID).Msg("[API SSE] QR stream requested")

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, 500, "Streaming not supported")
		return
	}
	flusher.Flush()

	// Send current QR immediately if available
	session := a.SM.GetSession(connectionID)
	if session != nil {
		qr := session.GetQR()
		if qr != "" {
			fmt.Fprintf(w, "data: %s\n\n", mustJSON(map[string]string{"qr": qr}))
			flusher.Flush()
		}
		if session.GetStatus() == "connected" {
			fmt.Fprintf(w, "data: %s\n\n", mustJSON(map[string]interface{}{
				"status": "connected",
				"phone":  session.Phone,
			}))
			flusher.Flush()
			return
		}
	}

	// Wait for QR/status events or timeout
	ctx := r.Context()
	keepAlive := time.NewTicker(30 * time.Second)
	timeout := time.After(5 * time.Minute)
	defer keepAlive.Stop()

	for {
		// Re-fetch session (might have been created after SSE started)
		session = a.SM.GetSession(connectionID)
		if session == nil {
			time.Sleep(500 * time.Millisecond)
			select {
			case <-ctx.Done():
				return
			default:
				continue
			}
		}

		select {
		case <-ctx.Done():
			log.Info().Str("connectionId", connectionID).Msg("[API SSE] Client disconnected")
			return

		case qr := <-session.QRChan:
			fmt.Fprintf(w, "data: %s\n\n", mustJSON(map[string]string{"qr": qr}))
			flusher.Flush()

		case evt := <-session.StatusChan:
			data := map[string]interface{}{"status": evt.Status}
			if evt.Phone != "" {
				data["phone"] = evt.Phone
			}
			if evt.Reason != "" {
				data["reason"] = evt.Reason
			}
			fmt.Fprintf(w, "data: %s\n\n", mustJSON(data))
			flusher.Flush()

			if evt.Status == "connected" || evt.Status == "disconnected" || evt.Status == "error" {
				return
			}

		case <-keepAlive.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()

		case <-timeout:
			log.Info().Str("connectionId", connectionID).Msg("[API SSE] Auto-closing after 5 minutes")
			return
		}
	}
}

// GET /api/sessions/stats
func (a *API) GetStats(w http.ResponseWriter, r *http.Request) {
	stats := a.SM.GetSessionsStats()
	writeJSON(w, 200, stats)
}

// POST /api/sessions/batch-status
func (a *API) BatchStatus(w http.ResponseWriter, r *http.Request) {
	var req models.BatchStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if req.ConnectionIDs == nil {
		writeError(w, 400, "connectionIds must be an array")
		return
	}

	statusMap := a.SM.GetBatchSessionStatus(req.ConnectionIDs)
	writeJSON(w, 200, statusMap)
}

// POST /api/sessions/resume-all
func (a *API) ResumeAll(w http.ResponseWriter, r *http.Request) {
	success, failed := a.SM.ResumeAllSessions()
	writeJSON(w, 200, map[string]int{
		"success": success,
		"failed":  failed,
	})
}

// POST /api/sessions/:connectionId/sync-history
func (a *API) SyncHistory(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	var req models.SyncHistoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if req.JID == "" {
		writeError(w, 400, "jid is required")
		return
	}

	if err := a.SM.SyncChatHistory(connectionID, req.JID); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"success": true})
}

// POST /api/sessions/:connectionId/validate-number
func (a *API) ValidateNumber(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	var req models.ValidateNumberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if req.PhoneNumber == "" {
		writeError(w, 400, "phoneNumber is required")
		return
	}

	exists, jid, err := a.SM.ValidateWhatsAppNumber(connectionID, req.PhoneNumber)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{
			"exists": false,
			"error":  err.Error(),
		})
		return
	}

	resp := map[string]interface{}{"exists": exists}
	if jid != "" {
		resp["jid"] = jid
	}
	if !exists {
		resp["error"] = "Not on WhatsApp"
	}
	writeJSON(w, 200, resp)
}

// GET /api/sessions/:connectionId/profile-picture
func (a *API) GetProfilePicture(w http.ResponseWriter, r *http.Request) {
	jid := r.URL.Query().Get("jid")
	if jid == "" {
		writeError(w, 400, "jid query parameter is required")
		return
	}

	url := a.SM.GetProfilePicture(jid)
	writeJSON(w, 200, map[string]interface{}{"url": url})
}

// POST /api/sessions/:connectionId/clear-auth
func (a *API) ClearAuth(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connectionId"]
	if err := a.SM.ClearAuth(connectionID); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"success": true})
}

// GET /api/sessions/:connectionId/messages/:jid
func (a *API) GetMessagesByJID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	connectionID := vars["connectionId"]
	jid := vars["jid"]

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 200 {
		limit = 200
	}

	var cursor *int
	if c := r.URL.Query().Get("cursor"); c != "" {
		if parsed, err := strconv.Atoi(c); err == nil {
			cursor = &parsed
		}
	}

	messages, nextCursor, err := a.SM.GetMessagesForJID(connectionID, jid, limit, cursor)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":      true,
		"connectionId": connectionID,
		"jid":          jid,
		"count":        len(messages),
		"nextCursor":   nextCursor,
		"messages":     messages,
	})
}

// GET /api/sessions/messages?conversationId=XXX
func (a *API) GetMessagesByConversation(w http.ResponseWriter, r *http.Request) {
	conversationID := r.URL.Query().Get("conversationId")
	if conversationID == "" {
		writeError(w, 400, "conversationId is required")
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 200 {
		limit = 200
	}

	var cursor *int
	if c := r.URL.Query().Get("cursor"); c != "" {
		if parsed, err := strconv.Atoi(c); err == nil {
			cursor = &parsed
		}
	}

	messages, nextCursor, err := a.SM.GetMessagesForConversation(conversationID, limit, cursor)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"success":        true,
		"conversationId": conversationID,
		"count":          len(messages),
		"nextCursor":     nextCursor,
		"messages":       messages,
	})
}

// --- Utility functions ---

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func mustJSON(data interface{}) string {
	b, err := json.Marshal(data)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// Ensure the strings import is used
var _ = strings.Contains
