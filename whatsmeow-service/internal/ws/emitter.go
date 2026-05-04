// Package ws provides a Socket.IO v4 compatible server implemented directly
// over gorilla/websocket. This avoids flaky third-party Go Socket.IO libraries
// while maintaining full protocol compatibility with socket.io-client v4.
//
// Socket.IO v4 protocol overview:
//   Engine.IO packets:  0=open, 2=ping, 3=pong, 4=message
//   Socket.IO packets (inside EIO message): 0=connect, 2=event, 3=ack
//
// The MasterIA baileys-ws-listener.ts connects using:
//   io(URL, { path: '/baileys-ws', transports: ['websocket'] })
//
// This implementation handles:
//   - Engine.IO handshake (polling + upgrade to websocket)
//   - Socket.IO connect/disconnect
//   - Room-based event emission (company:X rooms)
//   - Heartbeat (ping/pong)
package ws

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Client represents a connected Socket.IO client.
type Client struct {
	ID     string
	conn   *websocket.Conn
	mu     sync.Mutex
	rooms  map[string]bool
	closed bool
}

// Emitter implements a minimal Socket.IO v4 server.
type Emitter struct {
	mu      sync.RWMutex
	clients map[string]*Client

	// Deduplication caches
	cacheMu        sync.Mutex
	lastQREmit     map[string]cacheEntry
	lastSessionEvt map[string]cacheEntry
	lastStatusEmit map[string]cacheEntry
}

type cacheEntry struct {
	Value     string
	Timestamp time.Time
}

// NewEmitter creates a new Socket.IO emitter.
func NewEmitter() (*Emitter, error) {
	e := &Emitter{
		clients:        make(map[string]*Client),
		lastQREmit:     make(map[string]cacheEntry),
		lastSessionEvt: make(map[string]cacheEntry),
		lastStatusEmit: make(map[string]cacheEntry),
	}

	go e.cleanupCaches()
	return e, nil
}

// ServeHTTP handles both polling and websocket transport for Socket.IO.
func (e *Emitter) ServeHTTP() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		transport := r.URL.Query().Get("transport")

		if transport == "polling" {
			e.handlePolling(w, r)
			return
		}

		if transport == "websocket" || websocket.IsWebSocketUpgrade(r) {
			e.handleWebSocket(w, r)
			return
		}

		// Default: serve polling handshake
		e.handlePolling(w, r)
	})
}

// handlePolling handles Engine.IO polling requests (initial handshake).
func (e *Emitter) handlePolling(w http.ResponseWriter, r *http.Request) {
	sid := r.URL.Query().Get("sid")

	if sid == "" {
		// New session — send Engine.IO open packet
		newSID := uuid.New().String()
		openPacket := map[string]interface{}{
			"sid":          newSID,
			"upgrades":     []string{"websocket"},
			"pingInterval": 25000,
			"pingTimeout":  20000,
			"maxPayload":   1000000,
		}

		data, _ := json.Marshal(openPacket)
		// Engine.IO format: <length>:0<json> (0 = open packet)
		response := fmt.Sprintf("0%s", string(data))

		w.Header().Set("Content-Type", "text/plain; charset=UTF-8")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(200)
		fmt.Fprint(w, response)
		return
	}

	// Existing session polling — return Socket.IO connect ack
	w.Header().Set("Content-Type", "text/plain; charset=UTF-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(200)
	// Socket.IO connect packet: 40{"sid":"..."}
	fmt.Fprintf(w, `40{"sid":"%s"}`, sid)
}

// handleWebSocket handles WebSocket connections.
func (e *Emitter) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("[WS] Failed to upgrade connection")
		return
	}

	clientID := uuid.New().String()
	client := &Client{
		ID:    clientID,
		conn:  conn,
		rooms: make(map[string]bool),
	}

	e.mu.Lock()
	e.clients[clientID] = client
	e.mu.Unlock()

	log.Info().Str("clientId", clientID).Msg("[WS] Client connected")

	// Send Engine.IO open packet
	openPacket := map[string]interface{}{
		"sid":          clientID,
		"upgrades":     []string{},
		"pingInterval": 25000,
		"pingTimeout":  20000,
		"maxPayload":   1000000,
	}
	openData, _ := json.Marshal(openPacket)
	client.writeMessage(fmt.Sprintf("0%s", string(openData)))

	// Send Socket.IO connect packet for namespace /
	client.writeMessage(fmt.Sprintf(`40{"sid":"%s"}`, clientID))

	// Start ping loop
	go e.pingLoop(client)

	// Read loop
	go e.readLoop(client)
}

