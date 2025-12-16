export class Loop {
  constructor({ tickHz=60, onTick }){
    this.tickHz=tickHz;
    this.onTick=onTick;
    this._acc=0; this._last=0; this._raf=0;
    this.running=false;
  }
  start(){
    if(this.running) return;
    this.running=true;
    this._last=performance.now();
    const fixed=1/this.tickHz;
    const step=(now)=>{
      if(!this.running) return;
      const dt=Math.min(0.1,(now-this._last)/1000);
      this._last=now;
      this._acc+=dt;
      while(this._acc>=fixed){
        this.onTick(fixed);
        this._acc-=fixed;
      }
      this._raf=requestAnimationFrame(step);
    };
    this._raf=requestAnimationFrame(step);
  }
  stop(){
    this.running=false;
    if(this._raf) cancelAnimationFrame(this._raf);
    this._raf=0;
  }
}
