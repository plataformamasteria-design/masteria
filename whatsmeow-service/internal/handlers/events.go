// Package handlers provides the WhatsMeow event handler.
// This file replaces the Baileys sock.ev.on('messages.upsert') and
// sock.ev.on('connection.update') handlers.
package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"whatsmeow-service/internal/models"
	"whatsmeow-service/internal/store"
	"whatsmeow-service/internal/ws"
)

// EventHandler processes WhatsMeow events for a given session.
type EventHandler struct {
	Session *models.Session
	Emitter *ws.Emitter

	// DeleteFunc is called when a session should be deleted.
	DeleteFunc func(connectionID string)
}

// Handle is registered via client.AddEventHandler and dispatches events.
func (h *EventHandler) Handle(evt interface{}) {
	// 🔍 DEBUG: Log every event type received from WhatsMeow
	evtType := fmt.Sprintf("%T", evt)
	if evtType != "*events.OfflineSyncPreview" && evtType != "*events.OfflineSyncCompleted" {
		log.Debug().
			Str("connectionId", h.Session.ConnectionID).
			Str("eventType", evtType).
			Str("sessionStatus", h.Session.GetStatus()).
			Msg("📥 Event received from WhatsMeow")
	}

	switch v := evt.(type) {
	case *events.Connected:
		h.handleConnected()
	case *events.LoggedOut:
		h.handleLoggedOut(v)
	case *events.Disconnected:
		h.handleDisconnected()
	case *events.StreamError:
		h.handleStreamError()
	case *events.TemporaryBan:
		h.handleTemporaryBan(v)
	case *events.Message:
		h.handleMessage(v)
	case *events.Receipt:
		h.handleReceipt(v)
	case *events.HistorySync:
		h.handleHistorySync(v)
	case *events.QR:
		// QR events are handled separately via GetQRChannel
	}
}

