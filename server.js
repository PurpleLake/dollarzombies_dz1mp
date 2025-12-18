// Minimal static server for the 3D FPS engine (no build tools).
// Run: node server.js  then open http://localhost:3000
import http from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import url from "url";
import { MatchManager } from "./MatchManager.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".dzs": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(root, reqPath) {
  const clean = reqPath.replace(/\0/g, "");
  const joined = path.join(root, clean);
  if (!joined.startsWith(root)) return null;
  return joined;
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(u.pathname);
    if (pathname === "/") pathname = "/public/index.html";

    const filePath = safeJoin(__dirname, pathname);
    if (!filePath) {
      res.writeHead(400); res.end("Bad path"); return;
    }

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404); res.end("Not found"); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    res.writeHead(500); res.end(String(e?.stack || e));
  }
});



// --- Minimal WebSocket server (no deps) for multiplayer prototypes ---
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function wsAcceptKey(key){
  return crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
}

function wsSend(sock, obj){
  try{
    const data = Buffer.from(JSON.stringify(obj));
    const len = data.length;
    let header;
    if(len < 126){
      header = Buffer.from([0x81, len]);
    } else if(len < 65536){
      header = Buffer.from([0x81, 126, (len>>8)&255, len&255]);
    } else {
      // not expected
      header = Buffer.from([0x81, 127, 0,0,0,0, (len>>24)&255, (len>>16)&255, (len>>8)&255, len&255]);
    }
    sock.write(Buffer.concat([header, data]));
  } catch {}
}

function wsClose(sock){
  try{ sock.end(); } catch {}
}

function wsParseFrame(buf){
  if(buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let off = 2;
  if(len === 126){
    if(buf.length < off+2) return null;
    len = buf.readUInt16BE(off); off += 2;
  } else if(len === 127){
    if(buf.length < off+8) return null;
    // only low 32 bits supported
    off += 4;
    len = buf.readUInt32BE(off); off += 4;
  }
  let mask;
  if(masked){
    if(buf.length < off+4) return null;
    mask = buf.slice(off, off+4); off += 4;
  }
  if(buf.length < off+len) return null;
  let payload = buf.slice(off, off+len);
  const rest = buf.slice(off+len);
  if(masked){
    const out = Buffer.alloc(payload.length);
    for(let i=0;i<payload.length;i++) out[i] = payload[i] ^ mask[i%4];
    payload = out;
  }
  return { fin, opcode, payload, rest };
}

const MAX_MATCHES = Number(process.env.MAX_MATCHES) || 10;
const matchManager = new MatchManager({ wsSend, maxMatches: MAX_MATCHES });

// Tick match state (10hz)
setInterval(()=> matchManager.tick(), 100);

server.on("upgrade", (req, sock) => {
  try{
    const u = new URL(req.url, `http://${req.headers.host}`);
    if(u.pathname !== "/ws"){ sock.destroy(); return; }

    const key = req.headers["sec-websocket-key"];
    if(!key){ sock.destroy(); return; }

    // handshake
    const accept = wsAcceptKey(key);
    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n",
    ];
    sock.write(headers.join("\r\n"));

    // register
    const player = matchManager.registerPlayer(sock);
    const playerId = player.id;
    wsSend(sock, { t:"welcome", id: playerId, name: player.name });

    let buffer = Buffer.alloc(0);
    sock.on("data", (chunk)=>{
      buffer = Buffer.concat([buffer, chunk]);
      while(true){
        const frame = wsParseFrame(buffer);
        if(!frame) break;
        buffer = frame.rest;

        if(frame.opcode === 0x8){ // close
          wsClose(sock);
          break;
        }
        if(frame.opcode !== 0x1) continue; // text only
        const txt = frame.payload.toString("utf8");
        let msg;
        try{ msg = JSON.parse(txt); } catch { continue; }

        const client = matchManager.getPlayer(playerId);
        if(!client) continue;

        if(msg.t === "queueJoin"){
          matchManager.queueJoin(client, msg.mode);
        } else if(msg.t === "queueLeave"){
          matchManager.queueLeave(client);
        } else if(msg.t === "serverList"){
          matchManager.sendServerList(client, { showAll: Boolean(msg.showAll) });
        } else if(msg.t === "joinMatch"){
          matchManager.joinMatch(msg.matchId, client);
        } else if(msg.t === "leaveMatch"){
          matchManager.leaveMatch(client, "leaveMatch");
        } else if(msg.t === "lobby_start"){
          matchManager.handleLobbyStart(client);
        } else if(msg.t === "endMatch"){
          const match = client.matchId ? matchManager.matches.get(client.matchId) : null;
          if(match && match.hostPlayerId === client.id){
            matchManager.endMatch(client.matchId, "endedByHost");
          }
        } else if(msg.t === "hit"){
          matchManager.handleHit(client, msg);
        } else if(msg.t === "snap"){
          matchManager.handleSnapshot(client, msg);
        } else if(msg.t === "lobby_ready"){
          matchManager.handleLobbyReady(client, msg.ready);
        } else if(msg.t === "lobby_vote"){
          matchManager.handleLobbyVote(client, msg.mapId);
        } else if(msg.t === "lobby_motd"){
          const text = typeof msg.text === "string" ? msg.text : "";
          matchManager.relayToMatch(client, { t:"lobby_motd", text });
        }
      }
    });

    sock.on("close", ()=>{
      matchManager.removePlayer(playerId);
    });

    sock.on("end", ()=>{
      matchManager.removePlayer(playerId);
    });
  } catch {
    try{ sock.destroy(); } catch {}
  }
});


function startServer(port, retries=8){
  const targetPort = Number(port) || 3000;

  const onError = (err) => {
    server.removeListener("listening", onListen);
    if(err?.code === "EADDRINUSE" && retries > 0){
      const nextPort = targetPort + 1;
      console.warn(`[server] Port ${targetPort} in use, trying ${nextPort}`);
      startServer(nextPort, retries - 1);
      return;
    }
    console.error(`[server] Failed to bind to port ${targetPort}: ${err?.message || err}`);
    process.exit(1);
  };

  const onListen = () => {
    server.removeListener("error", onError);
    console.log(`[server] http://localhost:${targetPort}`);
  };

  server.once("error", onError);
  server.once("listening", onListen);
  server.listen(targetPort);
}

startServer(PORT);
