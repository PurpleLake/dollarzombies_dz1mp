// Very small DZS: supports:
// on eventName { call fn arg1 arg2 ... }
// comments: // or #
export function parseDzs(text){
  const lines = text.split(/\r?\n/);
  const ast = [];
  let i = 0;

  function err(msg){ throw new Error(`DZS parse error @line ${i+1}: ${msg}`); }

  while(i < lines.length){
    let line = lines[i].trim();
    i++;
    if(!line || line.startsWith("//") || line.startsWith("#")) continue;

    const m = line.match(/^on\s+([a-zA-Z0-9:_-]+)\s*\{\s*$/);
    if(m){
      const eventName = m[1];
      const body = [];
      while(i < lines.length){
        const raw = lines[i];
        const l = raw.trim();
        i++;
        if(!l || l.startsWith("//") || l.startsWith("#")) continue;
        if(l === "}") break;

        const cm = l.match(/^call\s+([a-zA-Z0-9:_-]+)(.*)$/);
        if(!cm) err(`Expected 'call ...' inside block, got: ${l}`);
        const fn = cm[1];
        const args = cm[2].trim()
          ? cm[2].trim().split(/\s+/).map(dequote)
          : [];
        body.push({ type:"call", fn, args });
      }
      ast.push({ type:"on", event:eventName, body });
      continue;
    }

    err(`Unknown statement: ${line}`);
  }

  return ast;
}

function dequote(s){
  if((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1,-1);
  return s;
}
