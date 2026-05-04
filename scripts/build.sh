#!/bin/bash
echo "Starting build process..."

echo "Installing dependencies with legacy peer deps..."
npm install --legacy-peer-deps

echo "Building Next.js application..."
npm run build

echo "Build completed successfully!"