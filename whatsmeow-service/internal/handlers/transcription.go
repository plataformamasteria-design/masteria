package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"mime/multipart"
	"net/textproto"

	"github.com/rs/zerolog/log"
)

// transcribeAudioGemini calls the Google Gemini API to transcribe an audio buffer.
func transcribeAudioGemini(audioBytes []byte, mimeType string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not configured")
	}

	audioBase64 := base64.StdEncoding.EncodeToString(audioBytes)

	// Strip codecs or parameters from mimeType (e.g., "audio/ogg; codecs=opus" -> "audio/ogg")
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = mimeType[:idx]
	}

	// Build the JSON payload
	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{
						"inlineData": map[string]interface{}{
							"mimeType": mimeType,
							"data":     audioBase64,
						},
					},
					{
						"text": "Transcreva este áudio exatamente como foi falado. Se houver silêncio ou apenas ruído, responda apenas '[Sem fala detectada]'. Não adicione comentários, apenas a transcrição.",
					},
				},
			},
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal gemini payload: %w", err)
	}

	modelName := "gemini-2.0-flash"
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, apiKey)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	
	// If there's a network error OR a non-200 status code (like 404 Model Not Found), trigger fallback
	if err != nil || resp.StatusCode != http.StatusOK {
		var statusErr string
		if resp != nil {
			statusErr = fmt.Sprintf("status %d", resp.StatusCode)
		} else {
			statusErr = err.Error()
		}
		
		modelName = "gemini-1.5-flash-latest" // Reliable fallback
		log.Warn().Msgf("Failed with gemini-2.0-flash (%s). Trying fallback to %s", statusErr, modelName)
		
		// If response existed, close the old body before replacing it
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
		
		url = fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, apiKey)
		req, _ = http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		
		resp, err = client.Do(req)
		if err != nil {
			log.Warn().Err(err).Msg("Gemini fallback network request failed. Trying OpenAI Whisper...")
			return transcribeAudioOpenAI(audioBytes, mimeType)
		}
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to read Gemini response. Trying OpenAI Whisper...")
		return transcribeAudioOpenAI(audioBytes, mimeType)
	}

	if resp.StatusCode != http.StatusOK {
		log.Warn().Msgf("Gemini API error (status %d): %s. Trying OpenAI Whisper...", resp.StatusCode, string(bodyBytes))
		return transcribeAudioOpenAI(audioBytes, mimeType)
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return "", fmt.Errorf("failed to parse gemini response: %w", err)
	}

	if len(result.Candidates) > 0 && len(result.Candidates[0].Content.Parts) > 0 {
		return result.Candidates[0].Content.Parts[0].Text, nil
	}

	return "[Transcrição vazia]", nil
}

// transcribeAudioOpenAI calls the OpenAI Whisper API as a fallback.
func transcribeAudioOpenAI(audioBytes []byte, mimeType string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini failed and OPENAI_API_KEY not configured for fallback")
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	
	// Determine extension based on mimeType
	ext := ".ogg"
	if strings.Contains(mimeType, "mp4") || strings.Contains(mimeType, "m4a") {
		ext = ".m4a"
	} else if strings.Contains(mimeType, "mpeg") {
		ext = ".mp3"
	} else if strings.Contains(mimeType, "webm") {
		ext = ".webm"
	} else if strings.Contains(mimeType, "wav") {
		ext = ".wav"
	}
	filename := "audio" + ext

	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	h.Set("Content-Type", mimeType)
	part, err := writer.CreatePart(h)
	if err != nil {
		return "", fmt.Errorf("failed to create multipart for openai: %w", err)
	}
	part.Write(audioBytes)

	_ = writer.WriteField("model", "whisper-1")
	// Optional: add "language" field if you want to force PT-BR, but whispered auto-detect is good.

	err = writer.Close()
	if err != nil {
		return "", fmt.Errorf("failed to close multipart: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/audio/transcriptions", body)
	if err != nil {
		return "", fmt.Errorf("failed to create openai request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai network request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read openai response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai API error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return "", fmt.Errorf("failed to parse openai response: %w", err)
	}

	if result.Text == "" {
		return "[Transcrição vazia via Whisper]", nil
	}

	return result.Text, nil
}
