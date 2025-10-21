# Drink Tracker - LAN-Reachable Bar Night App

## Overview
A zero-friction, real-time drink tracking application designed for bar nights and social gatherings. Features two simultaneously accessible views - a live dashboard for monitoring consumption and a touch-friendly control panel for logging drinks.

## Purpose
Track consumed drinks over time during social events with live visualization, event markers, and automatic crash protection via snapshots. Multiple people can access the app on the same network simultaneously.

## Current State
✅ **Fully Functional MVP with Prediction Game** - All features implemented and tested
- Express server with Server-Sent Events (SSE) for sub-second real-time updates
- In-memory storage with automatic snapshots every 120 seconds
- Premium dark theme UI with glass morphism effects
- ECharts-powered live time-series visualization
- LAN accessibility with network URL detection
- **NEW**: Multi-participant prediction game with awards system

## Recent Changes
**2025-10-21**: Security improvements
- Added express-session for proper server-side authentication
- Protected /api/matrix-data endpoint with session-based authentication middleware
- Fixed client-side only passcode protection vulnerability
- Session persists for 24 hours with httpOnly, sameSite cookies

**2025-10-21**: Participant prediction game system
- Added participant registration via /join page (name, avatar, self-estimate)
- Created predictions system allowing participants to predict others' totals
- Implemented password-protected matrix view showing all predictions
- Added German-labeled awards system (Kotzstempel, Spülsüchtigen, Stille Wasser, Schwarzer Peter)
- Added QR code to dashboard for easy participant joining via mobile devices
- Participant-specific drink tracking with localStorage session management
- Real-time updates via SSE for participants and predictions
- Lock/unlock mechanism to freeze predictions before reveal

## Recent Changes
**2025-10-20**: Quality improvements
- Fixed double-drink bug by adding 300ms debounce protection and converting from inline onclick to addEventListener
- Updated dashboard legend styling to use chart colors for borders (visual consistency)
- Added color selector to event creation form with 12 color options
- Event markers now display in user-selected colors on dashboard

**2025-10-20**: Core features
- Added navigation buttons to switch between dashboard and control views
- Implemented cumulative/normal mode toggle on dashboard with localStorage persistence
- Fixed event marker visibility by mapping timestamps to nearest bucket timestamps
- All features tested and working correctly

**2025-10-20**: Initial implementation
- Created vanilla JavaScript + Express server (no React/bundler per user requirements)
- Implemented SSE real-time updates with heartbeat
- Built premium dark theme dashboard and control panel
- Added snapshot system with atomic writes and retention policy

## Project Architecture

### Backend (server.js)
- **Express server** binding to `0.0.0.0:5000`
- **In-memory storage**: drinks, consumptions, events, participants, predictions, eventSettings
- **SSE endpoint** (`/events`) for real-time push updates
- **Session management**: express-session with httpOnly cookies for matrix authentication
- **Snapshot system**: 
  - Automatic snapshots every 120s
  - Atomic writes (temp file → rename)
  - Retention: last 30 snapshots
  - Auto-restore on startup

### Frontend (public/)
- **Vanilla JavaScript** with libraries via CDN (no bundler)
- **dashboard.html**: Live time-series chart with ECharts
  - 60-minute rolling window with minute buckets
  - Stacked area chart with smooth curves
  - Event markers as vertical lines with labels
  - Live indicator with pulse animation
  - Legend with emoji/avatar support
- **control.html**: Touch-optimized interface
  - Large drink buttons (6 seeded defaults)
  - Add custom drinks (name, emoji, imageUrl, color)
  - Add event markers
  - Toast notifications
  - Keyboard shortcuts (1-6 for first 6 drinks)
- **styles.css**: Premium dark theme
  - Glass morphism effects with backdrop blur
  - Responsive grid layouts
  - Subtle animations and micro-interactions
  - HSL color system with semantic tokens

### Data Model
```javascript
// Drinks
{ name: string, emoji?: string, imageUrl?: string, color?: string }

// Consumptions
{ drinkName: string, participantId?: string, at: Date }

// Events
{ label: string, color?: string, at: Date }

// Participants
{ id: string, name: string, avatar?: string, selfEstimate: number }

// Predictions
{ id: string, predictorId: string, targetId: string, predictedDrinks: number }

// Event Settings
{ passcodeHash: string | null, predictionsLocked: boolean }
```

### API Endpoints
**Pages**
- `GET /` → redirect to /dashboard
- `GET /dashboard` → dashboard view
- `GET /control` → control panel view
- `GET /join` → participant registration page
- `GET /predictions` → predictions page
- `GET /matrix` → password-protected matrix view
- `GET /awards` → awards display page

