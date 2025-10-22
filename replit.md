# Drink Tracker - LAN-Reachable Bar Night App

### Overview
The Drink Tracker is a zero-friction, real-time drink tracking application designed for social gatherings. It provides two simultaneously accessible views: a live dashboard for monitoring consumption and a touch-friendly control panel for logging drinks. Its purpose is to track consumed drinks over time with live visualization, event markers, and automatic crash protection via snapshots, enabling multiple people to access the app on the same local area network (LAN) simultaneously. The application also features a multi-participant prediction game with an awards system.

### User Preferences
- **Tech Stack**: Node.js 20 + Express + vanilla JS (no React/bundler)
- **UI Style**: Premium dark theme with glass morphism
- **Real-time**: Sub-1-second latency via SSE
- **Network Access**: LAN-reachable for multiple users
- **Data Persistence**: In-memory with snapshot-based crash protection

### System Architecture

#### Backend (server.js)
The backend is an **Express server** binding to `0.0.0.0:5000`. It uses **in-memory storage** for drinks, consumptions, events, participants, predictions, and event settings. Real-time updates are handled via an **SSE endpoint** (`/events`). **Session management** uses `express-session` with `httpOnly` cookies for matrix authentication. A robust **snapshot system** ensures data integrity with automatic snapshots every 120 seconds, atomic writes, retention of the last 30 snapshots, and auto-restore on startup. Session persistence is managed by `connect-pg-simple` using a PostgreSQL database for 24-hour persistent sessions.

#### Frontend (public/)
The frontend utilizes **Vanilla JavaScript** with libraries via CDN (no bundler).
- **dashboard.html**: Displays a live time-series chart powered by ECharts, featuring a 60-minute rolling window, stacked area charts, event markers, and a live indicator. It supports emoji/avatar in the legend and offers cumulative mode with real-time updates.
- **control.html**: Provides a touch-optimized interface with large drink buttons, options to add custom drinks and event markers, toast notifications, and keyboard shortcuts.
- **styles.css**: Implements a premium dark theme with glass morphism effects, responsive grid layouts, subtle animations, and an HSL color system.

#### Data Model
- **Drinks**: `{ name: string, emoji?: string, imageUrl?: string, color?: string }`
- **Consumptions**: `{ drinkName: string, participantId?: string, at: Date }`
- **Events**: `{ label: string, color?: string, at: Date }`
- **Participants**: `{ id: string, name: string, avatar?: string, selfEstimate: number }`
- **Predictions**: `{ id: string, predictorId: string, targetId: string, predictedDrinks: number }`
- **Event Settings**: `{ passcodeHash: string | null, predictionsLocked: boolean }`

#### Core Features
- **Real-time Updates**: SSE broadcasts consumption/event changes to all connected clients with sub-second latency.
- **Dual Views**: Dashboard and control panel can run simultaneously on different devices.
- **Participant Management**: Registration, prediction game, and authenticated matrix view with awards.
- **Security Hardening**: Session-based authentication with `httpOnly` and `sameSite=strict` cookies, `requireAuth` middleware for sensitive routes, passcode protection, and robust data validation.
- **UI/UX**: Premium dark theme with glass morphism, responsive design, network-accessible QR codes, permanent QR display on desktop, and mobile navigation optimization.
- **Data Integrity**: Automatic snapshots, 300ms debounce protection for drink logging, and historical data retention.
- **Awards System**: German-labeled awards (e.g., Kotzstempel, Glückspilz) with enhanced UI and animations.

### External Dependencies
- **ECharts**: For live time-series visualizations on the dashboard.
- **PostgreSQL**: Used for persistent session storage via `connect-pg-simple`.
- **Express-session**: Middleware for session management.
- **Node.js**: Runtime environment.
- **CDN-hosted Libraries**: Various JavaScript libraries used in the frontend.