// handleConnected processes a successful connection event.
func (h *EventHandler) handleConnected() {
	// ✅ GUARD: If session was already invalidated (e.g. 401/device removed),
	// do NOT process this Connected event. This prevents a race condition where
	// WhatsMeow fires Connected AFTER LoggedOut, overwriting the "invalid" status.
	currentStatus := h.Session.GetStatus()
	if currentStatus == "invalid" || currentStatus == "failed" {
		log.Warn().
			Str("connectionId", h.Session.ConnectionID).
			Str("currentStatus", currentStatus).
			Msg("⚠️ Connected event received but session is already invalid/failed — ignoring to prevent ghost session")
		return
	}

	// ✅ GUARD 2: Log a warning if Store.ID is nil, but don't block.
	// During first pairing, Store.ID may briefly be nil between reconnects.
	// The real protection is GUARD 1 above (status check).
	if h.Session.Client == nil || h.Session.Client.Store == nil {
		log.Warn().Str("connectionId", h.Session.ConnectionID).Msg("⚠️ Connected event received but client/store is nil — ignoring")
		return
	}

	now := time.Now()
	h.Session.UpdateActivity()
	h.Session.SetStatus("connected")
	h.Session.ConnectedAt = now
	h.Session.RetryCount = 0

	// ✅ Send presence 'available' after a short delay to show "Online" on the phone.
	// Delayed by 5s to let WhatsMeow finalize internal setup (prekeys, SetPassive).
	go func() {
		time.Sleep(5 * time.Second)
		if h.Session.Client != nil && h.Session.Client.IsLoggedIn() && h.Session.GetStatus() == "connected" {
			err := h.Session.Client.SendPresence(context.Background(), types.PresenceAvailable)
			if err != nil {
				log.Warn().Err(err).Str("connectionId", h.Session.ConnectionID).Msg("Failed to send delayed presence")
			} else {
				log.Info().Str("connectionId", h.Session.ConnectionID).Msg("✅ Presence 'available' sent — phone should show Online")
			}
		}
	}()

	// Get phone number from connected device
	phone := ""
	if h.Session.Client != nil && h.Session.Client.Store != nil && h.Session.Client.Store.ID != nil {
		phone = h.Session.Client.Store.ID.User
	}
	h.Session.Phone = phone

	log.Info().
		Str("connectionId", h.Session.ConnectionID).
		Str("phone", phone).
		Msg("✅ Connected (passive mode, like Baileys)")

	// Save device mapping
	if h.Session.Client != nil && h.Session.Client.Store != nil && h.Session.Client.Store.ID != nil {
		if err := store.SaveDeviceMapping(h.Session.ConnectionID, h.Session.Client.Store.ID.String()); err != nil {
			log.Error().Err(err).Msg("Failed to save device mapping")
		}
	}

	// Update database
	isActive := true
	_, err := store.DB.Exec(`
		UPDATE connections SET status = 'connected', phone = $1, qr_code = NULL, 
		is_active = $2, last_connected = $3 WHERE id = $4
	`, phone, isActive, now, h.Session.ConnectionID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update connection status to connected")
	}

	// Emit events
	h.Emitter.EmitConnectionStatusChanged(h.Session.CompanyID, h.Session.ConnectionID, "connected", phone)
	h.Emitter.EmitSessionUpdated(h.Session.CompanyID, models.SessionUpdate{
		ID:            h.Session.ConnectionID,
		Status:        "connected",
		Phone:         phone,
		IsActive:      &isActive,
		LastConnected: &now,
	})

	// Notify SSE listeners
	select {
	case h.Session.StatusChan <- models.StatusEvent{Status: "connected", Phone: phone}:
	default:
	}
}
// handleDisconnected processes a disconnection event.
func (h *EventHandler) handleDisconnected() {
	currentStatus := h.Session.GetStatus()

	// ✅ CRITICAL: If session was already invalidated (401/device removed),
	// do NOT allow WhatsMeow to auto-reconnect. This prevents the
	// "401 → disconnect → reconnect → 401" infinite loop.
	if currentStatus == "invalid" || currentStatus == "failed" || currentStatus == "disconnected" {
		log.Info().
			Str("connectionId", h.Session.ConnectionID).
			Str("status", currentStatus).
			Msg("⏹️ Disconnected but status is terminal — NOT reconnecting")
		return
	}

	if currentStatus == "qr" || currentStatus == "connecting" {
		if h.Session.Client == nil || h.Session.Client.Store.ID == nil {
			log.Info().
				Str("connectionId", h.Session.ConnectionID).
				Str("status", currentStatus).
				Msg("⏸️ Disconnected while awaiting QR — not reconnecting manually")
			h.Session.SetStatus("disconnected")
			return
		}
	}

	// NOTE: We don't call sm.reconnect here anymore.
	// WhatsMeow's internal Connect() loop handles auto-reconnection natively.
	log.Info().
		Str("connectionId", h.Session.ConnectionID).
		Str("status", "connecting").
		Str("action", "auto_reconnect").
		Msg("🔄 Disconnected — letting WhatsMeow handle auto-reconnect")

	h.Session.SetStatus("connecting")
	h.Emitter.EmitConnectionStatusChanged(h.Session.CompanyID, h.Session.ConnectionID, "connecting", "")
}


