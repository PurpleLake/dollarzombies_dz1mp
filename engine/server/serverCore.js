// engine/server/serverCore.js (CommonJS)
// Minimal HTTP + WebSocket server with pluggable game connection handler.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function mimeType(filePath){
  switch (path.extname(filePath).toLowerCase()){
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.ico': return 'image/x-icon';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.glb': return 'model/gltf-binary';
    case '.gltf': return 'model/gltf+json; charset=utf-8';
    case '.bin': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

function safeJoin(base, reqPath){
  const p = decodeURIComponent(reqPath.split('?')[0]);
  const clean = p.replace(/\\/g, '/');
  const joined = path.join(base, clean);
  if (!joined.startsWith(base)) return null;
  return joined;
}

class MiniWS {
  constructor(socket){
    this.socket = socket;
    this.readyState = 1;
    this._handlers = { message: [], close: [] };
    socket.on('data', (buf) => this._onData(buf));
    socket.on('close', () => this._onClose());
    socket.on('end', () => this._onClose());
    socket.on('error', () => this._onClose());
  }
  on(evt, fn){
    if (this._handlers[evt]) this._handlers[evt].push(fn);
  }
  send(data){
    if (this.readyState !== 1) return;
    const payload = Buffer.from(String(data));
    this.socket.write(this._frameText(payload));
  }
  close(){
    try { this.readyState = 3; this.socket.end(); } catch {}
  }
  _emit(evt, arg){
    for (const fn of this._handlers[evt] || []){
      try { fn(arg); } catch {}
    }
  }
  _onClose(){
    if (this.readyState === 3) return;
    this.readyState = 3;
    this._emit('close');
  }
  _frameText(payload){
    const len = payload.length;
    let header;
    if (len < 126){
      header = Buffer.alloc(2);
      header[0] = 0x81;
      header[1] = len;
    } else if (len < 65536){
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
  }
  _onData(buf){
    let offset = 0;
    while (offset + 2 <= buf.length){
      const b0 = buf[offset];
      const b1 = buf[offset + 1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      offset += 2;
      if (len === 126){
        if (offset + 2 > buf.length) return;
        len = buf.readUInt16BE(offset);
        offset += 2;
      } else if (len === 127){
        if (offset + 8 > buf.length) return;
        const big = buf.readBigUInt64BE(offset);
        offset += 8;
        if (big > BigInt(1e7)) { this.close(); return; }
        len = Number(big);
      }
      let mask;
      if (masked){
        if (offset + 4 > buf.length) return;
        mask = buf.subarray(offset, offset + 4);
        offset += 4;
      }
      if (offset + len > buf.length) return;
      let payload = buf.subarray(offset, offset + len);
      offset += len;

      if (masked){
        const out = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ mask[i % 4];
        payload = out;
      }

      if (opcode === 0x8){ this.close(); return; }
      if (opcode === 0x1){ this._emit('message', payload); }
      if (!fin){ this.close(); return; }
    }
  }
}

function startServer(opts){
  const {
    port = 3000,
    rootDir = process.cwd(),
    staticMounts = [
      { urlPrefix: '/', dir: path.join(rootDir, 'public') },
      { urlPrefix: '/engine/', dir: path.join(rootDir, 'engine') },
      { urlPrefix: '/game/', dir: path.join(rootDir, 'game') },
    ],
    onConnection,
  } = opts || {};

  const server = http.createServer((req, res) => {
    if (!req.url) return res.end();
    let urlPath = req.url;
    if (urlPath === '/') urlPath = '/index.html';

    // Find best mount (longest matching prefix). Default is '/'.
    let mount = null;
    for (const m of staticMounts){
      if (urlPath.startsWith(m.urlPrefix)){
        if (!mount || m.urlPrefix.length > mount.urlPrefix.length) mount = m;
      }
    }
    if (!mount){
      mount = staticMounts.find(m => m.urlPrefix === '/');
    }
    if (!mount){ res.writeHead(404); return res.end('Not found'); }

    let relPath = urlPath;
    if (mount.urlPrefix !== '/'){
      // Strip the mount prefix (e.g. '/engine') and keep a leading '/'
      relPath = urlPath.slice(mount.urlPrefix.length);
      if (!relPath.startsWith('/')) relPath = '/' + relPath;
      if (relPath === '/') relPath = '/index.html';
    }

    const filePath = safeJoin(mount.dir, relPath);
    if (!filePath){ res.writeHead(400); return res.end('Bad request'); }

    fs.readFile(filePath, (err, data) => {
      if (err){ res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mimeType(filePath), 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });

  const clients = new Set();

  server.on('upgrade', (req, socket) => {
    try {
      if ((req.headers.upgrade || '').toLowerCase() !== 'websocket'){
        socket.destroy();
        return;
      }
      const key = req.headers['sec-websocket-key'];
      if (!key){ socket.destroy(); return; }
      const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n',
      ];
      socket.write(headers.join('\r\n'));
      const ws = new MiniWS(socket);
      clients.add(ws);
      ws.on('close', () => clients.delete(ws));
      if (onConnection) onConnection(ws, { clients });
    } catch {
      try { socket.destroy(); } catch {}
    }
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  return { server, clients };
}

module.exports = { startServer, MiniWS };
