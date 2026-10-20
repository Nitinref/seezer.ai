"use client";

import { useEffect, useRef } from "react";

const VERTEX = `attribute vec2 position; void main(){ gl_Position=vec4(position,0.0,1.0); }`;
const FRAGMENT = `precision mediump float;
uniform vec2 resolution; uniform float time;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ float v=0.; float a=.5; for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+8.1;a*=.5;} return v; }
void main(){ vec2 uv=gl_FragCoord.xy/resolution.xy; vec2 p=(gl_FragCoord.xy-.5*resolution.xy)/min(resolution.x,resolution.y); float t=time*.12; float waves=fbm(p*1.35+vec2(t,-t*.4)); waves+=.25*sin(p.x*3.0+p.y*2.0+t); vec3 black=vec3(.002,.008,.018); vec3 sky=vec3(.18,.62,.95); vec3 blue=vec3(.015,.16,.58); vec3 cyan=vec3(.02,.78,1.); vec3 col=mix(black,sky,smoothstep(.05,.72,waves)); col=mix(col,blue,smoothstep(.42,.9,waves+.1*sin(p.x*2.))); col+=cyan*.2*smoothstep(.55,.9,waves)*smoothstep(.0,.8,uv.y); col*=smoothstep(.02,.8,uv.y); float vignette=1.-.35*length(uv-.5); gl_FragColor=vec4(col*vignette,1.); }`;

export function ShaderBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;
    const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program); gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "resolution"); const time = gl.getUniformLocation(program, "time");
    let frame = 0; const start = performance.now();
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); const width = Math.max(1, Math.floor(canvas.clientWidth*dpr)); const height = Math.max(1, Math.floor(canvas.clientHeight*dpr)); if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; gl.viewport(0,0,width,height); } };
    const render = (now: number) => { resize(); gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, (now-start)/1000); gl.drawArrays(gl.TRIANGLES,0,3); frame=requestAnimationFrame(render); };
    frame=requestAnimationFrame(render); window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); gl.deleteBuffer(buffer); gl.deleteProgram(program); };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} aria-hidden="true" />;
}

export default ShaderBackground;