// handleLoggedOut processes a logout event (equivalent to Baileys 401/403).
func (h *EventHandler) handleLoggedOut(evt *events.LoggedOut) {
	log.Warn().
		Str("connectionId", h.Session.ConnectionID).
		Msg("🛑 Logged out (401/device removed)")

	// ✅ STEP 1: Mark as invalid FIRST (this prevents handleDisconnected from triggering reconnect)
	h.Session.SetStatus("invalid")

	log.Info().Str("connectionId", h.Session.ConnectionID).
		Msg("⚠️ Session flagged as invalid. Manual re-pairing required.")

	// ✅ STEP 2: Update database
	store.DB.Exec(`UPDATE connections SET status = 'invalid', qr_code = NULL WHERE id = $1`, h.Session.ConnectionID)

	// ✅ STEP 3: Emit events to frontend
	h.Emitter.EmitConnectionStatusChanged(h.Session.CompanyID, h.Session.ConnectionID, "invalid", "")
	h.Emitter.EmitSessionUpdated(h.Session.CompanyID, models.SessionUpdate{
		ID:     h.Session.ConnectionID,
		Status: "invalid",
	})

	// ✅ STEP 4: Disconnect the WhatsMeow client to stop auto-reconnect loops.
	if h.Session.Client != nil {
		log.Info().Str("connectionId", h.Session.ConnectionID).
			Msg("🔌 Disconnecting WhatsMeow client to stop auto-reconnect loop")
		h.Session.Client.Disconnect()
	}

	// ✅ BAILEYS PARITY: Do NOT call Store.Delete() here.
	// Baileys NEVER deleted auth state on 401 — it just marked as 'invalid' and cleaned memory.
	// Deleting the crypto store forces a brand new QR pairing every single time,
	// which burns through WhatsApp's device registration rate limit (~5/day).
	// The store will be naturally cleaned up if the user explicitly re-pairs.

	// ✅ STEP 5: Stop internal goroutines via CancelFunc and remove from session manager memory.
	if h.Session.CancelFunc != nil {
		h.Session.CancelFunc()
	}
	if h.DeleteFunc != nil {
		h.DeleteFunc(h.Session.ConnectionID)
	}
}

// handleStreamError processes a stream error.
func (h *EventHandler) handleStreamError() {
	h.Session.UpdateActivity()
	log.Warn().
		Str("connectionId", h.Session.ConnectionID).
		Str("action", "stream_error").
		Msg("🔄 Stream Error — letting WhatsMeow handle it")
}

// handleTemporaryBan processes a temporary ban event.
func (h *EventHandler) handleTemporaryBan(evt *events.TemporaryBan) {
	log.Error().
		Str("connectionId", h.Session.ConnectionID).
		Dur("expire", evt.Expire).
		Msg("⛔ Temporary ban!")
}

// handleMessage processes incoming/outgoing messages.
// This is the equivalent of Baileys sock.ev.on('messages.upsert', {type:'notify'}).
func (h *EventHandler) handleMessage(evt *events.Message) {
	h.Session.UpdateActivity()
	if h.Session.GetStatus() != "connected" {
		return
	}

	// Skip messages without content
	if evt.Message == nil {
		return
	}

	remoteJid := evt.Info.Chat.String()
	fromMe := evt.Info.IsFromMe
	messageID := evt.Info.ID

	// Classify chat — skip groups, newsletters, broadcasts, status
	chatType := classifyChat(remoteJid)
	if chatType != "individual" {
		return
	}

	phoneNumber := evt.Info.Chat.User
	if strings.Contains(remoteJid, "@lid") {
		// Log detailed LID info for debugging
		log.Debug().
			Str("chat", remoteJid).
			Str("sender", evt.Info.Sender.String()).
			Bool("fromMe", fromMe).
			Str("senderAlt", evt.Info.SenderAlt.String()).
			Str("recipientAlt", evt.Info.RecipientAlt.String()).
			Msg("LID Detected, resolving real phone number")
		
		// Map LID to real phone number from WhatsApp Meta metadata
		if !fromMe && evt.Info.SenderAlt.User != "" {
			phoneNumber = evt.Info.SenderAlt.User
			remoteJid = evt.Info.SenderAlt.String()
		} else if fromMe && evt.Info.RecipientAlt.User != "" {
			phoneNumber = evt.Info.RecipientAlt.User
			remoteJid = evt.Info.RecipientAlt.String()
		}
	}

	// Extract message content (and download media if present)
	messageContent, contentType, mediaURL := h.extractMessageContent(evt)
	if messageContent == "" || messageContent == "Mensagem não suportada" {
		return
	}

	// Save to baileys_messages (raw persistence)
	go h.saveRawMessage(evt, messageContent)

	// Process in the application layer (contacts, conversations, messages) via non-blocking goroutine
	go h.processIncomingMessage(evt, phoneNumber, remoteJid, messageContent, contentType, messageID, fromMe, mediaURL)
}

