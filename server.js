const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 7000;

// 🔐 PandaScore API Key
const PANDASCORE_API_KEY = process.env.PANDASCORE_API_KEY || 'wfFUseEzf2SdWTjBIUHMvCYoE1p_1jQ834Cg0GBpIHHGusAIOWY';

// 📁 Public folder
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.json());

// 🔄 Real-time synchronization with Server-Sent Events
let clients = [];

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  
  console.log(`✅ Client ${clientId} connected. Total clients: ${clients.length}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Remove client when connection closes
  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
    console.log(`❌ Client ${clientId} disconnected. Total clients: ${clients.length}`);
  });
});

// Function to broadcast updates to all connected clients
function broadcastUpdate(eventType, data) {
  const message = JSON.stringify({ type: eventType, data, timestamp: Date.now() });
  console.log(`📡 Broadcasting ${eventType} to ${clients.length} clients`);
  
  clients.forEach(client => {
    try {
      client.res.write(`data: ${message}\n\n`);
    } catch (err) {
      console.error('Error sending to client:', err);
    }
  });
}

// ✅ Save commands
app.post('/save-commands', (req, res) => {
  const filePath = path.join(publicPath, 'comands.json');
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) return res.status(500).json({ success: false });
    
    // Broadcast commands update to all clients
    broadcastUpdate('commands_updated', req.body);
    
    res.json({ success: true });
  });
});

// ✅ Save selected matches
app.post('/api/selected_matches', (req, res) => {
  const filePath = path.join(publicPath, 'selected_matches.json');
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
    if (err) {
      console.error('❌ Error writing selected matches:', err);
      return res.status(500).json({ success: false });
    }
    
    // Broadcast selected matches update to all clients
    broadcastUpdate('matches_updated', req.body);
    
    res.json({ success: true });
  });
});

// ✅ HLTV scraper
const { updateSelectedMatchesWithHLTVLinks } = require('./public/hltv-scraper');

app.post('/api/run-hltv-scraper', async (req, res) => {
  try {
    const success = await updateSelectedMatchesWithHLTVLinks();
    
    if (success) {
      // Read the updated selected matches file to broadcast the changes
      const filePath = path.join(publicPath, 'selected_matches.json');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (!err) {
          try {
            const updatedMatches = JSON.parse(data);
            // Broadcast the updated matches with HLTV links to all clients
            broadcastUpdate('matches_updated', updatedMatches);
            console.log('📡 Broadcasting HLTV scraper results to all clients');
          } catch (parseErr) {
            console.error('Error parsing updated matches:', parseErr);
          }
        }
      });
    }
    
    res.json({ success });
  } catch (err) {
    console.error('Scraper error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Refresh upcoming matches
app.get('/refresh-upcoming', (req, res) => {
  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const apiUrl = new URL('https://api.pandascore.co/csgo/matches/upcoming');
  apiUrl.searchParams.append('range[begin_at]', `${now.toISOString()},${in48Hours.toISOString()}`);
  apiUrl.searchParams.append('sort', 'begin_at');
  apiUrl.searchParams.append('per_page', '100');

  const options = { headers: { 'Authorization': `Bearer ${PANDASCORE_API_KEY}` } };

  https.get(apiUrl, options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      if (apiRes.statusCode === 200) {
        try {
          const matches = JSON.parse(data).map(match => ({
            id: match.id,
            team1: { name: match.opponents[0]?.opponent.name || 'TBD', logo: match.opponents[0]?.opponent.image_url || '', score: 0 },
            team2: { name: match.opponents[1]?.opponent.name || 'TBD', logo: match.opponents[1]?.opponent.image_url || '', score: 0 },
            event: match.league.name,
            date: match.begin_at,
            format: match.match_type,
            status: 'upcoming'
          }));

          const filePath = path.join(publicPath, 'upcoming_matches.json');
          fs.writeFile(filePath, JSON.stringify({ upcoming_matches: matches }, null, 2), (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, count: matches.length });
          });
        } catch (err) {
          console.error('Parse error:', err);
          res.status(500).json({ success: false });
        }
      } else {
        res.status(502).json({ success: false });
      }
    });
  }).on('error', err => {
    console.error('Fetch error:', err);
    res.status(500).json({ success: false });
  });
});

// ✅ Refresh at server start
function fetchAndSaveUpcomingMatches() {
  const now = new Date();
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const apiUrl = new URL('https://api.pandascore.co/csgo/matches/upcoming');
  apiUrl.searchParams.append('range[begin_at]', `${now.toISOString()},${in48Hours.toISOString()}`);
  apiUrl.searchParams.append('sort', 'begin_at');
  apiUrl.searchParams.append('per_page', '100');

  const options = { headers: { 'Authorization': `Bearer ${PANDASCORE_API_KEY}` } };

  https.get(apiUrl, options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      if (apiRes.statusCode === 200) {
        try {
          const matches = JSON.parse(data).map(match => ({
            id: match.id,
            team1: { name: match.opponents[0]?.opponent.name || 'TBD', logo: match.opponents[0]?.opponent.image_url || '', score: 0 },
            team2: { name: match.opponents[1]?.opponent.name || 'TBD', logo: match.opponents[1]?.opponent.image_url || '', score: 0 },
            event: match.league.name,
            date: match.begin_at,
            format: match.match_type,
            status: 'upcoming'
          }));

          const filePath = path.join(publicPath, 'upcoming_matches.json');
          fs.writeFile(filePath, JSON.stringify({ upcoming_matches: matches }, null, 2), (err) => {
            if (err) {
              console.error('❌ Failed to write matches file on startup:', err);
            } else {
              console.log(`✅ Loaded ${matches.length} matches on startup`);
            }
          });
        } catch (err) {
          console.error('❌ JSON parsing error on startup:', err);
        }
      } else {
        console.error(`❌ PandaScore error ${apiRes.statusCode}`);
      }
    });
  }).on('error', err => {
    console.error('❌ Network error:', err);
  });
}

// ✅ Catch-all 404
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
  fetchAndSaveUpcomingMatches();
});
