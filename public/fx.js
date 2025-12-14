// Simple full-screen WebGL shader overlay for a "zombies HUD" feel.
// It draws scanlines, grain, corner glow, and a blood vignette that increases as HP drops.
(() => {
  const canvas = document.getElementById("fx");
  const gl = canvas.getContext("webgl", { premultipliedAlpha:false, alpha:true });
  if (!gl) return;

  const vert = `
    attribute vec2 a;
    varying vec2 v;
    void main(){ v = (a+1.0)*0.5; gl_Position = vec4(a,0.0,1.0); }
  `;
  const frag = `
    precision mediump float;
    varying vec2 v;
    uniform vec2 r;
    uniform float t;
    uniform float hp;
    uniform float between;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0,0.0));
      float c = hash(i + vec2(0.0,1.0));
      float d = hash(i + vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }

    void main(){
      // normalized uv
      vec2 uv = v;
      // grain
      float g = noise(uv*r*0.8 + t*18.0);
      float grain = (g - 0.5) * 0.12;

      // scanlines
      float scan = sin((uv.y * r.y) * 1.6) * 0.03;

      // vignette
      vec2 p = uv*2.0-1.0;
      float vig = smoothstep(1.25, 0.35, dot(p,p));

      // blood/danger vignette based on hp
      float danger = clamp(1.0 - hp/100.0, 0.0, 1.0);
      float edge = smoothstep(0.35, 1.1, length(p));
      float blood = danger * edge;

      // corner energy glow (more when between rounds)
      float corner = pow(max(0.0, 1.0 - length(p)), 2.0) * (0.10 + between*0.08);

      vec3 col = vec3(0.0);
      col += vec3(0.16,0.38,0.52) * (vig*0.18 + corner);
      col += vec3(0.65,0.12,0.10) * (blood*0.55);

      float a = 0.22 * vig + 0.10 * between + 0.22 * blood;
      a += grain + scan;

      gl_FragColor = vec4(col, clamp(a, 0.0, 0.70));
    }
  `;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const locA = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(locA);
  gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0);

  const locR = gl.getUniformLocation(prog, "r");
  const locT = gl.getUniformLocation(prog, "t");
  const locHp = gl.getUniformLocation(prog, "hp");
  const locBetween = gl.getUniformLocation(prog, "between");

  function resize(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  addEventListener("resize", resize);
  resize();

  const start = performance.now();
  function frame(){
    const tt = (performance.now() - start) / 1000;
    const hud = window.__hud || { hp:100, between:1 };
    gl.uniform2f(locR, canvas.width, canvas.height);
    gl.uniform1f(locT, tt);
    gl.uniform1f(locHp, hud.hp ?? 100);
    gl.uniform1f(locBetween, hud.between ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
  frame();
})();