// processIncomingMessage handles the full message pipeline: contact upsert,
// conversation upsert, message save, and Socket.IO emission.
func (h *EventHandler) processIncomingMessage(
	evt *events.Message,
	phoneNumber, remoteJid, messageContent, contentType, messageID string,
	fromMe bool,
	mediaURL string,
) {
	ctx := context.Background()
	connectionID := h.Session.ConnectionID
	companyID := h.Session.CompanyID

	// Check for duplicate in messages table
	var existingID string
	err := store.DB.QueryRowContext(ctx,
		`SELECT id FROM messages WHERE provider_message_id = $1 LIMIT 1`,
		messageID,
	).Scan(&existingID)
	if err == nil {
		return // Already exists
	}

	// Get push name (contact name from WhatsApp)
	pushName := evt.Info.PushName

	// Upsert contact
	contactID, contactName, err := h.upsertContact(ctx, companyID, phoneNumber, pushName, fromMe)
	if err != nil {
		log.Error().Err(err).Str("phone", phoneNumber).Msg("Failed to upsert contact")
		return
	}

	// Upsert conversation
	conversationID, err := h.upsertConversation(ctx, companyID, contactID, connectionID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upsert conversation")
		return
	}

	// Handle fromMe AI message matching (same logic as Baileys)
	if fromMe {
		matched, err := h.matchAIMessage(ctx, companyID, conversationID, messageContent, messageID, evt.Info.Timestamp)
		if err != nil {
			log.Error().Err(err).Msg("Error matching AI message")
		}
		if matched {
			return
		}
	}

	// Save message
	savedMsgID, err := h.saveMessage(ctx, companyID, conversationID, messageID, contactID,
		messageContent, contentType, fromMe, evt.Info.Timestamp, mediaURL)
	if err != nil {
		log.Error().Err(err).Msg("Failed to save message")
		return
	}
	if savedMsgID == "" {
		return
	}

	log.Info().
		Str("phone", phoneNumber).
		Str("msgId", savedMsgID).
		Bool("fromMe", fromMe).
		Msg("Message saved")

	// Emit to MasterIA via Socket.IO (only for incoming messages)
	if !fromMe {
		h.Emitter.EmitIncomingMessage(companyID, models.IncomingMessagePayload{
			ConnectionID:   connectionID,
			ContactPhone:   phoneNumber,
			ContactName:    contactName,
			MessageContent: messageContent,
			MessageType:    contentType,
			MessageID:      savedMsgID,
			ConversationID: conversationID,
			SavedMessageID: savedMsgID,
			IsFromMe:       false,
			MediaURL:       mediaURL,
			RawMsg: map[string]interface{}{
				"pushName":         pushName,
				"messageTimestamp": evt.Info.Timestamp.Unix(),
				"remoteJid":       remoteJid,
			},
		})
	}
}

// saveRawMessage persists the message to baileys_messages table.
func (h *EventHandler) saveRawMessage(evt *events.Message, text string) {
	messageID := evt.Info.ID
	jid := evt.Info.Chat.String()
	fromMe := evt.Info.IsFromMe
	ts := evt.Info.Timestamp.Unix()
	connectionID := h.Session.ConnectionID

	// Try to find conversation ID
	var convID sql.NullString
	phoneNumber := evt.Info.Chat.User
	err := store.DB.QueryRow(`
		SELECT conv.id FROM conversations conv
		JOIN contacts c ON conv.contact_id = c.id
		WHERE c.phone = $1 AND conv.connection_id = $2
		LIMIT 1
	`, phoneNumber, connectionID).Scan(&convID)
	if err != nil {
		convID = sql.NullString{Valid: false}
	}

	_, err = store.DB.Exec(`
		INSERT INTO baileys_messages (id, connection_id, conversation_id, jid, message_id, from_me, timestamp, text, content)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NULL)
		ON CONFLICT (message_id) DO NOTHING
	`, connectionID, convID, jid, messageID, fromMe, ts, text)

	if err != nil {
		log.Error().Err(err).Str("messageId", messageID).Msg("Failed to save raw message")
	}
}