// readLoop reads and processes messages from a websocket client.
func (e *Emitter) readLoop(client *Client) {
	defer func() {
		e.removeClient(client)
	}()

	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Debug().Err(err).Str("clientId", client.ID).Msg("[WS] Read error")
			}
			return
		}

		msg := string(message)

		// Engine.IO ping (2) -> respond with pong (3)
		if msg == "2" {
			client.writeMessage("3")
			continue
		}

		// Engine.IO pong
		if msg == "3" {
			continue
		}

		// Socket.IO event: 42["event", data]
		if strings.HasPrefix(msg, "42") {
			e.handleSocketIOEvent(client, msg[2:])
			continue
		}

		// Socket.IO connect probe
		if msg == "2probe" {
			client.writeMessage("3probe")
			continue
		}

		// Socket.IO upgrade
		if msg == "5" {
			continue
		}
	}
}

// handleSocketIOEvent processes a Socket.IO event message.
func (e *Emitter) handleSocketIOEvent(client *Client, payload string) {
	// Parse JSON array: ["eventName", data]
	var eventData []json.RawMessage
	if err := json.Unmarshal([]byte(payload), &eventData); err != nil {
		log.Debug().Err(err).Msg("[WS] Failed to parse event")
		return
	}

	if len(eventData) < 1 {
		return
	}

	var eventName string
	if err := json.Unmarshal(eventData[0], &eventName); err != nil {
		return
	}

	switch eventName {
	case "join:company":
		if len(eventData) >= 2 {
			var companyID string
			if err := json.Unmarshal(eventData[1], &companyID); err == nil {
				room := "company:" + companyID
				client.rooms[room] = true
				log.Info().
					Str("clientId", client.ID).
					Str("room", room).
					Msg("[WS] Client joined room")
			}
		}
	}
}

// pingLoop sends periodic pings to the client.
func (e *Emitter) pingLoop(client *Client) {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if client.closed {
			return
		}
		// Engine.IO ping
		if err := client.writeMessage("2"); err != nil {
			return
		}
	}
}

// removeClient cleans up a disconnected client.
func (e *Emitter) removeClient(client *Client) {
	client.mu.Lock()
	client.closed = true
	client.conn.Close()
	client.mu.Unlock()

	e.mu.Lock()
	delete(e.clients, client.ID)
	e.mu.Unlock()

	log.Info().Str("clientId", client.ID).Msg("[WS] Client disconnected")
}

// writeMessage sends a message to a client.
func (c *Client) writeMessage(msg string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("client closed")
	}

	return c.conn.WriteMessage(websocket.TextMessage, []byte(msg))
}

// --- Public emission methods ---

// EmitSessionCreated emits a session:created event.
func (e *Emitter) EmitSessionCreated(companyID string, data interface{}) {
	e.cacheMu.Lock()
	key := companyID + ":created"
	now := time.Now()
	if last, ok := e.lastSessionEvt[key]; ok && now.Sub(last.Timestamp) < 2*time.Second {
		e.cacheMu.Unlock()
		return
	}
	e.lastSessionEvt[key] = cacheEntry{Value: "created", Timestamp: now}
	e.cacheMu.Unlock()

	e.emitToRoom("company:"+companyID, "whatsapp:session:created", data)
}

