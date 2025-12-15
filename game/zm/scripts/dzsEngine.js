// game/zm/scripts/dzsEngine.js
// Dollar Zombies Script (.dzs) engine (parser + event runtime).
const fs = require('fs');
const path = require('path');

function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function createDzsEngine(ctx){
  // Context wiring
  const ARENA = ctx.arena || ctx.ARENA || { size: 80 };
  const OBSTACLES = ctx.obstacles;
  const PROPS = ctx.props || ctx.mapProps || ctx.staticProps || [];
  const SKY = ctx.sky || ctx.staticSky || null;
  const onStaticChanged = ctx.onStaticChanged || null;
  const PICKUPS = ctx.pickups;
  const players = ctx.players;
  const WEAPONS = ctx.weapons || {};
  const hud = ctx.hud;
  const log = ctx.log || ((...a)=>console.log(...a));

  // Auto-generated help exported to clients (used by Dev Menu).
  // Keep this list aligned with the parser features below.
  const HELP = {
    version: "v2",
    updated: new Date().toISOString().slice(0,10),
    items: [
      { name:"spawn box", kind:"command", syntax:"spawn box x=<num> z=<num> hx=<num> hz=<num> h=<num>",
        desc:"Spawn a static collision box (crate/barrier).",
        params:[["x","World X position"],["z","World Z position"],["hx","Half-width"],["hz","Half-depth"],["h","Height"]],
        examples:[`spawn box x=8 z=14 hx=1.4 hz=1.0 h=1.6`]
      },
      { name:"spawn bush", kind:"command", syntax:"spawn bush x=<num> z=<num> hx=<num> hz=<num> h=<num>",
  desc:"Spawn a static collision bush (client renders a bush; server uses it like a crate).",
  params:[["x","World X position"],["z","World Z position"],["hx","Half-width"],["hz","Half-depth"],["h","Height"]],
  examples:[`spawn bush x=8 z=14 hx=1.4 hz=1.0 h=1.6`]
},
{ name:"spawn car", kind:"command", syntax:"spawn car x=<num> z=<num> [ry=<deg>] [hx=<num> hz=<num> h=<num>]",
  desc:"Spawn a static car prop (also blocks movement).",
  params:[["x","World X position"],["z","World Z position"],["ry","Yaw degrees"],["hx","Half-width"],["hz","Half-depth"],["h","Height"]],
  examples:[`spawn car x=6 z=-10 ry=90`]
},
{ name:"spawn bus", kind:"command", syntax:"spawn bus x=<num> z=<num> [ry=<deg>] [hx=<num> hz=<num> h=<num>]",
  desc:"Spawn a static bus prop (also blocks movement).",
  params:[["x","World X position"],["z","World Z position"],["ry","Yaw degrees"],["hx","Half-width"],["hz","Half-depth"],["h","Height"]],
  examples:[`spawn bus x=-12 z=-6 ry=0`]
},
{ name:"skybox", kind:"command", syntax:"skybox type=<gradient|color> [top=<hex>] [bottom=<hex>]",
  desc:"Set a simple sky on clients (visual-only).",
  params:[["type","gradient or color"],["top","Top color hex (e.g. 0x88aaff)"],["bottom","Bottom color hex"]],
  examples:[`skybox type=gradient top=0x88aaff bottom=0x0b1020`]
},
      { name:"spawn weapon", kind:"command", syntax:"spawn weapon weapon=<weaponId> x=<num> z=<num>",
        desc:"Spawn a weapon pickup.",
        params:[["weapon","Weapon id (from weapon defs)"],["x","World X position"],["z","World Z position"]],
        examples:[`spawn weapon weapon=glock x=2 z=6`]
      },
      { name:"spawn zombie", kind:"command", syntax:"spawn zombie x=<num> z=<num>",
        desc:"Spawn a zombie (if enabled by the host).",
        params:[["x","World X position"],["z","World Z position"]],
        examples:[`spawn zombie x=24 z=24`]
      },
      { name:"hudText", kind:"command", syntax:'hudText target=<selector> key="id" x=<0..1> y=<0..1> size=<px> text="..." [align=left|center|right] [alpha=<0..1>]',
        desc:"Draw/update HUD text for target players.",
        params:[["target","all | self | player(id) | player:<id> | radius(x,z,r)"],
               ["key","Stable element id"],["x,y","Normalized screen pos"],["size","Font size in px"],["text","Displayed text"],
               ["align","left/center/right (optional)"],["alpha","0..1 (optional)"]],
        examples:[`hudText target=all key="hud:title" x=0.02 y=0.03 size=22 text="DOLLAR ZOMBIES" align=left alpha=0.95`]
      },
      { name:"hudRect", kind:"command", syntax:'hudRect target=<selector> key="id" x=<0..1> y=<0..1> w=<0..1> h=<0..1> [alpha=<0..1>]',
        desc:"Draw/update a HUD rectangle (bars/backgrounds).",
        params:[["target","all | self | player(id) | radius(x,z,r)"],
               ["key","Stable element id"],["x,y","Normalized screen pos"],["w,h","Normalized width/height"],
               ["alpha","0..1 (optional)"]],
        examples:[`hudRect target=self key="hud:hpBg" x=0.02 y=0.11 w=0.18 h=0.02 alpha=0.35`]
      },
      { name:"hudClear", kind:"command", syntax:'hudClear target=<selector> [key="id"]',
        desc:"Clear HUD elements for a target (all, or one by key).",
        params:[["target","all | self | player(id) | radius(x,z,r)"],["key","Element id to clear (optional)"]],
        examples:[`hudClear target=self`, `hudClear target=all key="hud:title"`]
      },
      { name:"on gameStart", kind:"event", syntax:"on gameStart { ... }",
        desc:"Runs once after the server finishes initializing the match.", params:[], examples:[`on gameStart { hudText target=all key="boot" x=0.02 y=0.02 size=18 text="Ready" }`]
      },
      { name:"on tick", kind:"event", syntax:"on tick { ... }",
        desc:"Runs repeatedly every server tick (keep logic light).", params:[], examples:[`on tick { hudText target=all key="t" x=0.02 y=0.06 size=14 text="Ticking" }`]
      },
      { name:"on playerSpawn", kind:"event", syntax:"on playerSpawn { ... }",
        desc:"Runs when a player spawns. target=self is valid here.", params:[], examples:[`on playerSpawn { hudText target=self key="spawn" x=0.5 y=0.15 size=18 text="Welcome" align=center }`]
      },
      { name:"on playerDeath", kind:"event", syntax:"on playerDeath { ... }",
        desc:"Runs when a player dies.", params:[], examples:[`on playerDeath { hudClear target=self }`]
      },
      { name:"on damage", kind:"event", syntax:"on damage { ... }",
        desc:"Runs when a player damages a zombie.", params:[], examples:[`on damage { if (part == "head") { addCash(1) } }`]
      },
      { name:"on kill", kind:"event", syntax:"on kill { ... }",
        desc:"Runs when a player kills a zombie.", params:[], examples:[`on kill { addCash(2) }`]
      },
      { name:"addCash(n)", kind:"function", syntax:"addCash(<num>)",
        desc:"Add cash to the event player.", params:[["n","Amount to add"]], examples:[`on kill { addCash(5) }`]
      },
      { name:"takeCash(n)", kind:"function", syntax:"takeCash(<num>)",
        desc:"Remove cash from the event player.", params:[["n","Amount to remove"]], examples:[`on damage { takeCash(1) }`]
      },
      { name:"setCash(n)", kind:"function", syntax:"setCash(<num>)",
        desc:"Set cash for the event player.", params:[["n","New cash value"]], examples:[`on gameStart { setCash(0) }`]
      },
    ],
  };
  const getWave = ctx.getWave || (()=>1);
  const SCRIPT_EVENTS = { damage: [], kill: [], gameStart: [], tick: [], playerSpawn: [], playerDeath: [] };

// ---- Script events (v2) ----
// Handlers are registered via:
//   on damage { ... }
//   on kill { ... }
// Optional condition:
//   on damage (dmg > 10 && part=="head") { ... }

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function genObstacles(){
  OBSTACLES.length = 0;
  const rnd = mulberry32(0xD011A2B1); // stable seed (just a fun number)
  const s = ARENA.size/2 - 10;
  const count = 18;
  for (let i=0;i<count;i++){
    const hx = 0.9 + rnd()*1.4;
    const hz = 0.9 + rnd()*1.4;
    let x = (rnd()*2-1) * s;
    let z = (rnd()*2-1) * s;
    // keep center area clearer
    if (Math.hypot(x,z) < 12){
      x += (x<0?-1:1) * 14;
      z += (z<0?-1:1) * 14;
    }
    OBSTACLES.push({ id:`box_${i}`, x, z, hx, hz, h: 1.25 + rnd()*0.85 });
  }
}

function parseScriptValue(v, vars){
  if (v == null) return null;
  let s = String(v);
  // Template substitution: x=${i*2}
  if (s.includes('${')){
    s = s.replace(/\$\{([^}]+)\}/g, (_, expr) => {
      const out = evalScriptExpr(expr, vars);
      return String(out);
    });
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

function evalScriptExpr(expr, vars){
  const safe = String(expr).trim();
  // Very small safety gate: allow identifiers/numbers/operators only.
  // (Scripts are local files, but we still reject obviously dangerous tokens.)
  if (!/^[\w\s\d\+\-\*\/%.()<>!=&|,:?\[\]\$"']+$/.test(safe)){
    throw new Error(`Unsafe script expression: ${expr}`);
  }
  const keys = Object.keys(vars);
  const vals = keys.map(k => vars[k]);
  // Provide Math for convenience.
  const fn = new Function(...keys, 'Math', `return (${safe});`);
  return fn(...vals, Math);
}

function runScriptLines(lines, vars){
  function skipBlock(i){
    // assumes lines[i] is '{' or current line has already advanced to '{'
    if (lines[i] !== '{'){
      // find next '{'
      while (i < lines.length && lines[i] !== '{') i++;
    }
    if (lines[i] !== '{') return i;
    i++;
    let depth = 1;
    while (i < lines.length && depth > 0){
      if (lines[i] === '{') depth++;
      else if (lines[i] === '}') depth--;
      i++;
    }
    return i;
  }

  function execBlock(i){
    while (i < lines.length){
      const line = lines[i];
      if (!line || line.startsWith('#')){ i++; continue; }
      if (line === '}') return i + 1;

      // let/set/assignment
      if (/^(let|set)\s+/.test(line) || /^[A-Za-z_]\w*\s*=/.test(line)){
        const m = line.match(/^(?:let|set)?\s*([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (m){
          const name = m[1];
          const expr = m[2];
          vars[name] = evalScriptExpr(expr, vars);
        }
        i++; continue;
      }

      // if (cond) { ... } else { ... }
      if (line.startsWith('if')){
        const m = line.match(/^if\s*\((.+)\)\s*$/);
        const cond = m ? !!evalScriptExpr(m[1], vars) : false;
        i++;
        if (cond){
          // execute then block
          if (lines[i] !== '{') i = skipBlock(i); // malformed, skip
          else i = execBlock(i + 1);
          // if there's an else, skip it
          if (i < lines.length && lines[i] === 'else'){
            i++;
            i = skipBlock(i);
          }
        } else {
          // skip then block
          i = skipBlock(i);
          // optional else
          if (i < lines.length && lines[i] === 'else'){
            i++;
            if (lines[i] === '{') i = execBlock(i + 1);
            else i = skipBlock(i);
          }
        }
        continue;
      }

      // for (init; cond; step) { ... }
      if (line.startsWith('for')){
        const m = line.match(/^for\s*\((.*);(.*);(.*)\)\s*$/);
        const init = m ? m[1].trim() : '';
        const condExpr = m ? m[2].trim() : 'false';
        const step = m ? m[3].trim() : '';
        // run init
        if (init){
          const a = init.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
          if (a) vars[a[1]] = evalScriptExpr(a[2], vars);
          else evalScriptExpr(init, vars);
        }
        i++;
        if (lines[i] !== '{'){
          // malformed; nothing to execute
          continue;
        }
        const bodyStart = i + 1;
        const afterBody = skipBlock(i); // points after '}'
        let guard = 0;
        while (guard++ < 10000 && !!evalScriptExpr(condExpr || 'false', vars)){
          execBlock(bodyStart);
          if (step){
            const s = step.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
            if (s) vars[s[1]] = evalScriptExpr(s[2], vars);
            else evalScriptExpr(step, vars);
          }
        }
        i = afterBody;
        continue;
      }

      // spawn ...
      if (line.startsWith('spawn ')){
        const parts = line.split(/\s+/);
        const kind = parts[1];
        const kv = {};
        for (const p of parts.slice(2)){
          const [k,v] = p.split('=');
          if (!k) continue;
          kv[k] = parseScriptValue(v, vars);
        }
        const x = Number(kv.x ?? 0);
const z = Number(kv.z ?? 0);
const hx = Number(kv.hx ?? 1.2);
const hz = Number(kv.hz ?? 1.2);
const h  = Number(kv.h ?? 1.5);
const id = kv.id || uid();

// Obstacles (server collision). Client renders most of these as "bush" by default.
if (kind === 'box' || kind === 'bush'){
  OBSTACLES.push({ id, kind: (kind === 'box' ? 'bush' : 'bush'), x, z, hx, hz, h });
  if (onStaticChanged) onStaticChanged({ type:'obstacle', obstacle: OBSTACLES[OBSTACLES.length-1] });
}

// Props (visual + collision). Also create a matching obstacle for nav/blocking.
if (kind === 'car' || kind === 'bus'){
  const ry = Number(kv.ry ?? 0);
  const mesh = String(kv.mesh || kind);
  const prop = { id, kind, mesh, x, z, ry };
  PROPS.push(prop);

  // Default collision sizes if not supplied
  const dhx = kind === 'bus' ? 5.2 : 2.0;
  const dhz = kind === 'bus' ? 1.35 : 1.05;
  const dh  = kind === 'bus' ? 2.5 : 1.6;
  OBSTACLES.push({ id: `col_${id}`, kind, x, z, hx: (isFinite(hx)?hx:dhx), hz: (isFinite(hz)?hz:dhz), h: (isFinite(h)?h:dh) });

  if (onStaticChanged) onStaticChanged({ type:'prop', prop, obstacle: OBSTACLES[OBSTACLES.length-1] });
}
        // spawn zombie is intentionally not supported by default in the standalone DZS engine
        // unless the host game provides a factory. (Prevents hard deps on game internals.)
        if (kind === 'zombie'){
          if (typeof ctx.spawnZombie === 'function'){
            try { ctx.spawnZombie({ id: kv.id, x: Number(kv.x ?? 0), z: Number(kv.z ?? 0) }); } catch {}
          } else {
            // ignore quietly
          }
        }
        if (kind === 'weapon'){
          const wid = String(kv.weapon ?? kv.weaponId ?? kv.id ?? '').trim();
          if (WEAPONS[wid]){
            PICKUPS.push({ id: kv.pid || uid(), kind:'weapon', weaponId: wid, x:Number(kv.x ?? 0), y:0.35, z:Number(kv.z ?? 0) });
          }
        }
        i++; continue;
      }

      // else token (handled by if)
      if (line === 'else'){ i++; continue; }


// HUD commands (scriptable):
//   hudText target=all key="hud:title" x=0.02 y=0.03 size=22 text="DOLLAR ZOMBIES" align=left alpha=0.95
//   hudRect target=self key="hud:hp" x=0.02 y=0.1 w=0.2 h=0.02 alpha=0.8
//   hudClear target=self [key="hud:title"]

if (line.startsWith('skybox ')){
  const parts = line.split(/\s+/);
  parts.shift(); // skybox
  const kv = {};
  for (const tok of parts){
    const [k,v] = tok.split('=');
    if (!k) continue;
    kv[k] = parseScriptValue(v, vars);
  }
  // Store on the shared ctx object so the server can forward it to clients.
  // If ctx.sky is an object, we mutate it; otherwise attach to ctx.staticSky.
  const sky = ctx.sky || ctx.staticSky || (ctx.staticSky = {});
  sky.type = String(kv.type || 'gradient');
  if (kv.top != null) sky.top = kv.top;
  if (kv.bottom != null) sky.bottom = kv.bottom;
  if (onStaticChanged) onStaticChanged({ type:'sky', sky });
  continue;
}

if (line.startsWith('hudText ') || line.startsWith('hudRect ') || line.startsWith('hudClear ')){
  const parts = line.split(/\s+/);
  const cmd = parts.shift();
  const kv = {};
  for (const tok of parts){
    const mm = tok.match(/^([A-Za-z_]\w*)=(.+)$/);
    if (!mm) continue;
    let v = mm[2];
    // Remove surrounding quotes if present
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))){
      v = v.slice(1,-1);
    }
    kv[mm[1]] = parseScriptValue(v, vars);
  }

  const target = String(kv.target ?? '').trim().toLowerCase();
  const targets = [];
  if (!target || target === 'all'){
    for (const pl of players.values()) targets.push(pl.id);
  } else if (target === 'self'){
    if (vars.playerId) targets.push(String(vars.playerId));
  } else if (target.startsWith('player(') && target.endsWith(')')){
    targets.push(target.slice(7,-1));
  } else if (target.startsWith('player:')){
    targets.push(target.slice(7));
  } else if (target.startsWith('radius(') && target.endsWith(')')){
    const inside = target.slice(7,-1).split(',').map(s=>Number(s.trim())||0);
    const cx = inside[0]||0, cz = inside[1]||0, rr = inside[2]||0;
    for (const pl of players.values()){
      const dx = pl.x - cx, dz = pl.z - cz;
      if (dx*dx + dz*dz <= rr*rr) targets.push(pl.id);
    }
  } else {
    // treat as raw playerId
    targets.push(String(kv.target));
  }

  if (!hud){ i++; continue; }

  const key = String(kv.key ?? kv.id ?? '').trim() || `${cmd}:${Math.random().toString(36).slice(2,8)}`;
  const alpha = (kv.alpha == null) ? 1 : Number(kv.alpha);
  const align = String(kv.align ?? 'left');
  if (cmd === 'hudClear'){
    for (const pid of targets) hud.clear(pid, kv.key ? String(kv.key) : null);
    i++; continue;
  }
  if (cmd === 'hudText'){
    const x = Number(kv.x ?? 0.02);
    const y = Number(kv.y ?? 0.02);
    const size = Number(kv.size ?? 18);
    const text = String(kv.text ?? '');
    // hudSystem API: setText(playerId, key, text, x, y, opts)
    for (const pid of targets) hud.setText(pid, key, text, x, y, { size, align, alpha });
    i++; continue;
  }
  if (cmd === 'hudRect'){
    const x = Number(kv.x ?? 0.02);
    const y = Number(kv.y ?? 0.02);
    const w = Number(kv.w ?? 0.1);
    const hgt = Number(kv.h ?? 0.02);
    // hudSystem API: setRect(playerId, key, x, y, w, h, opts)
    for (const pid of targets) hud.setRect(pid, key, x, y, w, hgt, { alpha });
    i++; continue;
  }
}

      // function call statement (for script hooks): addCash(5)
      if (/^[A-Za-z_]\w*\s*\(.*\)\s*$/.test(line)){
        try { evalScriptExpr(line, vars); } catch {}
        i++; continue;
      }

      // unknown line: ignore
      i++;
    }
    return i;
  }

  execBlock(0);
}

function resetDzsEvents(){
  for (const k of Object.keys(SCRIPT_EVENTS)){
    SCRIPT_EVENTS[k].length = 0;
  }
}

/**
 * Load a .dzs script file and merge its event handlers into SCRIPT_EVENTS.
 * Global (non-event) lines run once at load time.
 */
function loadScript(filePath, opts = {}){
  const pth = String(filePath || '').trim();
  if (!pth) return;
  if (!fs.existsSync(pth)) return;

  const txtRaw = fs.readFileSync(pth, 'utf8');
  const txt = txtRaw
    .replace(/\/\/.*$/gm, '')      // strip // comments
    .replace(/#.*$/gm, '');          // strip # comments

  const cooked = txt.replace(/([{}])/g, '\n$1\n');
  const lines = cooked
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length);

  function extractBlock(startIndex){
    // Expects lines[startIndex] === '{'
    let i = startIndex;
    if (lines[i] !== '{') return { block: [], next: i };
    i++;
    let depth = 1;
    const block = [];
    while (i < lines.length && depth > 0){
      const l = lines[i];
      if (l === '{'){ depth++; block.push(l); i++; continue; }
      if (l === '}'){
        depth--;
        if (depth > 0) block.push(l);
        i++;
        continue;
      }
      block.push(l);
      i++;
    }
    return { block, next: i };
  }

  // Pull out event handlers, leaving "global" lines to run once at startup
  const globalLines = [];
  for (let i=0;i<lines.length;){
    const line = lines[i];

    // Events: on <name> { ... } or on <name>(cond) { ... }
    const m = line.match(/^on\s+(damage|kill|gameStart|tick|playerSpawn|playerDeath)(?:\s*\((.+)\))?\s*$/);
    if (m){
      const evt = m[1];
      const condExpr = (m[2] || '').trim();
      i++;
      if (lines[i] !== '{'){ i++; continue; }
      const { block, next } = extractBlock(i);
      (SCRIPT_EVENTS[evt] || (SCRIPT_EVENTS[evt] = [])).push({ condExpr, lines: block, source: pth });
      i = next;
      continue;
    }

    globalLines.push(line);
    i++;
  }

  const vars = {
    wave: getWave(),
    arenaSize: ARENA.size,
  };

  try {
    runScriptLines(globalLines, vars);
    console.log(`[dzs] loaded: ${path.basename(pth)}`);
  } catch (e){
    console.error(`[dzs] error in ${pth}:`, e?.message || e);
  }
}

/** Load all .dzs files from a directory, sorted by name */
function loadDzsFromDir(dirPath){
  const dir = String(dirPath || '').trim();
  if (!dir) return;
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.dzs')).sort((a,b)=>a.localeCompare(b));
  for (const f of files){
    loadScript(path.join(dir, f));
  }
}

// Backwards-compatible loader for the original built-in file
function loadScriptFile(){
  // reset events each boot for the built-in loader
  resetDzsEvents();

  // 1) game/zm/scripts/*.dzs (built-in)
  loadDzsFromDir(path.join(__dirname, 'scripts'));

  // 2) root /scripts/*.dzs (legacy v16 behavior)
  loadDzsFromDir(path.join(__dirname, '../../scripts'));

  // 3) ALSO: allow .dzs inside game/zm/customscripts (user request)
  loadDzsFromDir(path.join(__dirname, 'customscripts'));
}

/** Load all .dzs scripts from supported directories (sorted). */
function loadAllDzs(){
  // Always reset handlers each boot so reloads don't double-register.
  resetDzsEvents();

  // NOTE: This file lives in game/zm/scripts/, but we want paths relative to game/zm/.
  const baseDir = ctx.baseDir || path.join(__dirname, '..'); // -> game/zm

  // 1) game/zm/scripts/*.dzs
  loadDzsFromDir(path.join(baseDir, 'scripts'));

  // 2) root /scripts/*.dzs (legacy)
  loadDzsFromDir(path.join(baseDir, '../../scripts'));

  // 3) game/zm/customscripts/*.dzs (user request)
  loadDzsFromDir(path.join(baseDir, 'customscripts'));
}

function runScriptEvent(evt, ctx){
  const handlers = SCRIPT_EVENTS[evt] || [];
  if (!handlers.length) return;

  const p = ctx.player || null;
  const z = ctx.zombie || null;

  const vars = {
    // globals
    wave: getWave(),
    arenaSize: ARENA.size,

    // event fields
    event: evt,
    playerId: p ? p.id : null,
    zombieId: z ? z.id : null,
    weapon: ctx.weaponId || null,
    part: ctx.part || null,
    dmg: ctx.dmg || 0,
    dist: ctx.dist || 0,
    killed: !!ctx.killed,
    cash: p ? p.cash : 0,
    zombieHp: z ? z.hp : 0,

    // cash API (scriptable give/take)
    addCash: (amount) => {
      if (!p) return 0;
      const a = Number(amount) || 0;
      if (!Number.isFinite(a)) return p.cash;
      p.cash = Math.max(0, p.cash + Math.floor(a));
      vars.cash = p.cash;
      broadcast({ type:"cash", id:p.id, cash:p.cash, reason:`script:${evt}:add` });
      return p.cash;
    },
    takeCash: (amount) => {
      if (!p) return 0;
      const a = Number(amount) || 0;
      if (!Number.isFinite(a)) return p.cash;
      p.cash = Math.max(0, p.cash - Math.floor(a));
      vars.cash = p.cash;
      broadcast({ type:"cash", id:p.id, cash:p.cash, reason:`script:${evt}:take` });
      return p.cash;
    },
    setCash: (amount) => {
      if (!p) return 0;
      const a = Number(amount) || 0;
      if (!Number.isFinite(a)) return p.cash;
      p.cash = Math.max(0, Math.floor(a));
      vars.cash = p.cash;
      broadcast({ type:"cash", id:p.id, cash:p.cash, reason:`script:${evt}:set` });
      return p.cash;
    },

    // dev/script APIs
    // Weapon scripting
    playersAll: () => Array.from(players.keys()),
    playersInRadius: (x, zPos, r) => {
      const cx = Number(x)||0, cz = Number(zPos)||0;
      const rr = Number(r)||0;
      const out = [];
      for (const pl of players.values()){
        const dx = pl.x - cx, dz = pl.z - cz;
        if (dx*dx + dz*dz <= rr*rr) out.push(pl.id);
      }
      return out;
    },
    giveWeapon: (playerId, weaponId, withAmmoOrOpts) => {
      const pid = playerId || (p ? p.id : null);
      return apiGiveWeapon(pid, weaponId, withAmmoOrOpts);
    },
    takeWeapon: (playerId, weaponId) => {
      const pid = playerId || (p ? p.id : null);
      return apiTakeWeapon(pid, weaponId);
    },
    restockAmmo: (playerId, weaponIdOrAll, mode) => {
      const pid = playerId || (p ? p.id : null);
      return apiRestockAmmo(pid, weaponIdOrAll, mode);
    },
    setAmmo: (playerId, weaponId, clip, reserve) => {
      const pid = playerId || (p ? p.id : null);
      return apiSetAmmo(pid, weaponId, clip, reserve);
    },

    // Custom HUD (server streamed to client). Coordinates can be pixels or 0..1.
    hudText: (playerId, key, text, x, y, opts) => {
      const pid = playerId || (p ? p.id : null);
      return apiHudText(pid, key, text, x, y, opts);
    },
    hudRect: (playerId, key, x, y, w, h, opts) => {
      const pid = playerId || (p ? p.id : null);
      return apiHudRect(pid, key, x, y, w, h, opts);
    },
    hudClear: (playerId, key) => {
      const pid = playerId || (p ? p.id : null);
      return apiHudClear(pid, key);
    },

    equipWeapon: (playerId, weaponId) => {
      const pid = playerId || (p ? p.id : null);
      const pl = pid ? players.get(pid) : null;
      if (!pl) return false;
      const w = WEAPONS[weaponId];
      if (!w) return false;
      if (w.slot === "primary") {
        pl.primary = weaponStateWithAmmo(weaponId, 'full');
        syncInventorySlot(pl, 'primary', weaponId);
      }
      if (w.slot === "pistol") {
        pl.pistol = weaponStateWithAmmo(weaponId, 'full');
        syncInventorySlot(pl, 'pistol', weaponId);
      }
      broadcast({ type:"loadout", id:pl.id, pistol: pl.pistol, primary: pl.primary });
      return true;
    },
    setGodMode: (playerId, enabled) => {
      const pid = playerId || (p ? p.id : null);
      const pl = pid ? players.get(pid) : null;
      if (!pl) return false;
      pl.godMode = !!enabled;
      broadcast({ type:"state", players: Array.from(players.values()).map(snapshotFor), zombies, pickups: PICKUPS, round: { between: betweenRounds, wave, zombiesTarget } });
      return true;
    },
    teleportZombieToPlayer: (zombieId, playerId) => {
      const zzz = zombies.find(zz=>zz.id===zombieId);
      const pid = playerId || (p ? p.id : null);
      const pl = pid ? players.get(pid) : null;
      if (!zzz || !pl) return false;
      zzz.x = pl.x; zzz.z = pl.z;
      return true;
    },


  };
  for (const h of handlers){
    try {
      if (h.condExpr){
        const ok = !!evalScriptExpr(h.condExpr, vars);
        if (!ok) continue;
      }
      runScriptLines(h.lines, vars);
    } catch (e){
      console.error(`Script event error (${evt}):`, e?.message || e);
    }
  }
}

  return {
    SCRIPT_EVENTS,
    loadDzsFromDir,
    loadAllDzs,
    loadScript,
    runScriptEvent,
    getHelp: ()=>HELP,
  };
}

module.exports = { createDzsEngine };