// upsertContact creates or updates a contact.
func (h *EventHandler) upsertContact(ctx context.Context, companyID, phone, pushName string, fromMe bool) (string, string, error) {
	var contactID, contactName string
	var whatsappName sql.NullString
	
	validPushName := ""
	if !fromMe && pushName != "" {
		validPushName = pushName
	}
	
	name := phone
	if validPushName != "" {
		name = validPushName
	}

	// Execute an atomic UPSERT using the unique constraint (phone, company_id).
	// This naturally resolves race conditions and handles revived (soft-deleted) contacts safely.
	err := store.DB.QueryRowContext(ctx,
		`INSERT INTO contacts (id, company_id, name, phone, whatsapp_name, is_group, status, deleted_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, false, 'ACTIVE', NULL)
		ON CONFLICT (phone, company_id) DO UPDATE SET
			deleted_at = NULL,
			status = 'ACTIVE',
			whatsapp_name = COALESCE(EXCLUDED.whatsapp_name, contacts.whatsapp_name),
			name = CASE WHEN contacts.name = contacts.phone AND COALESCE(EXCLUDED.whatsapp_name, contacts.whatsapp_name) IS NOT NULL THEN COALESCE(EXCLUDED.whatsapp_name, contacts.whatsapp_name) ELSE contacts.name END
		RETURNING id, name, whatsapp_name`,
		companyID, name, phone, sql.NullString{String: validPushName, Valid: validPushName != ""},
	).Scan(&contactID, &contactName, &whatsappName)
	
	if err != nil {
		return "", "", fmt.Errorf("upsert contact atomic: %w", err)
	}
	
	// Ensure returned contact name matches the latest database state in memory
	if whatsappName.Valid && whatsappName.String != "" && contactName == phone {
		contactName = whatsappName.String
	}

	return contactID, contactName, nil
}

// upsertConversation creates or updates a conversation.
func (h *EventHandler) upsertConversation(ctx context.Context, companyID, contactID, connectionID string) (string, error) {
	var convID string
	err := store.DB.QueryRowContext(ctx,
		`SELECT id FROM conversations 
		WHERE contact_id = $1 AND connection_id = $2 AND company_id = $3 LIMIT 1`,
		contactID, connectionID, companyID,
	).Scan(&convID)

	if err == sql.ErrNoRows {
		// Create new conversation
		err = store.DB.QueryRowContext(ctx,
			`INSERT INTO conversations (id, company_id, contact_id, connection_id, status, last_message_at, ai_active, contact_type, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, 'NEW', NOW(), true, 'PASSIVE', NOW(), NOW())
			RETURNING id`,
			companyID, contactID, connectionID,
		).Scan(&convID)
		if err != nil {
			return "", fmt.Errorf("insert conversation: %w", err)
		}
	} else if err != nil {
		return "", fmt.Errorf("query conversation: %w", err)
	} else {
		// Update existing conversation
		store.DB.ExecContext(ctx,
			`UPDATE conversations SET last_message_at = NOW(), archived_at = NULL WHERE id = $1`,
			convID,
		)
	}

	return convID, nil
}

