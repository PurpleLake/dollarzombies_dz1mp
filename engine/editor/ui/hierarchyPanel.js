export function createHierarchyPanel(el, { onSelect, onDuplicate, onDelete, onAdd }){
  const list = document.createElement("ul");
  list.className = "hierarchy-list";
  el.appendChild(list);

  const btnRow = document.createElement("div");
  btnRow.style.padding = "6px";
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  const addBtn = document.createElement("button");
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", ()=> onAdd?.());
  btnRow.appendChild(addBtn);
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", ()=> onDelete?.());
  btnRow.appendChild(delBtn);
  el.appendChild(btnRow);

  let items = [];
  function render(objects, selectedIds){
    list.innerHTML = "";
    items = objects.map(obj=>{
      const li = document.createElement("li");
      li.className = "hierarchy-item" + (selectedIds.has(obj.id)?" selected":"");
      const nameInput = document.createElement("input");
      nameInput.value = obj.name || obj.id;
      nameInput.addEventListener("change", ()=>{ obj.name = nameInput.value; });
      nameInput.addEventListener("click", e=> e.stopPropagation());
      li.appendChild(nameInput);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = obj.type || "prop";
      li.appendChild(badge);
      li.addEventListener("click", ()=> onSelect?.(obj));
      list.appendChild(li);
      return { li, obj };
    });
  }
  return { render };
}
