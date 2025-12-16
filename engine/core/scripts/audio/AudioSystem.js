export class AudioSystem {
  constructor(){
    this.enabled = true;
    this.volume = 0.7;
    this._ctx = null;
    this._buffers = new Map(); // id -> AudioBuffer
    this._urls = new Map(); // id -> url
  }

  register(id, url){
    this._urls.set(String(id), String(url));
  }

  _ac(){
    if(this._ctx) return this._ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    this._ctx = new Ctx();
    return this._ctx;
  }

  async _load(id){
    const key = String(id);
    if(this._buffers.has(key)) return this._buffers.get(key);
    const url = this._urls.get(key);
    if(!url) return null;
    const ac = this._ac();
    if(!ac) return null;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await ac.decodeAudioData(arr);
    this._buffers.set(key, buf);
    return buf;
  }

  async play(id, opts={}){
    if(!this.enabled) return false;
    const key = String(id);
    const ac = this._ac();
    if(!ac) return false;

    // user gesture gate: resume if suspended
    try{ if(ac.state === "suspended") await ac.resume(); } catch {}

    const buf = await this._load(key);
    if(buf){
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      gain.gain.value = Math.max(0, Math.min(2, (opts.volume ?? this.volume)));
      src.connect(gain);
      gain.connect(ac.destination);
      src.start(0);
      return true;
    }

    // fallback beep
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.value = Number(opts.freq || 440);
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume*0.18), ac.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.2);
    return true;
  }
}