// matchAIMessage checks if a fromMe message matches a recent AI message.
func (h *EventHandler) matchAIMessage(ctx context.Context, companyID, conversationID, content, providerMsgID string, timestamp time.Time) (bool, error) {
	normalizedContent := strings.TrimSpace(strings.ToLower(content))

	rows, err := store.DB.QueryContext(ctx,
		`SELECT id, content FROM messages 
		WHERE company_id = $1 AND conversation_id = $2 AND sender_type = 'AI' 
		AND sent_at >= $3 
		ORDER BY sent_at DESC LIMIT 10`,
		companyID, conversationID, time.Now().Add(-60*time.Second),
	)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var msgID, dbContent string
		if err := rows.Scan(&msgID, &dbContent); err != nil {
			continue
		}

		dbNormalized := strings.TrimSpace(strings.ToLower(dbContent))
		if dbNormalized == normalizedContent ||
			(len(dbNormalized) > 10 && strings.Contains(normalizedContent, dbNormalized)) ||
			(len(normalizedContent) > 10 && strings.Contains(dbNormalized, normalizedContent)) {

			_, err := store.DB.ExecContext(ctx,
				`UPDATE messages SET provider_message_id = $1, status = 'sent', sent_at = $2 
				WHERE id = $3`,
				providerMsgID, timestamp.UTC(), msgID,
			)
			if err != nil {
				// 23505 = unique violation — already matched
				if strings.Contains(err.Error(), "23505") {
					return true, nil
				}
				return false, err
			}
			return true, nil
		}
	}

	return false, nil
}

// saveMessage saves a message to the messages table.
func (h *EventHandler) saveMessage(ctx context.Context, companyID, conversationID, providerMsgID, contactID, content, contentType string, fromMe bool, timestamp time.Time, mediaURL string) (string, error) {
	senderType := "CONTACT"
	var senderID *string
	status := "received"

	if fromMe {
		senderType = "AGENT"
		senderID = nil
		status = "sent"
	} else {
		senderID = &contactID
	}

	// Convert empty mediaURL to nil for database
	var mediaURLPtr *string
	if mediaURL != "" {
		mediaURLPtr = &mediaURL
	}

	var savedID string
	err := store.DB.QueryRowContext(ctx,
		`INSERT INTO messages (id, company_id, conversation_id, provider_message_id, sender_type, sender_id, content, content_type, media_url, status, sent_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (provider_message_id) DO NOTHING
		RETURNING id`,
		companyID, conversationID, providerMsgID, senderType, senderID, content, contentType, mediaURLPtr, status, timestamp.UTC(),
	).Scan(&savedID)

	if err == sql.ErrNoRows {
		return "", nil // Duplicate, already existed
	}
	if err != nil {
		return "", fmt.Errorf("insert message: %w", err)
	}

	return savedID, nil
}

// handleReceipt processes delivery receipts (read, delivered, etc.).
func (h *EventHandler) handleReceipt(evt *events.Receipt) {
	h.Session.UpdateActivity()

	var newStatus string
	switch evt.Type {
	case types.ReceiptTypeDelivered:
		newStatus = "delivered"
	case types.ReceiptTypeRead:
		newStatus = "read"
	case types.ReceiptTypeReadSelf:
		newStatus = "read"
	default:
		return
	}

	for _, msgID := range evt.MessageIDs {
		// Atualiza o status da mensagem
		var convID string
		query := `UPDATE messages SET status = $1`
		if newStatus == "read" {
			query += `, read_at = NOW()`
		}
		query += ` WHERE provider_message_id = $2 RETURNING conversation_id`

		err := store.DB.QueryRow(query, newStatus, msgID).Scan(&convID)
		if err != nil {
			if err != sql.ErrNoRows {
				log.Error().Err(err).Str("msgId", msgID).Msg("Failed to update message receipt in DB")
			}
			continue
		}

		// Atualiza o timestamp da conversa para o frontend poder sincronizar via polling
		store.DB.Exec(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, convID)
		
		log.Info().Str("msgId", msgID).Str("status", newStatus).Msg("Message status updated")
	}
}

// handleHistorySync processes historical messages synced from WhatsApp.
// ✅ BAILEYS PARITY: Temporarily disabled DB processing.
// Baileys used syncFullHistory: false and only processed messages < 5 min old.
// We skip all DB writes during initial connection to keep the event pipeline fast.
func (h *EventHandler) handleHistorySync(evt *events.HistorySync) {
	h.Session.UpdateActivity()
	if evt.Data == nil || evt.Data.Conversations == nil {
		return
	}

	totalMessages := 0
	for _, conv := range evt.Data.Conversations {
		totalMessages += len(conv.Messages)
	}

	log.Info().
		Str("connectionId", h.Session.ConnectionID).
		Int("conversations", len(evt.Data.Conversations)).
		Int("totalMessages", totalMessages).
		Msg("📚 History sync received — SKIPPING DB writes for connection stability (Baileys parity)")
}

