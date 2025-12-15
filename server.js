// server.js (bootstrap)
// Starts the engine server core and mounts the Zombies (zm) game module.

const path = require('path');
const { startServer } = require('./engine/server/serverCore');
const { createZMServer } = require('./game/zm/zmServer');

const publicDir = path.join(__dirname, 'public');
const engineDir = path.join(__dirname, 'engine');
const gameDir = path.join(__dirname, 'game');

// Create game instance (receives WS client set from engine core).
let zm = null;

startServer({
  port: 3000,
  staticMounts: [
    { urlPrefix: '/', dir: publicDir },
    { urlPrefix: '/engine/', dir: engineDir },
    { urlPrefix: '/game/', dir: gameDir },
  ],
  onConnection: (ws, ctx) => {
    try { console.log('[ws] client connected'); } catch {}
    if (!zm){
      // IMPORTANT: The game must run without any external script files.
      // We only load .dzs scripts when explicitly enabled.
      zm = createZMServer({ clients: ctx.clients, skipDefaultScript: true });
      try { console.log('[game] ZM server created'); } catch {}
    }
    zm.handleConnection(ws);
  }
});