**API - Core Functionality**
- `GET /events` → SSE stream (stats, consumption, event, participant-*, prediction-*, heartbeat)
- `GET /drinks` → list all drinks
- `POST /drinks` → create new drink
- `POST /consume` → record consumption (with optional participantId)
- `POST /event` → create event marker

**API - Participants & Predictions**
- `GET /api/participants` → list all participants
- `POST /api/participants` → register participant
- `PATCH /api/participants/:id` → update participant
- `GET /api/predictions` → list all predictions
- `POST /api/predictions` → save prediction
- `GET /api/event-settings` → get settings (predictionsLocked, hasPasscode)
- `POST /api/event-settings/lock-predictions` → lock/unlock predictions

**API - Matrix & Awards (Protected)**
- `POST /api/passcode` → set matrix passcode (authenticates session)
- `POST /api/passcode/verify` → verify passcode (authenticates session)
- `GET /api/matrix-data` → get matrix data (requires authentication)
- `GET /api/awards` → compute and return awards

**API - Snapshots**
- `POST /api/snapshot` → force snapshot
- `GET /api/snapshot/latest` → download latest snapshot
- `POST /api/snapshot/restore` → restore from latest snapshot

## User Preferences
- **Tech Stack**: Node.js 20 + Express + vanilla JS (no React/bundler)
- **UI Style**: Premium dark theme with glass morphism
- **Real-time**: Sub-1-second latency via SSE
- **Network Access**: LAN-reachable for multiple users
- **Data Persistence**: In-memory with snapshot-based crash protection

## Key Features
1. **Real-time Updates**: SSE broadcasts consumption/event changes to all connected clients
2. **Dual Views**: Dashboard and control panel can run simultaneously on different devices
3. **Navigation Buttons**: Easy switching between dashboard and control panel
4. **Cumulative Mode**: Toggle between normal (per-minute) and cumulative (running total) chart views
5. **Event Markers**: Vertical lines with labels mark moments like "Beer pong started" - customizable colors
6. **Automatic Snapshots**: Every 120 seconds with atomic writes
7. **Custom Drinks**: Add new drinks with emoji/image and custom colors
8. **Keyboard Shortcuts**: Press 1-6 to log first 6 drinks instantly
9. **LAN URLs**: Displays both localhost and network IP on startup
10. **Premium UI**: Dark theme with glass effects, smooth animations, responsive design
11. **Debounce Protection**: 300ms cooldown prevents accidental double-clicks on drink buttons

## Default Drinks (Seeded)
1. Beer 🍺
2. Wine 🍷
3. Whisky 🥃
4. Cocktail 🍸
5. Longdrink 🍹
6. Sparkling 🥂

## Environment Variables
- `PORT` - Server port (default: 5000)
- `SNAPSHOT_INTERVAL_SEC` - Snapshot frequency in seconds (default: 120)
- `SNAPSHOT_DIR` - Snapshot directory path (default: ./snapshots)
- `SNAPSHOT_MAX_FILES` - Number of snapshots to retain (default: 30)

## Running the App
```bash
node server.js
```

On startup, the console displays:
```
┌─────────────────────────────────────────────────┐
│    🍺 Drink Tracker - Ready for Bar Night! 🍺   │
└─────────────────────────────────────────────────┘

📱 Control Panel (Track Drinks):
   Local:   http://localhost:5000/control
   Network: http://[LAN-IP]:5000/control

📊 Dashboard (Live Stats):
   Local:   http://localhost:5000/dashboard
   Network: http://[LAN-IP]:5000/dashboard

⚙️  Auto-snapshots: every 120s → ./snapshots/
📦 Loaded: 6 drinks, 0 consumptions, 0 events
```

## Testing
All core functionality tested and verified:
- ✅ SSE real-time updates (< 1s latency)
- ✅ Drink consumption recording with debounce protection
- ✅ Event marker creation with customizable colors
- ✅ Add custom drinks with color selection
- ✅ Snapshot creation and restoration
- ✅ LAN URL detection and display
- ✅ Keyboard shortcuts
- ✅ Toast notifications
- ✅ 60-minute rolling window aggregation
- ✅ Dashboard legend with chart-colored borders
- ✅ Cumulative/normal mode toggle

## Next Steps (Future Enhancements)
- Export consumption history (CSV/JSON)
- Configurable time windows (30min, 2hr, 4hr)
- Statistics panel (totals, averages, peaks)
- Drink editing/deletion capabilities
- User-configurable snapshot intervals
