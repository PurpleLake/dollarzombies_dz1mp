import { Button } from "../widgets/Button.js";
import { Checkbox } from "../widgets/Checkbox.js";
import { Slider } from "../widgets/Slider.js";
import { Dropdown } from "../widgets/Dropdown.js";
import { ListBox } from "../widgets/ListBox.js";

export function SettingsScreen({ menu, theme, options, engine, onBack }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";

  const title = document.createElement("h2");
  title.className = "dz-title";
  title.textContent = "Settings";
  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Engine-owned UI: sliders, checkboxes, dropdowns, list boxes, and themes. Changes apply immediately.";

  const divider = document.createElement("div");
  divider.className = "dz-divider";

  // Theme dropdown
  const themes = theme.list().map(t=>({ value: t.key, label: t.name }));
  const themeDrop = Dropdown({
    label: "Color Theme",
    options: themes,
    value: theme.key,
    help: "Changes UI styling (CSS variables).",
    onChange: (k)=> theme.set(k),
  });

  // Mouse sensitivity
  const sens = Slider({
    label: "Mouse Sensitivity",
    min: 0.0008, max: 0.006, step: 0.0001,
    value: options.get("mouseSensitivity"),
    fmt: (v)=>v.toFixed(4),
    help: "Applied to camera look immediately.",
    onChange: (v)=> options.set("mouseSensitivity", v),
  });

  // FOV dropdown
  const fovDrop = Dropdown({
    label: "Field of View",
    value: String(options.get("fov")),
    options: [60,70,75,80,90,100,110].map(v=>({ value:String(v), label:`${v}` })),
    onChange: (v)=> options.set("fov", Number(v)),
    help: "Camera FOV in degrees.",
  });

  // Checkbox
  const fpsCheck = Checkbox({
    label: "Show FPS (debug)",
    value: options.get("showFps"),
    onChange: (v)=> options.set("showFps", !!v),
    help: "Toggles simple FPS counter.",
  });

  // List box example: control scheme presets
  const presets = [
    { value:"classic", label:"Classic FPS", meta:"WASD + Mouse" },
    { value:"lefty", label:"Lefty", meta:"Arrow + Mouse" },
    { value:"esdf", label:"ESDF", meta:"ESDF movement" },
  ];
  let presetValue = "classic";
  const presetList = ListBox({
    label: "Control Preset",
    items: presets,
    value: presetValue,
    onChange: (v)=> { presetValue = v; menu.toast(`Preset: ${v}`); },
    help: "Demo listbox. We’ll wire actual remapping later.",
  });

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.marginTop = "12px";
  row.appendChild(Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() }));
  row.appendChild(document.createElement("div")).className="dz-spacer";
  row.appendChild(Button({
    text:"Developer Menu",
    onClick: ()=>engine?.events?.emit("dev:toggle", {}),
    help:"Opens the dev overlay (` or ' hotkey)."
  }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(divider);

  const grid = document.createElement("div");
  grid.className = "dz-row";
  grid.style.alignItems="flex-start";
  grid.appendChild(themeDrop);
  grid.appendChild(fovDrop);
  grid.appendChild(sens);

  const col = document.createElement("div");
  col.className="dz-col";
  col.appendChild(fpsCheck);
  col.appendChild(presetList);

  panel.appendChild(grid);
  panel.appendChild(col);
  panel.appendChild(row);

  screen.appendChild(panel);
  return screen;
}
