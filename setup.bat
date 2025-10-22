@echo off
REM Drink Tracker - Local Development Setup Script (Windows)
REM This script sets up everything you need to run the app locally

echo.
echo 🍺 Drink Tracker - Local Setup
echo ================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed!
    echo    Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed!
    echo    Please install Docker Compose from: https://docs.docker.com/compose/install/
    exit /b 1
)

echo ✓ Docker is installed

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo ✓ Created .env file
) else (
    echo ✓ .env file already exists
)

REM Create uploads directory
if not exist uploads\avatars mkdir uploads\avatars
echo ✓ Created uploads directory

REM Start PostgreSQL database
echo.
echo Starting PostgreSQL database...
docker-compose up -d

REM Wait for database to be ready
echo Waiting for database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo ================================
echo ✅ Setup complete!
echo.
echo You can now run the app with:
echo   npm run dev
echo.
echo Useful commands:
echo   npm run dev          - Start the app
echo   docker-compose logs  - View database logs
echo   docker-compose stop  - Stop the database
echo   docker-compose down  - Stop and remove the database
echo.
