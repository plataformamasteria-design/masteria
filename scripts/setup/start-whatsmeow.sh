#!/bin/bash

# Start whatsmeow service using Docker Compose
echo "🚀 Starting whatsmeow WhatsApp service..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start the service
docker-compose -f docker-compose.whatsapp.yml up -d

echo "✅ whatsmeow service started!"
echo ""
echo "📋 Service Information:"
echo "  - API URL: http://localhost:8001"
echo "  - Username: admin"
echo "  - Password: ${WHATSMEOW_PASSWORD:-masterIA2024}"
echo ""
echo "🔗 Access the UI: http://localhost:8001"
echo "📱 Scan QR code to connect WhatsApp"
echo ""
echo "To view logs: docker-compose -f docker-compose.whatsapp.yml logs -f"
echo "To stop: docker-compose -f docker-compose.whatsapp.yml down"