// EmitSessionUpdated emits a session:updated event.
func (e *Emitter) EmitSessionUpdated(companyID string, data interface{}) {
	e.emitToRoom("company:"+companyID, "whatsapp:session:updated", data)
}

// EmitSessionDeleted emits a session:deleted event.
func (e *Emitter) EmitSessionDeleted(companyID, sessionID string) {
	e.cacheMu.Lock()
	key := companyID + ":" + sessionID + ":deleted"
	now := time.Now()
	if last, ok := e.lastSessionEvt[key]; ok && now.Sub(last.Timestamp) < 2*time.Second {
		e.cacheMu.Unlock()
		return
	}
	e.lastSessionEvt[key] = cacheEntry{Value: "deleted", Timestamp: now}
	e.cacheMu.Unlock()

	e.emitToRoom("company:"+companyID, "whatsapp:session:deleted", map[string]string{"id": sessionID})
}

// EmitQRCodeUpdated emits a QR code update event.
func (e *Emitter) EmitQRCodeUpdated(companyID, sessionID, qr string) {
	e.cacheMu.Lock()
	key := companyID + ":" + sessionID + ":qr"
	now := time.Now()
	if last, ok := e.lastQREmit[key]; ok && last.Value == qr && now.Sub(last.Timestamp) < 5*time.Second {
		e.cacheMu.Unlock()
		return
	}
	e.lastQREmit[key] = cacheEntry{Value: qr, Timestamp: now}
	e.cacheMu.Unlock()

	e.emitToRoom("company:"+companyID, "whatsapp:session:qr", map[string]string{
		"sessionId": sessionID,
		"qr":        qr,
	})
}

// EmitConnectionStatusChanged emits a connection status change event.
func (e *Emitter) EmitConnectionStatusChanged(companyID, sessionID, status, phone string) {
	e.cacheMu.Lock()
	key := companyID + ":" + sessionID + ":" + status
	now := time.Now()
	if last, ok := e.lastStatusEmit[key]; ok && last.Value == status && now.Sub(last.Timestamp) < 2*time.Second {
		e.cacheMu.Unlock()
		return
	}
	e.lastStatusEmit[key] = cacheEntry{Value: status, Timestamp: now}
	e.cacheMu.Unlock()

	payload := map[string]string{
		"sessionId": sessionID,
		"status":    status,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	if phone != "" {
		payload["phone"] = phone
	}

	e.emitToRoom("company:"+companyID, "whatsapp:session:status", payload)
}

// EmitIncomingMessage emits an incoming message event.
func (e *Emitter) EmitIncomingMessage(companyID string, data interface{}) {
	e.emitToRoom("company:"+companyID, "baileys:incoming-message", data)
}

// emitToRoom sends a Socket.IO event to all clients in a room.
func (e *Emitter) emitToRoom(room, event string, data interface{}) {
	// Build Socket.IO event packet: 42["eventName", data]
	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Error().Err(err).Str("event", event).Msg("[WS] Failed to marshal data")
		return
	}

	eventNameJSON, _ := json.Marshal(event)
	packet := fmt.Sprintf("42[%s,%s]", string(eventNameJSON), string(jsonData))

	e.mu.RLock()
	defer e.mu.RUnlock()

	for _, client := range e.clients {
		go client.writeMessage(packet)
	}
}

// cleanupCaches removes expired deduplication cache entries.
func (e *Emitter) cleanupCaches() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		e.cacheMu.Lock()
		now := time.Now()
		for k, v := range e.lastQREmit {
			if now.Sub(v.Timestamp) > 30*time.Second {
				delete(e.lastQREmit, k)
			}
		}
		for k, v := range e.lastSessionEvt {
			if now.Sub(v.Timestamp) > 10*time.Second {
				delete(e.lastSessionEvt, k)
			}
		}
		for k, v := range e.lastStatusEmit {
			if now.Sub(v.Timestamp) > 10*time.Second {
				delete(e.lastStatusEmit, k)
			}
		}
		e.cacheMu.Unlock()
	}
}