// ---- Helper functions ----

// classifyChat determines the type of chat based on the JID.
func classifyChat(remoteJid string) string {
	jid := strings.ToLower(remoteJid)

	if strings.Contains(jid, "@g.us") {
		return "group"
	}
	if strings.Contains(jid, "@newsletter") {
		return "newsletter"
	}
	if strings.Contains(jid, "@broadcast") {
		return "broadcast"
	}
	if strings.Contains(jid, "@status") {
		return "status"
	}
	if strings.Contains(jid, "@community") {
		return "community"
	}
	if strings.Contains(jid, "@s.whatsapp.net") || strings.Contains(jid, "@lid") {
		return "individual"
	}

	return "unknown"
}

// extractMessageContent extracts text content, type, and optional media URL from a WhatsMeow message event.
func (h *EventHandler) extractMessageContent(evt *events.Message) (string, string, string) {
	msg := evt.Message

	// Unwrap Ephemeral, ViewOnce or DocumentWithCaption wrappers
	if msg.GetEphemeralMessage() != nil && msg.GetEphemeralMessage().GetMessage() != nil {
		msg = msg.GetEphemeralMessage().GetMessage()
	} else if msg.GetViewOnceMessage() != nil && msg.GetViewOnceMessage().GetMessage() != nil {
		msg = msg.GetViewOnceMessage().GetMessage()
	} else if msg.GetViewOnceMessageV2() != nil && msg.GetViewOnceMessageV2().GetMessage() != nil {
		msg = msg.GetViewOnceMessageV2().GetMessage()
	} else if msg.GetViewOnceMessageV2Extension() != nil && msg.GetViewOnceMessageV2Extension().GetMessage() != nil {
		msg = msg.GetViewOnceMessageV2Extension().GetMessage()
	} else if msg.GetDocumentWithCaptionMessage() != nil && msg.GetDocumentWithCaptionMessage().GetMessage() != nil {
		msg = msg.GetDocumentWithCaptionMessage().GetMessage()
	}

	if msg.GetConversation() != "" {
		return msg.GetConversation(), "TEXT", ""
	}
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		return ext.GetText(), "TEXT", ""
	}
	if img := msg.GetImageMessage(); img != nil {
		caption := img.GetCaption()
		if caption == "" {
			caption = "📷 Imagem"
		}
		// Download image and serve locally
		mediaURL := h.downloadAndServeMedia(img, img.GetMimetype(), "jpg")
		return caption, "IMAGE", mediaURL
	}
	if vid := msg.GetVideoMessage(); vid != nil {
		caption := vid.GetCaption()
		if caption == "" {
			caption = "📹 Vídeo"
		}
		// Download video and serve locally
		mediaURL := h.downloadAndServeMedia(vid, vid.GetMimetype(), "mp4")
		return caption, "VIDEO", mediaURL
	}
	if audioMsg := msg.GetAudioMessage(); audioMsg != nil {
		mimeType := audioMsg.GetMimetype()
		if mimeType == "" {
			mimeType = "audio/ogg" // default WhatsApp voice note format
		}
		// Baixa e salva o áudio no storage local (ou S3) do microserviço e retorna a URL
		mediaURL := h.downloadAndServeMedia(audioMsg, mimeType, "ogg")
		return "🎵 Áudio", "AUDIO", mediaURL
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		filename := doc.GetFileName()
		if filename == "" {
			filename = "documento"
		}
		caption := doc.GetCaption()
		if caption == "" {
			caption = fmt.Sprintf("📄 %s", filename)
		}
		return caption, "DOCUMENT", ""
	}
	if msg.GetStickerMessage() != nil {
		// Download sticker and serve locally
		mediaURL := h.downloadAndServeMedia(msg.GetStickerMessage(), msg.GetStickerMessage().GetMimetype(), "webp")
		return "🎨 Sticker", "STICKER", mediaURL
	}
	if loc := msg.GetLocationMessage(); loc != nil {
		name := loc.GetName()
		if name == "" {
			name = "Localização"
		}
		lat := loc.GetDegreesLatitude()
		lng := loc.GetDegreesLongitude()
		if lat != 0 && lng != 0 {
			return fmt.Sprintf("📍 %s (%.6f, %.6f)", name, lat, lng), "TEXT", ""
		}
		return fmt.Sprintf("📍 %s", name), "TEXT", ""
	}
	if contact := msg.GetContactMessage(); contact != nil {
		displayName := contact.GetDisplayName()
		if displayName == "" {
			displayName = "Contato"
		}
		return fmt.Sprintf("👤 %s", displayName), "TEXT", ""
	}

	return "Mensagem não suportada", "TEXT", ""
}

