export function createConsole(el){
  function log(type, msg){
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = `[${type}] ${msg}`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }
  return { log };
}
