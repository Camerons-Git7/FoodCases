import{a as e,i as t}from"./BTEiqXG3.js";var n=`attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`,r=`precision mediump float;
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define HP highp
#else
#define HP mediump
#endif
uniform HP vec2 uRes;
uniform HP float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uBase;

HP float hash(HP vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

HP float vnoise(HP vec2 p) {
  HP vec2 i = floor(p);
  HP vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// +-1 level of triangular dither so dark gradients do not band; true black stays black.
vec3 finish(vec3 c) {
  HP float n = hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 31.7) - 1.0;
  float m = max(c.r, max(c.g, c.b));
  return clamp(c + n * (1.0 / 255.0) * smoothstep(0.0, 0.012, m), 0.0, 1.0);
}
`,i={projector:`${r}
void main() {
  HP vec2 coord = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  HP float t = uTime;
  // Narrow portrait screens get a wider, brighter fan, and a beam that still reaches ~60% of the height.
  float narrow = smoothstep(1.0, 0.45, uRes.x / uRes.y);
  float widen = mix(1.0, 2.0, narrow);
  HP vec2 d = vec2((coord.x - 0.5 * uRes.x) * widen, coord.y + 0.2 * uRes.y);
  HP float dist = length(d);
  HP float da = d.y / dist + 0.006 * sin(t * 2.0 + dist * 0.01);
  float maxDist = max(uRes.x * 1.5, uRes.y);
  float spread = pow(max(da, 0.0), 1.1765);
  float lengthF = clamp((maxDist - dist) / maxDist, 0.0, 1.0);
  float fadeF = clamp((uRes.x - dist) / uRes.x, 0.5, 1.0);
  float s1 = clamp(0.75 + 0.15 * sin(da * 36.2214 + t * 1.05) + 0.2 * cos(-da * 21.11349 + t * 1.05), 0.0, 1.0);
  float s2 = clamp(0.75 + 0.15 * sin(da * 22.3991 + t * 0.77) + 0.2 * cos(-da * 18.0234 + t * 0.77), 0.0, 1.0);
  float c = min((s1 * 0.5 + s2 * 0.4) * lengthF * fadeF * spread * mix(1.0, 1.7, narrow), 1.0);
  float grain = 0.94 + 0.06 * hash(gl_FragCoord.xy + fract(t * 7.0) * 61.0);
  float b = 1.0 - coord.y / uRes.y;
  vec3 rgb = mix(uC1, uC2, b) * (0.3 + 0.7 * b) * (c * grain);
  gl_FragColor = vec4(finish(mix(uBase, rgb, c)), 1.0);
}`,silk:`${r}
void main() {
  HP vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  HP float t = uTime * 0.08;
  HP float w = vnoise(p * 1.3 + vec2(t * 0.7, -t * 0.4)) - 0.5;
  HP float u = p.x * 0.82 + p.y * 0.57;
  u += 0.16 * sin(u * 2.3 + p.y * 1.9 + t * 1.2) + 0.3 * w;
  HP float ph = u * 9.0 + t * 2.4;
  HP float ph2 = ph * 2.05 + 1.1 + p.y * 2.0;
  float slope = 0.8 * cos(ph) + 0.28 * cos(ph2);
  vec3 n = normalize(vec3(-slope * 0.9, 0.0, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.0, 0.85));
  float diff = max(dot(n, l), 0.0);
  float spec = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 12.0);
  vec3 col = uBase;
  col += uC2 * diff * diff * 0.4;
  col += uC1 * spec * 0.42;
  col += uC3 * spec * spec * spec * 0.32;
  col *= 1.0 - 0.5 * dot(p, p);
  gl_FragColor = vec4(finish(col), 1.0);
}`,"color-bends":`${r}
void main() {
  HP vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 1.7;
  HP float t = uTime * 0.06;
  HP float w = vnoise(p * 0.6 + vec2(-t * 0.9, t * 0.6)) - 0.5;
  p += vec2(0.75 * sin(p.y * 1.4 + t * 2.0) + 1.1 * w, 0.6 * cos(p.x * 1.2 - t * 1.6) + 0.8 * w);
  HP float v = dot(p, vec2(0.74, 0.67)) * 0.6 + t * 1.2;
  vec3 k = exp(2.2 * cos(6.2832 * (v - vec3(0.0, 0.3333, 0.6667))));
  vec3 col = (uC1 * k.x + uC2 * k.y + uC3 * k.z) / (k.x + k.y + k.z);
  float ribbon = pow(0.5 + 0.5 * cos(6.2832 * v * 3.0 + 1.0), 4.0);
  float lum = 0.2 + 0.1 * sin(6.2832 * v * 1.5 + 2.0) + 0.14 * ribbon;
  col = mix(uBase, col, lum * 1.5) + ribbon * 0.04;
  gl_FragColor = vec4(finish(col), 1.0);
}`,aurora:`${r}
void main() {
  HP vec2 uv = gl_FragCoord.xy / uRes;
  HP float x = uv.x * uRes.x / uRes.y;
  float y = uv.y;
  HP float t = uTime * 0.04;
  vec3 col = uBase + vec3(0.0, 0.012, 0.016) * (1.0 - y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float wob = 0.5 + 0.28 * sin(x * (1.3 + 0.4 * fi) + t * (3.0 + fi) + fi * 2.1)
      + 0.18 * sin(x * (2.9 + 0.7 * fi) - t * 2.0 + fi) + 0.07 * sin(x * (7.0 + fi) + t * 5.0);
    float d = y - (0.36 + 0.09 * fi + (wob - 0.5) * 0.3);
    HP float ray = vnoise(vec2(x * (16.0 + 5.0 * fi) + wob * 4.0 + t * 2.0, fi * 5.3 + y * 0.8 + t));
    float body = smoothstep(0.0, 0.06, d) * exp(-max(d, 0.0) * (3.4 - 0.5 * fi));
    float glow = exp(min(d, 0.0) * 9.0) * 0.1;
    float shimmer = 0.85 + 0.15 * sin(t * 18.0 + x * 7.0 + fi * 2.0);
    vec3 tint = mix(uC1, mix(uC2, uC3, smoothstep(0.35, 0.95, y)), smoothstep(0.0, 0.4, d));
    col += tint * (body * (0.45 + 0.9 * ray) * shimmer + glow) * (0.42 - 0.06 * fi);
  }
  gl_FragColor = vec4(finish(col), 1.0);
}`,"liquid-chrome":`${r}
void main() {
  HP vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.6;
  HP float t = uTime * 0.1;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    p.x += 0.8 / (fi * fi) * cos(fi * 2.5 * p.y + t);
    p.y += 0.8 / (fi * fi) * cos(fi * 1.5 * p.x + t * 1.3);
  }
  HP float ph = (p.x + p.y) * 1.2 + t * 2.0;
  float broad = pow(0.5 + 0.5 * sin(ph), 5.0);
  float thin = pow(0.5 + 0.5 * sin(ph * 2.3 + 1.0 + p.x), 12.0);
  float line = 0.04 / (abs(sin(ph)) + 0.12);
  vec3 col = uBase + uC2 * (0.035 + 0.07 * (0.5 + 0.5 * sin(ph)));
  col += uC1 * (broad * 0.34 + thin * 0.42);
  col += uC3 * min(line, 1.0) * 0.12;
  gl_FragColor = vec4(finish(col), 1.0);
}`,galaxy:`${r}
float starLayer(HP vec2 p, HP float t, float scale, vec2 drift, float seed, float density, float size) {
  HP vec2 g = p * scale + drift * t;
  HP vec2 id = floor(g);
  HP vec2 f = fract(g) - 0.5;
  HP float h = hash(id + seed);
  HP float h2 = hash(id + seed + 3.7);
  HP vec2 off = (vec2(h2, fract(h * 9.7)) - 0.5) * 0.5;
  HP vec2 d = f - off;
  float r2 = dot(d, d);
  float tw = 0.65 + 0.35 * sin(t * (0.8 + 2.0 * h2) + h * 50.0);
  float core = exp(-r2 / (size * size));
  float halo = exp(-r2 / (size * size * 18.0)) * 0.3;
  return step(1.0 - density, h) * (core + halo) * tw * (0.35 + 0.65 * fract(h * 5.3));
}
void main() {
  HP vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  HP float t = uTime;
  vec3 col = uBase;
  HP vec2 c = p - vec2(0.18, 0.04);
  HP float r = length(c);
  HP float ang = atan(c.y, c.x) + r * 2.4 - t * 0.02;
  HP vec2 s = vec2(cos(ang), sin(ang)) * r;
  HP float n1 = vnoise(s * 3.2 + vec2(0.0, t * 0.01));
  HP float n2 = vnoise(s * 7.0 - 3.1 + n1 * 1.5);
  float cloud = smoothstep(0.35, 0.85, n1 * 0.65 + n2 * 0.35);
  float body = exp(-r * 1.8);
  col += uC1 * cloud * body * 0.95 + uC2 * cloud * cloud * body * 0.55 + uC3 * exp(-r * 5.0) * 0.4;
  float st = starLayer(p, t, 6.0, vec2(0.012, 0.004), 0.0, 0.16, 0.05) * 1.0
    + starLayer(p, t, 16.0, vec2(0.02, 0.006), 9.0, 0.22, 0.045)
    + starLayer(p, t, 34.0, vec2(0.03, 0.01), 21.0, 0.2, 0.04) * 0.8;
  col += mix(vec3(1.0), uC3, 0.25) * min(st, 0.9);
  gl_FragColor = vec4(finish(col), 1.0);
}`},a={projector:42.15,silk:12,"color-bends":20,aurora:30,"liquid-chrome":8,galaxy:25},o={high:{scale:.6,fps:30},balanced:{scale:.4,fps:24}},ee=.45,te=.78,s=4,ne=.22,re=9e5,c=40,l=2e4,u=7200;function d(r,d){let f={alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:`low-power`,preserveDrawingBuffer:!1,failIfMajorPerformanceCaveat:!0},p=r.getContext(`webgl2`,f)??r.getContext(`webgl`,f);if(!p)return null;let m=p,h=()=>m.getExtension(`WEBGL_lose_context`)?.loseContext(),g=m.getShaderPrecisionFormat(m.FRAGMENT_SHADER,m.HIGH_FLOAT);if(!g||g.precision===0)return h(),null;let _=d.id,v=d.tier,y={colors:d.colors,base:d.base},b=!1,x=!1,S=0,C=0,w=0,T=a[_],E=null,D=null,O=new Map,k=new Float32Array(12),A=new Float32Array(12);function j(e,t){let n=m.createShader(e);return n?(m.shaderSource(n,t),m.compileShader(n),m.getShaderParameter(n,m.COMPILE_STATUS)?n:(console.warn(`[background] shader failed to compile:`,m.getShaderInfoLog(n)),m.deleteShader(n),null)):null}function ie(e){let t=j(m.VERTEX_SHADER,n),r=j(m.FRAGMENT_SHADER,i[e]),a=m.createProgram();if(!t||!r||!a)return null;if(m.attachShader(a,t),m.attachShader(a,r),m.bindAttribLocation(a,0,`aPos`),m.linkProgram(a),m.deleteShader(t),m.deleteShader(r),!m.getProgramParameter(a,m.LINK_STATUS))return console.warn(`[background] shader failed to link:`,m.getProgramInfoLog(a)),m.deleteProgram(a),null;let o=e=>m.getUniformLocation(a,e);return{program:a,uRes:o(`uRes`),uTime:o(`uTime`),uColor:[o(`uC1`),o(`uC2`),o(`uC3`),o(`uBase`)]}}function M(){let[n,r,i]=y.colors,a=[t(n),t(r),t(i)];_===`projector`&&(a=[...e(y.colors),a[2]]),k.set([...a[0],...a[1],...a[2],...t(y.base)])}function N(){if(E)for(let e=0;e<4;e++)m.uniform3f(E.uColor[e],A[e*3],A[e*3+1],A[e*3+2])}function P(e){let t=O.get(e);if(!t){if(t=ie(e)??void 0,!t)return!1;O.set(e,t)}return _=e,E=t,m.useProgram(t.program),T=a[e],M(),A.set(k),N(),C&&m.uniform2f(t.uRes,C,w),!0}function F(){let e=r.clientWidth,t=r.clientHeight;if(!e||!t)return!1;let n=v===`high`&&Math.min(e,t)<640?ee:o[v].scale,i=Math.min(window.devicePixelRatio||1,1),a=Math.max(ne,n*te**S)*i,s=Math.min(a,Math.sqrt(re/(e*t))),c=Math.max(2,Math.round(e*s)),l=Math.max(2,Math.round(t*s));return c===C&&l===w?!1:(C=r.width=c,w=r.height=l,m.viewport(0,0,c,l),E&&m.uniform2f(E.uRes,c,l),!0)}function I(){E&&!x&&C&&(m.uniform1f(E.uTime,T),m.drawArrays(m.TRIANGLES,0,3))}function L(){return D=m.createBuffer(),m.bindBuffer(m.ARRAY_BUFFER,D),m.bufferData(m.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),m.STATIC_DRAW),m.enableVertexAttribArray(0),m.vertexAttribPointer(0,2,m.FLOAT,!1,0,0),C=w=0,P(_)?(F(),I(),!0):!1}let R=0,z=0,B=0,V=0,H=0,U=0;function W(e){R=requestAnimationFrame(W);let t=z?e-z:0;if(z=e,U>0?U--:t>c&&t<500?++H>=2&&(H=0,S<s&&(S++,U=8,F()&&I())):H=0,e<V-1.5)return;let n=1e3/o[v].fps;V=e-V>n?e+n:V+n;let r=B?Math.min(e-B,100)/1e3:0;B=e,T+=r,T>u&&(T-=u);let i=!1,a=1-Math.exp(-4*r);for(let e=0;e<12;e++){let t=k[e]-A[e];Math.abs(t)>5e-4?(A[e]+=t*a,i=!0):A[e]=k[e]}i&&N(),I()}function ae(){R||b||x||(z=B=V=H=0,U=3,R=requestAnimationFrame(W))}function G(){R&&cancelAnimationFrame(R),R=0}let K=!1,q=!1,J=0;function Y(){!b&&!x&&!document.hidden&&!K&&!q&&!document.fullscreenElement?ae():G()}let X=()=>{window.clearTimeout(J),J=window.setTimeout(()=>{q=!0,Y()},l)},Z=()=>{window.clearTimeout(J),q=!1,Y()},Q=e=>{e.preventDefault(),x=!0,G(),O.clear(),E=null,d.onLost()},$=()=>{if(x=!1,!L()){d.onFail();return}d.onFrame(),Y()},oe=new ResizeObserver(()=>{F()&&I()}),se=new IntersectionObserver(e=>{K=!e[e.length-1].isIntersecting,Y()});return L()?(oe.observe(r),se.observe(r),document.addEventListener(`visibilitychange`,Y),document.addEventListener(`fullscreenchange`,Y),window.addEventListener(`blur`,X),window.addEventListener(`focus`,Z),r.addEventListener(`webglcontextlost`,Q),r.addEventListener(`webglcontextrestored`,$),d.onFrame(),Y(),{setShader(e){if(!(e===_||b||x)){if(!P(e)){d.onFail();return}I()}},setPalette(e,t){b||t===y.base&&e.every((e,t)=>e===y.colors[t])||(y={colors:e,base:t},M(),R||(A.set(k),N(),I()))},setTier(e){e===v||b||(v=e,S=0,F()&&I())},destroy(){b=!0,G(),window.clearTimeout(J),oe.disconnect(),se.disconnect(),document.removeEventListener(`visibilitychange`,Y),document.removeEventListener(`fullscreenchange`,Y),window.removeEventListener(`blur`,X),window.removeEventListener(`focus`,Z),r.removeEventListener(`webglcontextlost`,Q),r.removeEventListener(`webglcontextrestored`,$),x||(O.forEach(e=>m.deleteProgram(e.program)),m.deleteBuffer(D),h()),O.clear()}}):(h(),null)}export{d as createRenderer};