// MediaDir is the directory where downloaded media files are temporarily stored.
// Exported so main.go can use it to serve files and run cleanup.
var MediaDir = filepath.Join(os.TempDir(), "whatsmeow-media")

func init() {
	if err := os.MkdirAll(MediaDir, 0755); err != nil {
		log.Error().Err(err).Str("dir", MediaDir).Msg("Failed to create media directory")
	}
}

// downloadAndServeMedia downloads media from WhatsApp, saves it to disk,
// and returns a URL where MasterIA can fetch it.
func (h *EventHandler) downloadAndServeMedia(msg whatsmeow.DownloadableMessage, mimeType, fallbackExt string) string {
	if h.Session.Client == nil {
		return ""
	}

	data, err := h.Session.Client.Download(context.Background(), msg)
	if err != nil {
		log.Error().Err(err).Msg("Failed to download media from WhatsApp")
		return ""
	}

	if len(data) == 0 {
		log.Warn().Msg("Downloaded media is empty")
		return ""
	}

	// Determine file extension from mime type
	ext := fallbackExt
	switch {
	case strings.Contains(mimeType, "jpeg") || strings.Contains(mimeType, "jpg"):
		ext = "jpg"
	case strings.Contains(mimeType, "png"):
		ext = "png"
	case strings.Contains(mimeType, "webp"):
		ext = "webp"
	case strings.Contains(mimeType, "gif"):
		ext = "gif"
	case strings.Contains(mimeType, "mp4"):
		ext = "mp4"
	case strings.Contains(mimeType, "3gpp"):
		ext = "3gp"
	}

	filename := uuid.New().String() + "." + ext
	filePath := filepath.Join(MediaDir, filename)

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		log.Error().Err(err).Str("path", filePath).Msg("Failed to write media file")
		return ""
	}

	log.Info().
		Str("file", filename).
		Int("size", len(data)).
		Str("mime", mimeType).
		Msg("📸 Media downloaded and saved")

	// Build the URL using the service's own port and domain
	publicURL := os.Getenv("PUBLIC_URL")
	if publicURL == "" {
		// Fallback to Railway domain if present, otherwise default to 127.0.0.1 for local dev
		domain := os.Getenv("RAILWAY_PUBLIC_DOMAIN")
		if domain == "" {
			domain = "baileysservice-production.up.railway.app" // Production default
		}
		
		// Logic to decide between local dev (127.0.0.1) and production
		if os.Getenv("RAILWAY_ENVIRONMENT") == "" {
			port := os.Getenv("PORT")
			if port == "" {
				port = "3001"
			}
			return fmt.Sprintf("http://127.0.0.1:%s/media/%s", port, filename)
		}
		
		return fmt.Sprintf("https://%s/media/%s", domain, filename)
	}
	
	return fmt.Sprintf("%s/media/%s", publicURL, filename)
}

// FormatJID is now in models.FormatJID — this is just a convenience re-export.
// (kept to avoid breaking any internal call sites)

