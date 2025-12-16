import { clamp } from "../utilities/Math.js";

export class Input {
  constructor({ canvas, events }){
    this.canvas=canvas;
    this.events=events;
    this.keys=new Set();
    this.mouse={ dx:0, dy:0, locked:false, sensitivity:0.0022 };
    this._onKeyDown = (e)=>{ this.keys.add(e.code); };
    this._onKeyUp = (e)=>{ this.keys.delete(e.code); };
    this._onMouseMove = (e)=>{
      if(!this.mouse.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    };
    this._onPointerLockChange = ()=>{
      this.mouse.locked = (document.pointerLockElement === this.canvas);
      this.events.emit("input:lock", { locked: this.mouse.locked });
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
  }

  consumeMouseDelta(){
    const d={ dx:this.mouse.dx, dy:this.mouse.dy };
    this.mouse.dx=0; this.mouse.dy=0;
    return d;
  }

  isDown(code){ return this.keys.has(code); }

  dispose(){
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
  }
}
