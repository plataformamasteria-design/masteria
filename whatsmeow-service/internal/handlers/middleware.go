// Package handlers provides HTTP middleware and request handlers.
package handlers

import (
	"net/http"
	"os"

	"github.com/rs/zerolog/log"
)

// APIKeyAuth is middleware that verifies the x-api-key header.
// Matches the behavior of the original Baileys service.
func APIKeyAuth(next http.Handler) http.Handler {
	apiKey := os.Getenv("BAILEYS_SERVICE_API_KEY")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// No API key configured = allow all (dev mode)
		if apiKey == "" {
			next.ServeHTTP(w, r)
			return
		}

		providedKey := r.Header.Get("x-api-key")
		if providedKey == "" {
			providedKey = r.URL.Query().Get("apiKey")
		}

		if providedKey != apiKey {
			log.Warn().Str("path", r.URL.Path).Msg("Unauthorized request - invalid API key")
			http.Error(w, `{"error":"Unauthorized: Invalid API key"}`, http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}
