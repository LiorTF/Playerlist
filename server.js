const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3456;

// the real FXServer players.json endpoint — fetched server-side, so
// there's no CORS issue (CORS only applies to browser-to-server requests,
// not server-to-server ones).
const BACKEND_URL = 'http://45.129.243.5:30120/players.json';
const FETCH_TIMEOUT_MS = 8000;

// how long a player who disconnected stays visible in the list, marked
// as "left", before being dropped entirely
const LEAVE_GRACE_MINUTES = 5;
const LEAVE_GRACE_MS = LEAVE_GRACE_MINUTES * 60 * 1000;

// players.json gives identifiers as ["discord:...", "license:...", ...]
function extractDiscordId(p) {
  if (p.discordId !== undefined) return p.discordId || null;
  const ids = p.identifiers || [];
  for (const id of ids) {
    if (id.startsWith('discord:')) return id.slice('discord:'.length);
  }
  return null;
}

// in-memory roster — survives across requests for as long as the Node
// process runs. Keyed by player id (string).
//   { id, name, ping, discordId, status: 'online'|'left', leftAt: number|null }
const roster = new Map();

function updateRoster(liveList) {
  const now = Date.now();
  const seenIds = new Set();

  // anyone currently in players.json is online — add them or refresh
  // their info if they were already known (including flipping a "left"
  // entry back to "online" if they reconnected within the grace window)
  liveList.forEach(p => {
    const id = String(p.id ?? p.Id);
    seenIds.add(id);
    roster.set(id, {
      id: p.id ?? p.Id,
      name: p.name ?? p.Name ?? 'unknown',
      ping: p.ping ?? p.Ping ?? null,
      discordId: extractDiscordId(p),
      status: 'online',
      leftAt: null,
    });
  });

  // anyone known but missing from this fetch just disconnected (or has
  // been gone for a while) — mark them left, and drop them once they've
  // been gone longer than the grace period
  for (const [id, rec] of roster) {
    if (seenIds.has(id)) continue;

    if (rec.status === 'online') {
      rec.status = 'left';
      rec.leftAt = now;
    }

    if (rec.leftAt && now - rec.leftAt > LEAVE_GRACE_MS) {
      roster.delete(id);
    }
  }
}

// Serve the dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint — the browser calls THIS (same-origin), not the game server
app.get('/api/players', async (req, res) => {
  try {
    // give up after a few seconds instead of leaving the page stuck on
    // "CHECKING" when the game server never answers
    const resp = await fetch(BACKEND_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`players.json returned HTTP ${resp.status}`);
    const liveList = await resp.json();

    updateRoster(liveList);

    const players = [...roster.values()];
    res.json({ players, leaveGraceMs: LEAVE_GRACE_MS });
  } catch (err) {
    const msg = err.name === 'TimeoutError'
      ? `players.json did not respond within ${FETCH_TIMEOUT_MS / 1000}s`
      : err.message;
    console.error('players.json fetch error:', msg);
    res.status(502).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`\n  LIOR_PLAYERLIST running at:`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  recently-left players stay visible for ${LEAVE_GRACE_MINUTES} minutes\n`);
});
