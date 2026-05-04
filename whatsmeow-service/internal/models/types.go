// Package models defines shared types used across the whatsmeow-service.
package models

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// FormatJID formats a phone number into a WhatsApp JID.
func FormatJID(phone string) (types.JID, error) {
	// Remove non-digits
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)

	if len(digits) < 10 {
		return types.JID{}, fmt.Errorf("número inválido para WhatsApp: muito curto")
	}

	// If already has @, parse it
	if strings.Contains(phone, "@") {
		jid, err := types.ParseJID(phone)
		return jid, err
	}

	return types.NewJID(digits, types.DefaultUserServer), nil
}

// Session holds the runtime state of a single WhatsApp session.
type Session struct {
	Client       *whatsmeow.Client
	ConnectionID string
	CompanyID    string
	Status       string // "connecting", "connected", "disconnected", "qr", "failed"
	Phone        string
	QR           string
	RetryCount   int
	ConnectedAt  time.Time
	LastActivity time.Time   // For Garbage Collector & Watchdog
	QRChan       chan string // channel for SSE QR streaming
	StatusChan   chan StatusEvent
	CancelFunc   func() // to cancel reconnect goroutines

	mu sync.RWMutex
}

// SetStatus thread-safely updates the session status.
func (s *Session) SetStatus(status string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Status = status
}

// GetStatus thread-safely reads the session status.
func (s *Session) GetStatus() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status
}

// SetQR thread-safely updates the QR code.
func (s *Session) SetQR(qr string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.QR = qr
}

// GetQR thread-safely reads the QR code.
func (s *Session) GetQR() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.QR
}

// UpdateActivity thread-safely bumps the last activity timestamp.
func (s *Session) UpdateActivity() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.LastActivity = time.Now()
}

// GetLastActivity thread-safely retrieves the last activity timestamp.
func (s *Session) GetLastActivity() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.LastActivity
}

// StatusEvent represents a session status change for internal channels.
type StatusEvent struct {
	Status string
	Phone  string
	Reason string
}

// SessionUpdate mirrors the TypeScript SessionUpdate interface for Socket.IO emission.
type SessionUpdate struct {
	ID            string     `json:"id"`
	Name          string     `json:"name,omitempty"`
	Status        string     `json:"status"`
	Phone         string     `json:"phone,omitempty"`
	LastConnected *time.Time `json:"lastConnected,omitempty"`
	IsActive      *bool      `json:"isActive,omitempty"`
	HasAuth       *bool      `json:"hasAuth,omitempty"`
	QR            string     `json:"qr,omitempty"`
}

// IncomingMessagePayload is the payload sent via Socket.IO for incoming messages.
// Must match the exact shape that baileys-ws-listener.ts expects.
type IncomingMessagePayload struct {
	ConnectionID   string      `json:"connectionId"`
	ContactPhone   string      `json:"contactPhone"`
	ContactName    string      `json:"contactName"`
	MessageContent string      `json:"messageContent"`
	MessageType    string      `json:"messageType"`
	MessageID      string      `json:"messageId"`
	ConversationID string      `json:"conversationId"`
	SavedMessageID string      `json:"savedMessageId"`
	IsFromMe       bool        `json:"isFromMe"`
	MediaURL       string      `json:"mediaUrl,omitempty"`
	RawMsg         interface{} `json:"rawMsg,omitempty"`
}

// SendRequest is the JSON body from POST /api/sessions/:id/send.
type SendRequest struct {
	To      string      `json:"to"`
	Content interface{} `json:"content"`
}

// CreateSessionRequest is the JSON body from POST /api/sessions/:id/create.
type CreateSessionRequest struct {
	CompanyID string `json:"companyId"`
}

// BatchStatusRequest is the JSON body from POST /api/sessions/batch-status.
type BatchStatusRequest struct {
	ConnectionIDs []string `json:"connectionIds"`
}

// SyncHistoryRequest is the JSON body from POST /api/sessions/:id/sync-history.
type SyncHistoryRequest struct {
	JID string `json:"jid"`
}

// ValidateNumberRequest is the JSON body from POST /api/sessions/:id/validate-number.
type ValidateNumberRequest struct {
	PhoneNumber string `json:"phoneNumber"`
}

// HealthResponse is the JSON response from GET /health.
type HealthResponse struct {
	Status    string       `json:"status"`
	Service   string       `json:"service"`
	Timestamp string       `json:"timestamp"`
	Sessions  SessionStats `json:"sessions"`
}

// SessionStats aggregates session counts.
type SessionStats struct {
	Total    int            `json:"total"`
	ByStatus map[string]int `json:"byStatus"`
}

// SessionStatusResponse is the JSON response from GET /api/sessions/:id/status.
type SessionStatusResponse struct {
	ConnectionID string  `json:"connectionId"`
	Status       string  `json:"status"`
	Phone        *string `json:"phone"`
	QR           *string `json:"qr"`
}

// EnsureSessionResponse is the JSON response from POST /api/sessions/:id/ensure.
type EnsureSessionResponse struct {
	Success bool   `json:"success"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
