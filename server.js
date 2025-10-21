import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, readFile, readdir, unlink, mkdir, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { networkInterfaces } from 'os';
import { createHash, randomBytes } from 'crypto';

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
  events: [],
  participants: [],
  predictions: [],
  eventSettings: {
    passcodeHash: null,
    predictionsLocked: false
  }
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
    
    // Validate structure and add defaults for new fields
    if (restoredState.drinks && restoredState.consumptions && restoredState.events) {
      state = restoredState;
      
      // Add defaults for new fields if they don't exist
      if (!state.participants) state.participants = [];
      if (!state.predictions) state.predictions = [];
      if (!state.eventSettings) {
        state.eventSettings = {
          passcodeHash: null,
          predictionsLocked: false
        };
      }
      
      console.log(`✓ Restored from snapshot: ${latestSnapshot}`);
      console.log(`  Drinks: ${state.drinks.length}, Consumptions: ${state.consumptions.length}, Events: ${state.events.length}`);
      console.log(`  Participants: ${state.participants.length}, Predictions: ${state.predictions.length}`);
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

// Helper: Generate unique ID
function generateId() {
  return randomBytes(16).toString('hex');
}

// Helper: Hash passcode
function hashPasscode(passcode) {
  return createHash('sha256').update(passcode).digest('hex');
}

// Helper: Verify passcode
function verifyPasscode(passcode) {
  if (!state.eventSettings.passcodeHash) {
    return false;
  }
  const hash = hashPasscode(passcode);
  return hash === state.eventSettings.passcodeHash;
}

// Helper: Get participant drink count
function getParticipantDrinkCount(participantId) {
  return state.consumptions.filter(c => c.participantId === participantId).length;
}

// Helper: Compute awards
function computeAwards() {
  const participants = state.participants;
  if (participants.length === 0) {
    return [];
  }

  // Build actual drinks map
  const actualDrinks = {};
  participants.forEach(p => {
    actualDrinks[p.id] = getParticipantDrinkCount(p.id);
  });

  // Build predictions map
  const predictionsMap = {}; // predictionsMap[predictorId][targetId] = predictedDrinks
  state.predictions.forEach(pred => {
    if (!predictionsMap[pred.predictorId]) {
      predictionsMap[pred.predictorId] = {};
    }
    predictionsMap[pred.predictorId][pred.targetId] = pred.predictedDrinks;
  });

  const awards = [];

  // 1. Kotzstempel: highest actual drinks
  let maxDrinks = -1;
  let kotzstempelWinners = [];
  participants.forEach(p => {
    const drinks = actualDrinks[p.id];
    if (drinks > maxDrinks) {
      maxDrinks = drinks;
      kotzstempelWinners = [p];
    } else if (drinks === maxDrinks) {
      kotzstempelWinners.push(p);
    }
  });
  if (kotzstempelWinners.length > 0) {
    awards.push({
      name: 'Kotzstempel',
      winners: kotzstempelWinners.map(p => ({ name: p.name, avatar: p.avatar }))
    });
  }

  // 2. Spülsüchtigen: best predictor (lowest MAE)
  const predictorMAE = {};
  const predictorCoverage = {};
  
  Object.keys(predictionsMap).forEach(predictorId => {
    const preds = predictionsMap[predictorId];
    let totalError = 0;
    let count = 0;
    let coveredTargets = 0;
    
    participants.forEach(target => {
      if (typeof actualDrinks[target.id] !== 'undefined') {
        if (typeof preds[target.id] !== 'undefined') {
          totalError += Math.abs(preds[target.id] - actualDrinks[target.id]);
          count++;
          coveredTargets++;
        }
      }
    });
    
    if (count > 0) {
      predictorMAE[predictorId] = totalError / count;
      predictorCoverage[predictorId] = coveredTargets / participants.length;
    }
  });

  // Determine minimum coverage threshold
  let minCoverage = 0.5;
  const eligiblePredictors = Object.keys(predictorMAE).filter(id => predictorCoverage[id] >= minCoverage);
  if (eligiblePredictors.length === 0) {
    minCoverage = 0.33;
    const eligiblePredictors2 = Object.keys(predictorMAE).filter(id => predictorCoverage[id] >= minCoverage);
    if (eligiblePredictors2.length === 0) {
      minCoverage = 0.01; // at least 1 prediction
    }
  }

  const eligible = Object.keys(predictorMAE).filter(id => predictorCoverage[id] >= minCoverage);
  if (eligible.length > 0) {
    let minMAE = Infinity;
    let spulsuchtigWinners = [];
    
    eligible.forEach(predictorId => {
      const mae = predictorMAE[predictorId];
      if (mae < minMAE) {
        minMAE = mae;
        spulsuchtigWinners = [participants.find(p => p.id === predictorId)];
      } else if (mae === minMAE) {
        spulsuchtigWinners.push(participants.find(p => p.id === predictorId));
      }
    });
    
    if (spulsuchtigWinners.length > 0) {
      awards.push({
        name: 'Spülsüchtigen',
        winners: spulsuchtigWinners.filter(p => p).map(p => ({ name: p.name, avatar: p.avatar }))
      });
    }
  }

  // 3. Stille Wasser sind tief: hardest to predict (highest crowd MAE)
  const targetCrowdMAE = {};
  
  participants.forEach(target => {
    let totalError = 0;
    let count = 0;
    
    Object.keys(predictionsMap).forEach(predictorId => {
      const preds = predictionsMap[predictorId];
      if (typeof preds[target.id] !== 'undefined' && typeof actualDrinks[target.id] !== 'undefined') {
        totalError += Math.abs(preds[target.id] - actualDrinks[target.id]);
        count++;
      }
    });
    
    if (count >= 2) {
      targetCrowdMAE[target.id] = totalError / count;
    }
  });

  if (Object.keys(targetCrowdMAE).length > 0) {
    let maxCrowdMAE = -1;
    let stilleWasserWinners = [];
    
    Object.keys(targetCrowdMAE).forEach(targetId => {
      const crowdMAE = targetCrowdMAE[targetId];
      if (crowdMAE > maxCrowdMAE) {
        maxCrowdMAE = crowdMAE;
        stilleWasserWinners = [participants.find(p => p.id === targetId)];
      } else if (crowdMAE === maxCrowdMAE) {
        stilleWasserWinners.push(participants.find(p => p.id === targetId));
      }
    });
    
    if (stilleWasserWinners.length > 0) {
      awards.push({
        name: 'Stille Wasser sind tief',
        winners: stilleWasserWinners.filter(p => p).map(p => ({ name: p.name, avatar: p.avatar }))
      });
    }
  }

  // 4. Schwarzer Peter: worst predictor (highest MAE)
  if (eligible.length > 0) {
    let maxMAE = -1;
    let schwarzerPeterWinners = [];
    
    eligible.forEach(predictorId => {
      const mae = predictorMAE[predictorId];
      if (mae > maxMAE) {
        maxMAE = mae;
        schwarzerPeterWinners = [participants.find(p => p.id === predictorId)];
      } else if (mae === maxMAE) {
        schwarzerPeterWinners.push(participants.find(p => p.id === predictorId));
      }
    });
    
    if (schwarzerPeterWinners.length > 0) {
      awards.push({
        name: 'Schwarzer Peter',
        winners: schwarzerPeterWinners.filter(p => p).map(p => ({ name: p.name, avatar: p.avatar }))
      });
    }
  }

  return awards;
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

// New page routes
app.get('/join', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'join.html'));
});

