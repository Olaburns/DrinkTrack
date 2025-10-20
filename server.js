import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, readFile, readdir, unlink, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 5000;
const SNAPSHOT_INTERVAL_SEC = parseInt(process.env.SNAPSHOT_INTERVAL_SEC) || 120;
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || './snapshots';
const SNAPSHOT_MAX_FILES = parseInt(process.env.SNAPSHOT_MAX_FILES) || 30;

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// In-memory state
let state = {
  drinks: [
    { name: 'Beer', emoji: '🍺', color: '#F59E0B' },
    { name: 'Wine', emoji: '🍷', color: '#DC2626' },
    { name: 'Whisky', emoji: '🥃', color: '#D97706' },
    { name: 'Cocktail', emoji: '🍸', color: '#EC4899' },
    { name: 'Longdrink', emoji: '🍹', color: '#06B6D4' },
    { name: 'Sparkling', emoji: '🥂', color: '#FBBF24' }
  ],
  consumptions: [],
  events: []
};

// SSE clients
let sseClients = [];

// Helper: Get LAN IPv4 address
function getLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Helper: Broadcast SSE event
function broadcastSSE(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (err) {
      console.error('Error sending SSE:', err);
    }
  });
}

// Helper: Aggregate stats for last 60 minutes (minute buckets)
function getAggregatedStats() {
  const now = Date.now();
  const sixtyMinutesAgo = now - 60 * 60 * 1000;
  
  // Filter consumptions in last 60 minutes
  const recentConsumptions = state.consumptions.filter(c => {
    const timestamp = new Date(c.at).getTime();
    return timestamp >= sixtyMinutesAgo;
  });
  
  // Create minute buckets
  const buckets = new Map();
  
  // Initialize buckets for last 60 minutes
  for (let i = 0; i < 60; i++) {
    const bucketTime = now - (i * 60 * 1000);
    const bucketKey = Math.floor(bucketTime / (60 * 1000));
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        timestamp: new Date(bucketKey * 60 * 1000).toISOString(),
        drinks: {}
      });
    }
  }
  
  // Aggregate consumptions into buckets
  recentConsumptions.forEach(consumption => {
    const timestamp = new Date(consumption.at).getTime();
    const bucketKey = Math.floor(timestamp / (60 * 1000));
    
    if (buckets.has(bucketKey)) {
      const bucket = buckets.get(bucketKey);
      if (!bucket.drinks[consumption.drinkName]) {
        bucket.drinks[consumption.drinkName] = 0;
      }
      bucket.drinks[consumption.drinkName]++;
    }
  });
  
  // Convert to sorted array
  const sortedBuckets = Array.from(buckets.values())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return {
    buckets: sortedBuckets,
    recentEvents: state.events.filter(e => {
      const timestamp = new Date(e.at).getTime();
      return timestamp >= sixtyMinutesAgo;
    })
  };
}

