function numberField(value, onChange){
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.1";
  input.value = value ?? 0;
  input.addEventListener("change", ()=> onChange(Number(input.value)));
  return input;
}

export function createInspector(el, { onChange }){
  const root = document.createElement("div");
  root.className = "inspector";
  el.appendChild(root);

  let current = null;
  function render(obj){
    current = obj;
    root.innerHTML = "";
    if(!obj){
      root.textContent = "Select an object";
      return;
    }
    const title = document.createElement("h3");
    title.textContent = obj.name || obj.id;
    root.appendChild(title);

    const idField = document.createElement("input");
    idField.value = obj.id;
    idField.addEventListener("change", ()=>{ obj.id = idField.value; onChange(obj); });
    root.appendChild(labelWrap("Id", idField));

    const typeSel = document.createElement("select");
    ["static","prop","spawn","trigger","light"].forEach(t=>{
      const opt = document.createElement("option");
      opt.value=t; opt.textContent=t; if(obj.type===t) opt.selected=true; typeSel.appendChild(opt);
    });
    typeSel.addEventListener("change", ()=>{ obj.type = typeSel.value; onChange(obj); });
    root.appendChild(labelWrap("Type", typeSel));

    const prefab = document.createElement("input");
    prefab.value = obj.prefab || "";
    prefab.addEventListener("change", ()=>{ obj.prefab = prefab.value; onChange(obj); });
    root.appendChild(labelWrap("Prefab", prefab));

    root.appendChild(section("Transform"));
    root.appendChild(vectorRow("Position", obj.position, (v)=>{ obj.position = v; onChange(obj); }));
    root.appendChild(vectorRow("Rotation", obj.rotation, (v)=>{ obj.rotation = v; onChange(obj); }));
    root.appendChild(vectorRow("Scale", obj.scale, (v)=>{ obj.scale = v; onChange(obj); }));

    root.appendChild(section("Collider"));
    const colliderEnabled = document.createElement("input");
    colliderEnabled.type = "checkbox";
    colliderEnabled.checked = obj.collider?.enabled ?? true;
    colliderEnabled.addEventListener("change", ()=>{ obj.collider.enabled = colliderEnabled.checked; onChange(obj); });
    root.appendChild(labelWrap("Enabled", colliderEnabled));

    const colliderShape = document.createElement("select");
    ["box","sphere","capsule"].forEach(s=>{
      const opt = document.createElement("option"); opt.value=s; opt.textContent=s; if(obj.collider?.shape===s) opt.selected=true; colliderShape.appendChild(opt);
    });
    colliderShape.addEventListener("change", ()=>{ obj.collider.shape = colliderShape.value; onChange(obj); });
    root.appendChild(labelWrap("Shape", colliderShape));
    root.appendChild(vectorRow("Size", obj.collider.size, (v)=>{ obj.collider.size = v; onChange(obj); }));

    const tags = document.createElement("input");
    tags.value = (obj.tags||[]).join(", ");
    tags.addEventListener("change", ()=>{ obj.tags = tags.value.split(/[,\s]+/).filter(Boolean); onChange(obj); });
    root.appendChild(labelWrap("Tags", tags));

    const custom = document.createElement("textarea");
    custom.rows = 4;
    custom.value = JSON.stringify(obj.custom || {}, null, 2);
    custom.addEventListener("change", ()=>{ try { obj.custom = JSON.parse(custom.value || "{}"); onChange(obj); } catch {} });
    root.appendChild(labelWrap("Custom", custom));
  }

  return { render };
}

function section(title){
  const h = document.createElement("h3");
  h.textContent = title;
  return h;
}

function vectorRow(label, vec={}, onChange){
  const wrap = document.createElement("div");
  const lab = document.createElement("label"); lab.textContent = label; wrap.appendChild(lab);
  const row = document.createElement("div"); row.className = "row";
  const x = numberField(vec.x ?? 0, (v)=> update({ ...vec, x:v }));
  const y = numberField(vec.y ?? 0, (v)=> update({ ...vec, y:v }));
  const z = numberField(vec.z ?? 0, (v)=> update({ ...vec, z:v }));
  row.append(x,y,z);
  wrap.appendChild(row);
  function update(v){ vec.x = v.x; vec.y = v.y; vec.z = v.z; onChange({ ...vec }); }
  return wrap;
}

function labelWrap(text, child){
  const wrap = document.createElement("div");
  const lab = document.createElement("label"); lab.textContent = text; wrap.appendChild(lab);
  wrap.appendChild(child);
  return wrap;
}