app.get('/predictions', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'predictions.html'));
});

app.get('/matrix', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'matrix.html'));
});

app.get('/awards', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'awards.html'));
});

// Passcode management
app.post('/api/passcode', (req, res) => {
  const { passcode } = req.body;
  
  if (!passcode || passcode.trim() === '') {
    return res.status(400).json({ error: 'Passcode is required' });
  }
  
  state.eventSettings.passcodeHash = hashPasscode(passcode);
  res.json({ message: 'Passcode set successfully' });
});

app.post('/api/passcode/verify', (req, res) => {
  const { passcode } = req.body;
  
  if (!passcode) {
    return res.status(400).json({ error: 'Passcode is required' });
  }
  
  const valid = verifyPasscode(passcode);
  res.json({ valid });
});

// Participant management
app.get('/api/participants', (req, res) => {
  res.json(state.participants);
});

app.post('/api/participants', (req, res) => {
  const { name, avatar, selfEstimate } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  // Check if participant with this name already exists
  const existing = state.participants.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    // Update existing participant
    existing.avatar = avatar || existing.avatar;
    existing.selfEstimate = selfEstimate !== undefined ? selfEstimate : existing.selfEstimate;
    
    broadcastSSE('participant-updated', existing);
    return res.json(existing);
  }
  
  // Create new participant
  const participant = {
    id: generateId(),
    name: name.trim(),
    avatar: avatar || '',
    selfEstimate: selfEstimate || 0
  };
  
  state.participants.push(participant);
  broadcastSSE('participant-added', participant);
  
  res.status(201).json(participant);
});