// Helper: Save snapshot
async function saveSnapshot() {
  try {
    // Ensure snapshot directory exists
    if (!existsSync(SNAPSHOT_DIR)) {
      await mkdir(SNAPSHOT_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot-${timestamp}.json`;
    const tempPath = join(SNAPSHOT_DIR, `${filename}.tmp`);
    const finalPath = join(SNAPSHOT_DIR, filename);
    
    // Atomic write: write to temp file, then rename
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, finalPath);
    
    console.log(`✓ Snapshot saved: ${filename}`);
    
    // Cleanup old snapshots
    const files = await readdir(SNAPSHOT_DIR);
    const snapshots = files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (snapshots.length > SNAPSHOT_MAX_FILES) {
      const toDelete = snapshots.slice(SNAPSHOT_MAX_FILES);
      for (const file of toDelete) {
        await unlink(join(SNAPSHOT_DIR, file));
        console.log(`  Deleted old snapshot: ${file}`);
      }
    }
    
    return filename;
  } catch (err) {
    console.error('✗ Snapshot save failed:', err.message);
    throw err;
  }
}

// Helper: Restore from latest snapshot
async function restoreSnapshot() {
  try {
    if (!existsSync(SNAPSHOT_DIR)) {
      console.log('No snapshot directory found, starting fresh');
      return false;
    }
    
    const files = await readdir(SNAPSHOT_DIR);
    const snapshots = files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (snapshots.length === 0) {
      console.log('No snapshots found, starting fresh');
      return false;
    }
    
    const latestSnapshot = snapshots[0];
    const snapshotPath = join(SNAPSHOT_DIR, latestSnapshot);
    
    const data = await readFile(snapshotPath, 'utf8');
    const restoredState = JSON.parse(data);
    
    // Validate structure
    if (restoredState.drinks && restoredState.consumptions && restoredState.events) {
      state = restoredState;
      console.log(`✓ Restored from snapshot: ${latestSnapshot}`);
      console.log(`  Drinks: ${state.drinks.length}, Consumptions: ${state.consumptions.length}, Events: ${state.events.length}`);
      return true;
    } else {
      console.warn(`✗ Invalid snapshot format in ${latestSnapshot}, starting fresh`);
      return false;
    }
  } catch (err) {
    console.error('✗ Snapshot restore failed:', err.message);
    console.log('Continuing with empty state');
    return false;
  }
}

// Routes
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'dashboard.html'));
});

app.get('/control', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'control.html'));
});

// SSE endpoint
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Add client
  sseClients.push(res);
  console.log(`SSE client connected (${sseClients.length} total)`);
  
  // Send initial stats
  const stats = getAggregatedStats();
  res.write(`event: stats\ndata: ${JSON.stringify(stats)}\n\n`);
  
  // Setup heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);
    } catch (err) {
      clearInterval(heartbeatInterval);
    }
  }, 15000);
  
  // Handle disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    sseClients = sseClients.filter(client => client !== res);
    console.log(`SSE client disconnected (${sseClients.length} remaining)`);
  });
});

// Get all drinks
app.get('/drinks', (req, res) => {
  res.json(state.drinks);
});

// Create a drink
app.post('/drinks', (req, res) => {
  const { name, emoji, imageUrl, color } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Drink name is required' });
  }
  
  // Check if drink already exists
  const exists = state.drinks.some(d => d.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'Drink with this name already exists' });
  }
  
  const drink = {
    name: name.trim(),
    emoji: emoji || '',
    imageUrl: imageUrl || '',
    color: color || '#8B5CF6'
  };
  
  state.drinks.push(drink);
  
  // Broadcast to all SSE clients
  broadcastSSE('drink-added', drink);
  
  res.status(201).json(drink);
});

// Record consumption
app.post('/consume', (req, res) => {
  const { drinkName } = req.body;
  
  if (!drinkName) {
    return res.status(400).json({ error: 'drinkName is required' });
  }
  
  // Verify drink exists
  const drink = state.drinks.find(d => d.name === drinkName);
  if (!drink) {
    return res.status(404).json({ error: 'Drink not found' });
  }
  
  const consumption = {
    drinkName,
    at: new Date().toISOString()
  };
  
  state.consumptions.push(consumption);
  
  // Broadcast to all SSE clients
  broadcastSSE('consumption', consumption);
  
  // Also send updated stats
  const stats = getAggregatedStats();
  broadcastSSE('stats', stats);
  
  res.status(201).json(consumption);
});

// Record event
app.post('/event', (req, res) => {
  const { label, color } = req.body;
  
  if (!label || label.trim() === '') {
    return res.status(400).json({ error: 'Event label is required' });
  }
  
  const event = {
    label: label.trim(),
    color: color || '#F59E0B', // Default amber color
    at: new Date().toISOString()
  };
  
  state.events.push(event);
  
  // Broadcast to all SSE clients
  broadcastSSE('event', event);
  
  // Also send updated stats
  const stats = getAggregatedStats();
  broadcastSSE('stats', stats);
  
  res.status(201).json(event);
});

// Manual snapshot endpoints
app.post('/api/snapshot', async (req, res) => {
  try {
    const filename = await saveSnapshot();
    res.json({ message: 'Snapshot created', filename });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create snapshot', details: err.message });
  }
});

app.get('/api/snapshot/latest', async (req, res) => {
  try {
    if (!existsSync(SNAPSHOT_DIR)) {
      return res.status(404).json({ error: 'No snapshots available' });
    }
    
    const files = await readdir(SNAPSHOT_DIR);
    const snapshots = files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (snapshots.length === 0) {
      return res.status(404).json({ error: 'No snapshots found' });
    }
    
    const latestSnapshot = snapshots[0];
    const snapshotPath = join(SNAPSHOT_DIR, latestSnapshot);
    
    res.download(snapshotPath, latestSnapshot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve snapshot', details: err.message });
  }
});

app.post('/api/snapshot/restore', async (req, res) => {
  try {
    const restored = await restoreSnapshot();
    if (restored) {
      // Broadcast updated stats to all clients
      const stats = getAggregatedStats();
      broadcastSSE('stats', stats);
      
      res.json({ message: 'Snapshot restored successfully' });
    } else {
      res.status(404).json({ error: 'No snapshot available to restore' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore snapshot', details: err.message });
  }
});

// Startup
async function start() {
  // Restore from snapshot
  await restoreSnapshot();
  
  // Setup automatic snapshots
  setInterval(async () => {
    await saveSnapshot();
  }, SNAPSHOT_INTERVAL_SEC * 1000);
  
  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    const lanIp = getLanIp();
    
    console.log('\n┌─────────────────────────────────────────────────┐');
    console.log('│    🍺 Drink Tracker - Ready for Bar Night! 🍺   │');
    console.log('└─────────────────────────────────────────────────┘\n');
    console.log('📱 Control Panel (Track Drinks):');
    console.log(`   Local:   http://localhost:${PORT}/control`);
    console.log(`   Network: http://${lanIp}:${PORT}/control\n`);
    console.log('📊 Dashboard (Live Stats):');
    console.log(`   Local:   http://localhost:${PORT}/dashboard`);
    console.log(`   Network: http://${lanIp}:${PORT}/dashboard\n`);
    console.log(`⚙️  Auto-snapshots: every ${SNAPSHOT_INTERVAL_SEC}s → ${SNAPSHOT_DIR}/`);
    console.log(`📦 Loaded: ${state.drinks.length} drinks, ${state.consumptions.length} consumptions, ${state.events.length} events\n`);
  });
}

start();
