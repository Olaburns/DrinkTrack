# Design Guidelines: Real-Time Drink Tracker

## Design Approach

**Selected Approach:** Reference-Based (Hybrid Entertainment + Analytics)

Drawing inspiration from:
- **Linear/Notion** for clean, dark analytics UI and data visualization clarity
- **Spotify** for premium dark theme execution and glass morphism effects
- **Gaming interfaces** for large, tactile touch controls and instant feedback

**Key Principles:**
1. **Premium Minimalism** - Every element serves a purpose; quality over quantity
2. **Touch-First Interaction** - Large targets, immediate feedback, no hover dependencies
3. **Ambient Awareness** - Dashboard updates feel alive but never distracting
4. **Party-Ready Durability** - Clear in dim lighting, forgiving of imprecise taps

---

## Core Design Elements

### A. Color Palette

**Dark Mode Foundation:**
- Background Base: `220 15% 8%` (deep charcoal blue)
- Surface Elevated: `220 12% 12%` (card/panel backgrounds)
- Surface Glass: `220 10% 15%` with 60% opacity backdrop blur
- Border Subtle: `220 10% 20%` (dividers, card edges)

**Brand & Accent Colors:**
- Primary Action: `262 83% 58%` (vibrant purple - matches party/nightlife vibe)
- Success/Live: `142 76% 45%` (emerald green for LIVE indicator)
- Warning/Event: `38 92% 50%` (amber for event markers)
- Chart Series: Auto-assign from curated palette: `262 83% 58%`, `198 93% 60%`, `340 82% 52%`, `48 96% 53%`, `280 67% 47%`, `171 77% 47%`

**Text Hierarchy:**
- Primary Text: `220 10% 95%` (near white)
- Secondary Text: `220 8% 65%` (muted for labels)
- Tertiary/Disabled: `220 6% 45%` (timestamps, hints)

### B. Typography

**Font Stack:**
- Primary: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Monospace (for counts): `'JetBrains Mono', 'Courier New', monospace`

**Type Scale:**
- Display (Dashboard Title): `text-4xl font-bold tracking-tight` (36px)
- Heading (Section Headers): `text-2xl font-semibold` (24px)
- Button Large (Drink Buttons): `text-xl font-medium` (20px)
- Body: `text-base` (16px)
- Caption (Timestamps): `text-sm text-muted` (14px)
- Micro (Chart Labels): `text-xs` (12px)

### C. Layout System

**Spacing Primitives:** Use Tailwind units of `2, 4, 6, 8, 12, 16` for consistent rhythm
- Component padding: `p-4` to `p-6`
- Section gaps: `gap-6` to `gap-8`
- Page margins: `p-6` to `p-8`
- Touch targets: minimum `h-16` (64px) for buttons

**Container Structure:**
- Dashboard: Full viewport height `h-screen` with flex column
- Control Panel: Scrollable grid with sticky header
- Max width: `max-w-7xl mx-auto` for dashboard, full width for control

**Grid Systems:**
- Drink buttons: `grid grid-cols-2 md:grid-cols-3 gap-4`
- Chart + legend: Flexible column with chart taking available space
- Event markers: Absolute positioned overlays on chart

### D. Component Library

**Navigation/Header:**
- Sticky header with glass morphism effect
- Logo/Title on left, LIVE indicator on right
- Height: `h-16` with `backdrop-blur-xl bg-surface/80`
- Border bottom: `border-b border-subtle`

**Drink Consumption Buttons:**
- Large cards: `min-h-24 rounded-2xl` with subtle gradient overlays
- Layout: Emoji/icon (text-5xl) stacked above drink name
- Background: `bg-surface-elevated` with `hover:bg-surface-glass` transition
- Active state: Scale down `active:scale-95` with duration 100ms
- Border: `border border-subtle` with `hover:border-primary/40`
- Each drink gets assigned color from chart palette as subtle left accent bar `border-l-4`

**Add Drink Form:**
- Compact inline form with 3 fields: name input, emoji input, color picker
- Appears in a modal/drawer: `bg-surface-elevated rounded-2xl p-6`
- Submit button: Primary purple with icon

**Event Marker Button:**
- Secondary style: `border border-primary text-primary bg-transparent`
- Opens inline text input or modal
- Icon: Plus or marker icon from Heroicons

**Toast Notifications:**
- Bottom-center placement: `bottom-8 left-1/2 -translate-x-1/2`
- Glass card: `backdrop-blur-lg bg-surface-glass/90 rounded-xl px-6 py-4`
- Large emoji + text: `text-2xl` emoji, `text-lg` message
- Slide-up animation, auto-dismiss after 2s

**Chart Container:**
- Card wrapper: `bg-surface-elevated rounded-2xl border border-subtle p-6`
- Chart fills container with `aspect-[16/9]` or fixed height `h-[500px]`
- Legend: Horizontal pills below chart with emoji + name + count
- Time controls: Compact button group (Last 60min selected by default)

