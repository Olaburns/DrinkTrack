#!/bin/bash

# Drink Tracker - Local Development Setup Script
# This script sets up everything you need to run the app locally

echo "🍺 Drink Tracker - Local Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "   Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    echo "   Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker is installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ Created .env file"
else
    echo "✓ .env file already exists"
fi

# Create uploads directory
mkdir -p uploads/avatars
echo "✓ Created uploads directory"

# Start PostgreSQL database
echo ""
echo "Starting PostgreSQL database..."
docker-compose up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 3

# Check if database is healthy
if docker-compose ps | grep -q "healthy"; then
    echo "✓ Database is ready!"
else
    echo "⏳ Database is starting (this may take a moment)..."
    sleep 5
fi

echo ""
echo "================================"
echo "✅ Setup complete!"
echo ""
echo "You can now run the app with:"
echo "  npm run dev"
echo ""
echo "Useful commands:"
echo "  npm run dev          - Start the app"
echo "  docker-compose logs  - View database logs"
echo "  docker-compose stop  - Stop the database"
echo "  docker-compose down  - Stop and remove the database"
echo ""