app.patch('/api/participants/:id', (req, res) => {
  const { id } = req.params;
  const { selfEstimate } = req.body;
  
  const participant = state.participants.find(p => p.id === id);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  
  if (state.eventSettings.predictionsLocked) {
    return res.status(403).json({ error: 'Predictions are locked' });
  }
  
  if (selfEstimate !== undefined) {
    participant.selfEstimate = selfEstimate;
  }
  
  broadcastSSE('participant-updated', participant);
  res.json(participant);
});

// Prediction management
app.get('/api/predictions', (req, res) => {
  res.json(state.predictions);
});

app.post('/api/predictions', (req, res) => {
  const { predictorId, targetId, predictedDrinks } = req.body;
  
  if (!predictorId || !targetId) {
    return res.status(400).json({ error: 'predictorId and targetId are required' });
  }
  
  if (predictedDrinks === undefined || predictedDrinks === null) {
    return res.status(400).json({ error: 'predictedDrinks is required' });
  }
  
  if (state.eventSettings.predictionsLocked) {
    return res.status(403).json({ error: 'Predictions are locked' });
  }
  
  // Check if prediction already exists
  const existing = state.predictions.find(p => p.predictorId === predictorId && p.targetId === targetId);
  if (existing) {
    existing.predictedDrinks = predictedDrinks;
    broadcastSSE('prediction-updated', existing);
    return res.json(existing);
  }
  
  // Create new prediction
  const prediction = {
    id: generateId(),
    predictorId,
    targetId,
    predictedDrinks
  };
  
  state.predictions.push(prediction);
  broadcastSSE('prediction-added', prediction);
  
  res.status(201).json(prediction);
});

// Event settings
app.get('/api/event-settings', (req, res) => {
  res.json({
    predictionsLocked: state.eventSettings.predictionsLocked,
    hasPasscode: !!state.eventSettings.passcodeHash
  });
});

app.post('/api/event-settings/lock-predictions', (req, res) => {
  const { locked } = req.body;
  
  state.eventSettings.predictionsLocked = !!locked;
  broadcastSSE('predictions-lock-changed', { locked: state.eventSettings.predictionsLocked });
  
  res.json({ predictionsLocked: state.eventSettings.predictionsLocked });
});

// Consumption with participant tracking
app.post('/api/consume-participant', (req, res) => {
  const { drinkName, participantId } = req.body;
  
  if (!drinkName) {
    return res.status(400).json({ error: 'drinkName is required' });
  }
  
  if (!participantId) {
    return res.status(400).json({ error: 'participantId is required' });
  }
  
  // Verify drink exists
  const drink = state.drinks.find(d => d.name === drinkName);
  if (!drink) {
    return res.status(404).json({ error: 'Drink not found' });
  }
  
  // Verify participant exists
  const participant = state.participants.find(p => p.id === participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  
  const consumption = {
    drinkName,
    participantId,
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

// Awards
app.get('/api/awards', (req, res) => {
  const awards = computeAwards();
  res.json(awards);
});

// Matrix data
app.get('/api/matrix-data', (req, res) => {
  const participants = state.participants;
  const predictions = state.predictions;
  
  // Build matrix data
  const matrix = participants.map(target => {
    const actualDrinks = getParticipantDrinkCount(target.id);
    const selfEstimate = target.selfEstimate;
    
    const predictionsForTarget = {};
    predictions.forEach(pred => {
      if (pred.targetId === target.id) {
        predictionsForTarget[pred.predictorId] = pred.predictedDrinks;
      }
    });
    
    return {
      target: {
        id: target.id,
        name: target.name,
        avatar: target.avatar
      },
      actualDrinks,
      selfEstimate,
      predictions: predictionsForTarget
    };
  });
  
  res.json({
    matrix,
    predictors: participants.map(p => ({ id: p.id, name: p.name, avatar: p.avatar })),
    predictionsLocked: state.eventSettings.predictionsLocked
  });
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
