/* Animated aurora backdrop.
 *
 * A port of the React Bits <Aurora /> component to a plain ES module, because
 * this project has no React and no bundler — pages are static HTML loading
 * scripts directly. The shader and the uniform set are unchanged from the
 * original; what is different is the lifecycle: instead of useEffect + a props
 * ref, it mounts itself once, reads its colours from the site theme, and stops
 * when it is not wanted.
 *
 * ogl is served from /ogl/ (see the static mount in src/index.js), which is
 * node_modules/ogl/src — the package is ES module source with relative imports,
 * so the browser resolves it without a build step. Loaded as
 * <script type="module">, so it is deferred by definition and never blocks the
 * first paint.
 *
 * Behaviour that is ours, not the original component's:
 *
 *  - Colours follow the accent. js/theme.js is the source of truth; the three
 *    stops are derived from it so the aurora repaints when the theme changes,
 *    rather than being a fixed palette that would clash with every preset.
 *  - It only covers the top of the page and fades out downward, matching the
 *    CSS backdrop it replaces (css/ui.css, body::before), which stays as the
 *    fallback for anything without WebGL.
 *  - It stops rendering when the tab is hidden or the settings toggle is off.
 *    A requestAnimationFrame loop running a fragment shader on a hidden tab is
 *    pure battery cost.
 */
import { Renderer, Program, Mesh, Color, Triangle } from "/ogl/index.js";

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

// ── Tuning ────────────────────────────────────────────────
// Deliberately restrained: this is a backdrop, not the subject. The opacity in
// particular is what keeps it a "quite faded" wash at the top rather than a
// light show competing with the page.
const AMPLITUDE = 1.0;
const BLEND = 0.62;
const SPEED = 0.32;

const GRAD_KEY = "desync_bg_gradient";

function gradientEnabled() {
  try {
    return localStorage.getItem(GRAD_KEY) !== "false";
  } catch (e) {
    return true;
  }
}

// The three ramp stops, derived from the theme's accent so the aurora is the
// same colour as the rest of the site. The middle stop is pushed round the
// wheel so the ramp has somewhere to travel — three stops of one hue would
// render as a flat wash.
function stopsFromTheme() {
  const root = getComputedStyle(document.documentElement);
  // --bg-*, not --acc-*: the accent can be white (the default), and a white
  // ramp renders the aurora as a grey wash. js/theme.js keeps a separate
  // backdrop hue for exactly this.
  const h = parseFloat(root.getPropertyValue("--bg-h")) || 222;
  const s = parseFloat(root.getPropertyValue("--bg-s")) || 85;
  const l = 62;
  return [
    hslToHex(h - 18, s, Math.min(70, l)),
    hslToHex(h + 165, Math.min(80, s), Math.min(68, l + 2)),
    hslToHex(h + 10, s, Math.max(42, l - 12)),
  ];
}

function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  const seg = Math.floor(hh / 60) % 6;
  const [r, g, b] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function mount() {
  if (document.getElementById("aurora")) return;
  if (!gradientEnabled()) return;

  const host = document.createElement("div");
  host.id = "aurora";
  host.setAttribute("aria-hidden", "true");

  let renderer;
  try {
    renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true });
  } catch (e) {
    // No WebGL2 (old hardware, a locked-down school machine, a blocked
    // context). The CSS backdrop in ui.css is already painted underneath, so
    // bailing here leaves a correct — just static — page.
    console.warn("[aurora] WebGL unavailable, keeping the CSS backdrop:", e.message);
    return;
  }

  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.canvas.style.backgroundColor = "transparent";

  const geometry = new Triangle(gl);
  // The vertex shader takes only `position`; leaving uv bound costs an
  // attribute slot and a warning for nothing.
  if (geometry.attributes.uv) delete geometry.attributes.uv;

  const toVec = (hex) => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
  };

  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: AMPLITUDE },
      uColorStops: { value: stopsFromTheme().map(toVec) },
      uResolution: { value: [1, 1] },
      uBlend: { value: BLEND },
    },
  });

  const mesh = new Mesh(gl, { geometry, program });
  host.appendChild(gl.canvas);
  document.body.appendChild(host);
  // The CSS streak in ui.css is the no-WebGL fallback. Now that the canvas is
  // up it owns the backdrop; leaving both on stacks two gradients and reads
  // muddy.
  document.documentElement.classList.add("has-aurora");

  function resize() {
    const width = host.offsetWidth;
    const height = host.offsetHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    program.uniforms.uResolution.value = [width, height];
  }
  window.addEventListener("resize", resize);
  resize();

  let frame = 0;
  let running = false;

  const draw = (t) => {
    frame = requestAnimationFrame(draw);
    program.uniforms.uTime.value = t * 0.001 * SPEED;
    renderer.render({ scene: mesh });
  };

  function start() {
    if (running) return;
    running = true;
    frame = requestAnimationFrame(draw);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frame);
  }

  // A shader loop on a background tab is wasted battery.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  // Repaint the ramp when the theme changes. The settings page applies colours
  // live, so this keeps the backdrop in step without a reload.
  function refreshColors() {
    program.uniforms.uColorStops.value = stopsFromTheme().map(toVec);
  }

  window.desyncAurora = {
    refresh: refreshColors,
    setEnabled(on) {
      host.style.display = on ? "" : "none";
      document.documentElement.classList.toggle("has-aurora", on);
      if (on) start();
      else stop();
    },
  };

  start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