**Live Indicator:**
- Pulsing dot: `w-3 h-3 rounded-full bg-success animate-pulse`
- Label: `text-sm font-medium text-success ml-2`
- Container: Flexbox with gap-2

**Event Markers (on Chart):**
- Vertical line: 2px solid amber with 50% opacity
- Label: Rotated text at top or tooltip on hover
- Tooltip: Small card with timestamp + event text

### E. Visual Effects

**Glass Morphism:**
- Apply to elevated surfaces: `backdrop-blur-xl bg-surface/80`
- Borders with transparency: `border border-white/10`
- Subtle inner glow: `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]`

**Micro-Animations (Minimal):**
- Button press: Scale transform `active:scale-95 transition-transform duration-100`
- Toast entrance: Slide up + fade in over 200ms
- Chart updates: Smooth line interpolation (ECharts default)
- LIVE pulse: `animate-pulse` on indicator dot
- NO complex scroll animations, parallax, or decorative motion

**Shadows:**
- Elevated cards: `shadow-lg shadow-black/20`
- Modals/drawers: `shadow-2xl shadow-black/40`
- Buttons on press: Remove shadow for pressed effect

---

## View-Specific Layouts

### Dashboard View (`/dashboard`)

**Structure:**
1. **Header Bar** (sticky, 64px)
   - Left: "Drink Tracker Dashboard" title
   - Right: LIVE indicator (pulsing green)
   
2. **Chart Section** (flex-1)
   - Full-width card with padding
   - ECharts instance with stacked area series
   - X-axis: Time (HH:mm format)
   - Y-axis: Drink count
   - Smooth curves, no point markers
   - Gradient fills below lines with transparency
   - Event markers as vertical amber lines
   
3. **Legend Bar** (horizontal, below chart)
   - Horizontal scroll if needed
   - Pills with: emoji/avatar + drink name + current count
   - Clickable to show/hide series

4. **Footer** (optional, minimal)
   - Timestamp of last update
   - Total drinks consumed today

### Control Panel View (`/control`)

**Structure:**
1. **Header Bar** (sticky, 64px)
   - Left: "Track Drinks" title
   - Right: Add Event button (icon + text)

2. **Quick Stats Banner** (glass card, compact)
   - Total drinks: Large number
   - Active time: Duration since first drink
   - Layout: Horizontal flex, centered

3. **Drink Grid** (main content, scrollable)
   - Responsive grid: 2 cols mobile, 3 cols tablet+
   - Large touch cards (min 96px height)
   - Each card: Emoji/icon (56px), name, subtle color accent
   - Generous gap between cards (16px)

4. **Action Row** (bottom or inline)
   - "Add New Drink" button (secondary style)
   - "Add Event" button (outline style)
   - Horizontal layout with gap

5. **Add Drink Form** (modal/drawer when triggered)
   - Centered modal on desktop
   - Bottom sheet on mobile
   - Fields: Name, Emoji (optional), Image URL (optional), Color picker
   - Preview of how it will look
   - Save button (primary purple)

---

## Responsive Behavior

**Mobile (< 640px):**
- Single column layouts
- Drink buttons: 2 columns
- Larger touch targets (min 72px)
- Bottom sheet modals
- Reduce chart height to `h-[300px]`

**Tablet (640px - 1024px):**
- 3 column drink grid
- Side-by-side stats
- Chart at `h-[400px]`

**Desktop (> 1024px):**
- Max width containers with margins
- Full chart height `h-[500px]`
- Hover states enabled

---

## Chart Configuration (ECharts)

**Theme:**
- Background: Transparent (inherits card background)
- Grid lines: `#334155` at 20% opacity
- Text color: `#cbd5e1` (secondary text)

**Series Style:**
- Type: Area with stack
- Smooth curves: `smooth: true`
- Area opacity: 20-30%
- Line width: 2px
- No symbol/point markers in live view

**Tooltip:**
- Trigger on axis
- Dark background: `#1e293b`
- Show all series at hovered time
- Format: Drink name + count

**Legend:**
- Custom HTML outside chart (below)
- Interactive toggle on/off

---

## Accessibility & Polish

**Keyboard Navigation:**
- All buttons focusable with visible focus rings `focus-visible:ring-2 ring-primary ring-offset-2 ring-offset-background`
- Number keys 1-6 trigger first 6 drinks
- Escape closes modals

**Loading States:**
- Skeleton for chart on initial load
- Shimmer effect on cards: `animate-pulse bg-surface-elevated/50`

**Error Handling:**
- Connection lost: Show amber warning banner at top
- Failed snapshot: Toast notification with retry option

**Empty States:**
- No data yet: Illustrated message in chart area
- No events: Subtle hint text

---

This design creates a premium, party-ready experience that feels sophisticated yet approachable, with clear data visualization and instant tactile feedback for every interaction.