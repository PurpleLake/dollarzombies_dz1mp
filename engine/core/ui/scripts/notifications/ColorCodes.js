const CODE_TO_CLASS = Object.freeze({
  "0": "cc0",
  "1": "cc1",
  "2": "cc2",
  "3": "cc3",
  "4": "cc4",
  "5": "cc5",
  "6": "cc6",
  "7": "cc7",
  "8": "cc8",
  "9": "cc9",
});

/**
 * Parses Call of Duty style color codes: ^0-^9
 * Returns a DocumentFragment with <span class="..."> segments.
 * Rules:
 * - ^<digit> changes current color class for subsequent text.
 * - ^^ renders a literal '^' (escape).
 */
export function renderCodColorCodes(text){
  const frag = document.createDocumentFragment();
  const s = String(text ?? "");
  let curClass = CODE_TO_CLASS["7"]; // default white-ish
  let buf = "";

  const flush = ()=>{
    if(!buf) return;
    const span = document.createElement("span");
    span.className = "dz-cc " + curClass;
    span.textContent = buf;
    frag.appendChild(span);
    buf = "";
  };

  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(ch === "^"){
      const nxt = s[i+1];
      if(nxt === "^"){
        buf += "^";
        i++;
        continue;
      }
      if(nxt && CODE_TO_CLASS[nxt]){
        flush();
        curClass = CODE_TO_CLASS[nxt];
        i++;
        continue;
      }
      // Unknown code, keep caret
      buf += "^";
      continue;
    }
    buf += ch;
  }
  flush();
  return frag;
}
