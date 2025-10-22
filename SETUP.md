# 🍺 Drink Tracker - Local Development Setup

This guide will help you set up and run the Drink Tracker app on your local machine.

## Prerequisites

You need to have installed:
- **Node.js 20+** - [Download here](https://nodejs.org/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
  - Docker is used to run PostgreSQL locally without installing it on your system

## Quick Start (Recommended)

### Option 1: Automated Setup Script

#### On Mac/Linux:
```bash
# Make the script executable
chmod +x setup.sh

# Run the setup script
./setup.sh

# Start the app
npm run dev
```

#### On Windows:
```cmd
# Run the setup script
setup.bat

# Start the app
npm run dev
```

The setup script will:
- ✓ Check if Docker is installed
- ✓ Create your `.env` file from the template
- ✓ Create the uploads directory for avatar photos
- ✓ Start the PostgreSQL database
- ✓ Wait for the database to be ready

### Option 2: Manual Setup

If you prefer to set things up manually:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start the database:**
   ```bash
   docker-compose up -d
   ```

4. **Start the app:**
   ```bash
   npm run dev
   ```

## Database Management

### Start the database:
```bash
docker-compose up -d
```

### Stop the database:
```bash
docker-compose stop
```

### View database logs:
```bash
docker-compose logs -f postgres
```

### Reset the database (deletes all data):
```bash
docker-compose down -v
docker-compose up -d
```

### Connect to the database (for debugging):
```bash
docker-compose exec postgres psql -U drinktracker -d drinktracker
```

## Environment Variables

The `.env` file contains:
- `DATABASE_URL` - PostgreSQL connection string (pre-configured for local Docker)
- `PORT` - Server port (default: 5000)
- `SNAPSHOT_INTERVAL_SEC` - How often to save snapshots (default: 120 seconds)
- `SESSION_SECRET` - Optional, will be auto-generated if not provided

## Accessing the App

Once running, open your browser to:
- Dashboard: http://localhost:5000/dashboard
- Control Panel: http://localhost:5000/control
- Join Page: http://localhost:5000/join

## Troubleshooting

### "DATABASE_URL not set" error
Make sure you've created the `.env` file:
```bash
cp .env.example .env
```

### "Connection refused" database error
The PostgreSQL database might not be running. Start it with:
```bash
docker-compose up -d
```

### Port 5432 already in use
You might have PostgreSQL installed locally. Either:
1. Stop your local PostgreSQL: `brew services stop postgresql` (Mac) or similar
2. Change the port in `docker-compose.yml` (e.g., `"5433:5432"`) and update `DATABASE_URL` in `.env`

### Uploads directory errors
Create the directory manually:
```bash
mkdir -p uploads/avatars
```

## Development Workflow

**First time setup:**
```bash
./setup.sh        # or setup.bat on Windows
npm run dev       # Start the app
```

**Daily development:**
```bash
docker-compose up -d   # Start database (if not running)
npm run dev            # Start the app
```

**When finished:**
```bash
docker-compose stop    # Stop database (optional)
```

## Running on Replit

On Replit, you don't need Docker or these setup steps! The `DATABASE_URL` is automatically provided. Just:
```bash
npm run dev
```

## Data Persistence

- **Local**: Data is stored in Docker volumes and survives container restarts
- **Snapshots**: Automatic snapshots are saved to `./snapshots/` every 2 minutes
- **Sessions**: Stored in PostgreSQL and survive server restarts (24-hour expiry)
- **Uploads**: Avatar photos stored in `./uploads/avatars/` directory

## Need Help?

- Check the main README for app features and usage
- View Docker logs: `docker-compose logs`
- View app logs: Check the terminal where `npm run dev` is running
