export function createAssetsPanel(el, prefabs, { onAdd }){
  function render(){
    el.innerHTML = "";
    prefabs.forEach(p=>{
      const div = document.createElement("div");
      div.className = "asset";
      div.textContent = p.name;
      div.draggable = true;
      div.addEventListener("dragstart", (ev)=>{
        ev.dataTransfer?.setData("text/plain", JSON.stringify(p));
      });
      div.addEventListener("click", ()=> onAdd?.(p));
      el.appendChild(div);
    });
  }
  render();
  return { render };
}
