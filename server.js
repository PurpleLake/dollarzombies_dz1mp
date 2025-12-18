// Minimal static server for the 3D FPS engine (no build tools).
// Run: node server.js  then open http://localhost:3000
import http from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import url from "url";
import { MatchManager } from "./MatchManager.js";
import { DzsRuntime } from "./engine/core/dzs/runtime/DzsRuntime.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_MATCHES = Number(process.env.MAX_MATCHES) || 10;

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
  const base = path.resolve(root);
  const resolved = path.resolve(base, "." + clean);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

const DZS_LIBRARY_DIRS = [
  path.join(__dirname, "dzs_library"),
  path.join(__dirname, "public", "dzs_samples"),
];

function readJsonBody(req){
  return new Promise((resolve, reject)=>{
    let raw = "";
    req.on("data", (chunk)=>{ raw += chunk; });
    req.on("end", ()=>{
      if(!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err){ reject(err); }
    });
    req.on("error", reject);
  });
}

function sendJson(res, code, obj){
  const body = JSON.stringify(obj || {});
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function parseHeaderMeta(text, fallbackName){
  const lines = String(text || "").split(/\r?\n/);
  const meta = { name: fallbackName || "Unnamed Script", desc: "", version: "", tags: [] };
  for(const line of lines){
    const trimmed = line.trim();
    if(!trimmed) continue;
    if(!(trimmed.startsWith("//") || trimmed.startsWith("#"))) break;
    const content = trimmed.replace(/^\/\//, "").replace(/^#/, "").trim();
    if(!content.startsWith("@")) continue;
    const m = content.match(/^@(\w+)\s+(.*)$/);
    if(!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if(key === "name") meta.name = val;
    else if(key === "desc") meta.desc = val;
    else if(key === "version") meta.version = val;
    else if(key === "tags") meta.tags = val.split(/[,\s]+/).map(t=>t.trim()).filter(Boolean);
  }
  return meta;
}

function buildLibraryList(){
  const out = [];
  for(const dir of DZS_LIBRARY_DIRS){
    if(!fs.existsSync(dir)) continue;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for(const item of items){
      if(!item.isFile()) continue;
      if(!item.name.toLowerCase().endsWith(".dzs")) continue;
      const full = path.join(dir, item.name);
      const rel = path.relative(__dirname, full).replace(/\\/g, "/");
      let text = "";
      try { text = fs.readFileSync(full, "utf8"); } catch {}
      const meta = parseHeaderMeta(text, item.name.replace(/\.dzs$/i, ""));
      out.push({
        id: rel,
        filename: rel,
        name: meta.name,
        desc: meta.desc,
        version: meta.version,
        tags: meta.tags,
      });
    }
  }
  out.sort((a, b)=> a.name.localeCompare(b.name));
  return out;
}

function readLibraryFile(filename){
  const clean = String(filename || "").replace(/\\/g, "/");
  if(!clean) return null;
  const full = safeJoin(__dirname, "/" + clean);
  if(!full) return null;
  for(const dir of DZS_LIBRARY_DIRS){
    const base = path.resolve(dir);
    if(full === base || full.startsWith(base + path.sep)){
      if(fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    }
  }
  return null;
}

function parseValidationError(text, err){
  const msg = String(err?.message || err || "Parse error");
  const lineMatch = msg.match(/@line\s+(\d+)/i) || msg.match(/:(\d+)\s/);
  const line = lineMatch ? Math.max(1, Number(lineMatch[1])) : 1;
  const lines = String(text || "").split(/\r?\n/);
  const snippet = lines[line - 1] || "";
  return { line, col: 1, message: msg, snippet };
}

function validateDzs(text){
  const runtime = new DzsRuntime({ events: { emit: ()=>{} }, ctx: { events: { emit: ()=>{} } } });
  try{
    runtime.loadText(String(text || ""), "(validate)", "validate");
    return { ok: true, errors: [] };
  } catch (err){
    return { ok: false, errors: [parseValidationError(text, err)] };
  }
}

const dzsScripts = new Map(); // scriptId -> record
const dzsByMatch = new Map(); // matchId -> Set<scriptId>
let dzsSeq = 1;

function getMatchScripts(matchId){
  const id = String(matchId || "global");
  if(!dzsByMatch.has(id)) dzsByMatch.set(id, new Set());
  return dzsByMatch.get(id);
}

function addScriptRecord(matchId, record){
  dzsScripts.set(record.scriptId, record);
  getMatchScripts(matchId).add(record.scriptId);
}

function removeScriptRecord(scriptId){
  const rec = dzsScripts.get(scriptId);
  if(!rec) return false;
  dzsScripts.delete(scriptId);
  const set = dzsByMatch.get(String(rec.matchId || "global"));
  if(set) set.delete(scriptId);
  return true;
}

function getReqClientId(req, body){
  return body?.clientId || req.headers["x-dzs-client-id"] || req.headers["x-client-id"] || null;
}

function getReqMatchId(req, body, u){
  return body?.matchId || req.headers["x-dzs-match-id"] || u?.searchParams?.get("matchId") || null;
}

function isHostForMatch(matchId, clientId){
  if(!matchId || !clientId) return false;
  const match = matchManager.getMatch(matchId);
  if(!match) return false;
  return String(match.hostPlayerId) === String(clientId);
}

function isMatchLobby(matchId){
  if(!matchId) return false;
  const match = matchManager.getMatch(matchId);
  return match?.status === "lobby";
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(u.pathname);
    if (pathname === "/") pathname = "/public/index.html";

    if(pathname === "/api/dzs/library" && req.method === "GET"){
      sendJson(res, 200, { ok: true, scripts: buildLibraryList() });
      return;
    }

    if(pathname === "/api/dzs/library/read" && req.method === "GET"){
      const filename = u.searchParams.get("filename") || "";
      const full = readLibraryFile(filename);
      if(!full){
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
      }
      const text = fs.readFileSync(full, "utf8");
      sendJson(res, 200, { ok: true, filename, text });
      return;
    }

    if(pathname === "/api/dzs/validate" && req.method === "POST"){
      readJsonBody(req).then((body)=>{
        const result = validateDzs(body?.text || "");
        sendJson(res, 200, result);
      }).catch((err)=>{
        sendJson(res, 400, { ok: false, error: "bad_json", detail: String(err?.message || err) });
      });
      return;
    }

    if(pathname === "/api/dzs/installed" && req.method === "GET"){
      const matchId = getReqMatchId(req, null, u) || "global";
      const ids = getMatchScripts(matchId);
      const list = Array.from(ids).map(id=>dzsScripts.get(id)).filter(Boolean).map(rec=>({
        scriptId: rec.scriptId,
        filename: rec.filename,
        name: rec.name,
        desc: rec.desc,
        version: rec.version,
        tags: rec.tags,
        enabled: rec.enabled,
        ownerId: rec.ownerId,
        matchId: rec.matchId,
      }));
      sendJson(res, 200, { ok: true, scripts: list });
      return;
    }

    if(pathname === "/api/dzs/inject" && req.method === "POST"){
      readJsonBody(req).then((body)=>{
        const matchId = getReqMatchId(req, body, u);
        const clientId = getReqClientId(req, body);
        if(!isHostForMatch(matchId, clientId)){
          sendJson(res, 403, { ok: false, error: "not_host" });
          return;
        }
        if(!isMatchLobby(matchId)){
          sendJson(res, 409, { ok: false, error: "not_in_lobby" });
          return;
        }
        const filename = String(body?.filename || "(dzs)");
        const text = String(body?.text || "");
        const meta = parseHeaderMeta(text, filename.replace(/\.dzs$/i, ""));
        const scriptId = `dzs_${dzsSeq++}`;
        const record = {
          scriptId,
          matchId: String(matchId || "global"),
          filename,
          name: meta.name,
          desc: meta.desc,
          version: meta.version,
          tags: meta.tags,
          enabled: true,
          ownerId: clientId ? String(clientId) : null,
          installedAt: Date.now(),
        };
        addScriptRecord(matchId, record);
        sendJson(res, 200, { ok: true, scriptId });
      }).catch((err)=>{
        sendJson(res, 400, { ok: false, error: "bad_json", detail: String(err?.message || err) });
      });
      return;
    }

    if(pathname === "/api/dzs/disable" && req.method === "POST"){
      readJsonBody(req).then((body)=>{
        const scriptId = String(body?.scriptId || "");
        const rec = dzsScripts.get(scriptId);
        if(!rec){
          sendJson(res, 404, { ok: false, error: "not_found" });
          return;
        }
        const matchId = rec.matchId;
        const clientId = getReqClientId(req, body);
        if(!isHostForMatch(matchId, clientId)){
          sendJson(res, 403, { ok: false, error: "not_host" });
          return;
        }
        if(!isMatchLobby(matchId)){
          sendJson(res, 409, { ok: false, error: "not_in_lobby" });
          return;
        }
        rec.enabled = false;
        sendJson(res, 200, { ok: true });
      }).catch((err)=>{
        sendJson(res, 400, { ok: false, error: "bad_json", detail: String(err?.message || err) });
      });
      return;
    }

    if(pathname === "/api/dzs/unload" && req.method === "POST"){
      readJsonBody(req).then((body)=>{
        const scriptId = String(body?.scriptId || "");
        const rec = dzsScripts.get(scriptId);
        if(!rec){
          sendJson(res, 404, { ok: false, error: "not_found" });
          return;
        }
        const matchId = rec.matchId;
        const clientId = getReqClientId(req, body);
        if(!isHostForMatch(matchId, clientId)){
          sendJson(res, 403, { ok: false, error: "not_host" });
          return;
        }
        if(!isMatchLobby(matchId)){
          sendJson(res, 409, { ok: false, error: "not_in_lobby" });
          return;
        }
        removeScriptRecord(scriptId);
        sendJson(res, 200, { ok: true });
      }).catch((err)=>{
        sendJson(res, 400, { ok: false, error: "bad_json", detail: String(err?.message || err) });
      });
      return;
    }

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

const netState = {
  nextId: 1,
  clients: new Map(), // id -> { id, ws, name, matchId, queueMode, lastSnap }
};

const matchManager = new MatchManager({ maxMatches: MAX_MATCHES, send: wsSend });
const queues = {
  solo: [],
  zombies: [],
};

function getQueue(mode){
  return mode === "zombies" ? queues.zombies : queues.solo;
}

function removeFromQueue(client){
  if(!client?.queueMode) return;
  const q = getQueue(client.queueMode);
  const idx = q.indexOf(client.id);
  if(idx >= 0) q.splice(idx, 1);
  client.queueMode = null;
}

function sendQueueStatus(mode){
  const q = getQueue(mode);
  for(const id of q){
    const c = netState.clients.get(id);
    if(!c) continue;
    wsSend(c.ws, { t:"queueStatus", mode, queuedCount: q.length, eta: null });
  }
}

function tryFormMatches(mode){
  const q = getQueue(mode);
  const maxPlayers = mode === "zombies" ? 4 : 1;
  while(q.length && matchManager.matches.size < MAX_MATCHES){
    const matchId = matchManager.createMatch(mode, {});
    if(!matchId) break;
    const group = q.splice(0, maxPlayers);
    for(const id of group){
      const client = netState.clients.get(id);
      if(!client) continue;
      client.queueMode = null;
      const res = matchManager.joinMatch(matchId, client);
      if(res.ok){
        const hostId = res.match.hostPlayerId;
        wsSend(client.ws, {
          t:"matchFound",
          matchId,
          mode,
          hostPlayerId: hostId,
          youAreHost: String(client.id) === String(hostId),
        });
      }
    }
    const match = matchManager.getMatch(matchId);
    if(match) matchManager.sendLobbyState(match);
  }
  sendQueueStatus(mode);
}

function broadcastMatchStates(){
  for(const match of matchManager.matches.values()){
    if(match.status !== "active") continue;
    const players = [];
    for(const p of match.players.values()){
      const s = p.lastSnap || {};
      players.push({
        id: p.id,
        name: p.name,
        team: 0,
        mode: match.mode,
        hp: s.hp ?? 100,
        pos: s.pos ?? {x:0,y:1.7,z:0},
        rot: s.rot ?? {yaw:0,pitch:0},
        weaponId: s.weaponId ?? null
      });
    }
    matchManager.broadcast(match, { t:"state", players });
  }
  matchManager.tick();
}

// Broadcast at 10hz
setInterval(broadcastMatchStates, 100);

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
    const id = String(netState.nextId++);
    const name = `Player${id}`;
    const client = { id, ws: sock, name, matchId: null, queueMode: null, lastSnap: { pos:{x:0,y:1.7,z:0}, rot:{yaw:0,pitch:0}, hp:100 } };

    netState.clients.set(id, client);
    wsSend(sock, { t:"welcome", id, name });

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

        const client = netState.clients.get(id);
        if(!client) continue;

        if(msg.t === "hello"){
          wsSend(sock, { t:"welcome", id, name: client.name });
        } else if(msg.t === "setMode"){
          wsSend(sock, { t:"welcome", id, name: client.name });
        } else if(msg.t === "queueJoin"){
          const mode = msg.mode === "zombies" ? "zombies" : "solo";
          if(client.matchId) matchManager.leaveMatch(client, "queueJoin");
          removeFromQueue(client);
          const q = getQueue(mode);
          if(!q.includes(client.id)){
            q.push(client.id);
            client.queueMode = mode;
          }
          sendQueueStatus(mode);
          tryFormMatches(mode);
        } else if(msg.t === "queueLeave"){
          const mode = client.queueMode;
          removeFromQueue(client);
          if(mode) sendQueueStatus(mode);
        } else if(msg.t === "serverList"){
          const showAll = Boolean(msg.showAll);
          const servers = matchManager.buildServerList({ showAll });
          wsSend(sock, { t:"serverList", servers });
        } else if(msg.t === "serverMaster"){
          const diag = matchManager.buildServerMaster();
          wsSend(sock, {
            t:"serverMaster",
            maxMatches: diag.maxMatches,
            queues: { solo: queues.solo.length, zombies: queues.zombies.length },
            matches: diag.matches,
          });
        } else if(msg.t === "joinMatch"){
          const matchId = String(msg.matchId || "");
          if(client.queueMode) removeFromQueue(client);
          if(client.matchId && client.matchId !== matchId){
            matchManager.leaveMatch(client, "joinMatch");
          }
          const res = matchManager.joinMatch(matchId, client);
          if(!res.ok){
            wsSend(sock, { t:"joinFailed", matchId, reason: res.reason });
            continue;
          }
          const hostId = res.match.hostPlayerId;
          wsSend(sock, {
            t:"matchFound",
            matchId,
            mode: res.match.mode,
            hostPlayerId: hostId,
            youAreHost: String(client.id) === String(hostId),
          });
          matchManager.sendLobbyState(res.match);
        } else if(msg.t === "leaveMatch"){
          matchManager.leaveMatch(client, "left");
        } else if(msg.t === "startMatch"){
          if(!client.matchId) continue;
          matchManager.startMatch(client.matchId, client);
        } else if(msg.t === "endMatch"){
          if(!client.matchId) continue;
          const match = matchManager.getMatch(client.matchId);
          if(match && String(match.hostPlayerId) === String(client.id)){
            matchManager.endMatch(match.matchId, "hostEnded");
          }
        } else if(msg.t === "endMatchAdmin"){
          const matchId = String(msg.matchId || "");
          const match = matchManager.getMatch(matchId);
          if(!match){
            wsSend(sock, { t:"endMatchDenied", matchId, reason:"not_found" });
            continue;
          }
          if(match.hostPlayerId && String(match.hostPlayerId) === String(client.id)){
            matchManager.endMatch(match.matchId, "adminEnded");
          } else {
            wsSend(sock, { t:"endMatchDenied", matchId, reason:"not_host" });
          }
        } else if(msg.t === "lobby_ready"){
          if(!client.matchId) continue;
          matchManager.setReady(client.matchId, msg.playerId || client.id, msg.ready);
        } else if(msg.t === "lobby_vote"){
          if(!client.matchId) continue;
          matchManager.setVote(client.matchId, msg.playerId || client.id, msg.mapId);
        } else if(msg.t === "hit"){
          if(!client.matchId) continue;
          const match = matchManager.getMatch(client.matchId);
          if(!match || match.status !== "active" || match.mode !== "solo") continue;
          const targetId = String(msg.targetId || "");
          const dmg = Math.max(1, Math.min(200, Number(msg.amount || 20)));
          const tgt = match.players.get(targetId);
          if(!tgt) continue;

          tgt.lastSnap = tgt.lastSnap || {};
          const hp0 = Number(tgt.lastSnap.hp ?? 100);
          const hp1 = Math.max(0, hp0 - dmg);
          tgt.lastSnap.hp = hp1;

          wsSend(client.ws, { t:"hitConfirm", targetId, amount: dmg, hp: hp1 });
          wsSend(tgt.ws, { t:"gotHit", attackerId: id, amount: dmg, hp: hp1 });
          if(hp1 <= 0){
            tgt.lastSnap.hp = 100;
            wsSend(tgt.ws, { t:"died", attackerId: id });
            wsSend(client.ws, { t:"killed", targetId });
          }
        } else if(msg.t === "snap"){
          client.lastSnap = { pos: msg.pos, rot: msg.rot, hp: msg.hp, weaponId: msg.weaponId };
          if(client.matchId){
            const match = matchManager.getMatch(client.matchId);
            const p = match?.players?.get(String(client.id));
            if(p) p.lastSnap = client.lastSnap;
          }
        }
      }
    });

    sock.on("close", ()=>{
      const client = netState.clients.get(id);
      if(client){
        removeFromQueue(client);
        matchManager.leaveMatch(client, "disconnect");
      }
      netState.clients.delete(id);
    });

    sock.on("end", ()=>{
      const client = netState.clients.get(id);
      if(client){
        removeFromQueue(client);
        matchManager.leaveMatch(client, "disconnect");
      }
      netState.clients.delete(id);
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
