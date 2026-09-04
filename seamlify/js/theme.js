/* Site theme: one accent colour, applied before first paint.
 *
 * css/ui.css builds every tinted thing — gradients, the wordmark, active nav,
 * buttons, focus rings, the background mesh — out of four custom properties.
 * This file's whole job is to put them on <html> from the user's saved colour,
 * and to do it synchronously so nothing flashes the default blue on the way in.
 *
 * That is why this script belongs in <head>, above the stylesheet links, and
 * why it is not deferred: a deferred copy would run after the first paint and
 * every page would visibly change colour on load.
 *
 * Exposes window.desyncTheme for the settings page:
 *   .get()            -> current hex
 *   .set(hex)         -> save + apply live, no reload
 *   .gradient(bool)   -> save + apply the background mesh toggle
 *   .gradientOn()     -> is the mesh on
 *   .PRESETS          -> the swatch list
 */
(function () {
  "use strict";

  var COLOR_KEY = "desync_accent";
  var GRAD_KEY = "desync_bg_gradient";
  // White is the default: the site reads as monochrome out of the box, and the
  // themes are what introduce colour.
  var DEFAULT = "#ffffff";

  var PRESETS = [
    { name: "White", hex: "#ffffff" },
    { name: "Blue", hex: "#4d7cff" },
    { name: "Red", hex: "#ff4d4d" },
    { name: "Violet", hex: "#a855f7" },
    { name: "Green", hex: "#22c55e" },
    { name: "Amber", hex: "#f59e0b" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Cyan", hex: "#06b6d4" },
  ];

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // Accepts #rgb and #rrggbb, with or without the hash. Returns null on junk so
  // a corrupted saved value falls back to the default rather than painting NaN.
  function parseHex(input) {
    var hex = String(input || "").trim().replace(/^#/, "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      hex: "#" + hex.toLowerCase(),
    };
  }

  function toHsl(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2;
    var h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // Which of black/white stays readable on top of this colour. Uses perceived
  // luminance, not lightness: a saturated yellow at L=50% is far brighter to
  // the eye than a blue at the same L, and needs dark text where the blue does
  // not.
  function inkFor(rgb) {
    var lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return lum > 0.55 ? "#05070d" : "#ffffff";
  }

  function apply(hex) {
    var rgb = parseHex(hex) || parseHex(DEFAULT);
    var hsl = toHsl(rgb);
    var root = document.documentElement;
    root.style.setProperty("--acc-h", String(hsl.h));
    root.style.setProperty("--acc-s", hsl.s + "%");
    // Clamped so the derived --accent-hi / --accent-lo can't collapse onto the
    // base colour. Achromatic accents get their own, much higher range: white
    // is the default and has to be allowed to actually be white, where a
    // saturated colour that bright would blow out every accent surface.
    var light = hsl.s < 12
      ? Math.min(100, Math.max(70, hsl.l))
      : Math.min(78, Math.max(38, hsl.l));
    root.style.setProperty("--acc-l", light + "%");
    root.style.setProperty("--acc-ink", inkFor(rgb));

    // The backdrop keeps its own hue. Tied directly to the accent, a white or
    // near-grey theme would drain the aurora to greyscale — and the background
    // is the one place that should stay colourful whatever the accent is. So an
    // achromatic accent falls back to the house blue.
    var achromatic = hsl.s < 12;
    root.style.setProperty("--bg-h", achromatic ? "222" : String(hsl.h));
    root.style.setProperty("--bg-s", achromatic ? "85%" : hsl.s + "%");
    return rgb.hex;
  }

  function applyGradient(on) {
    document.documentElement.classList.toggle("no-bg-grad", !on);
  }

  var current = apply(read(COLOR_KEY) || DEFAULT);
  var gradientOn = read(GRAD_KEY) !== "false"; // default on
  applyGradient(gradientOn);

  window.desyncTheme = {
    PRESETS: PRESETS,
    DEFAULT: DEFAULT,
    get: function () { return current; },
    set: function (hex) {
      var parsed = parseHex(hex);
      if (!parsed) return false;
      current = apply(parsed.hex);
      write(COLOR_KEY, current);
      return true;
    },
    gradientOn: function () { return gradientOn; },
    gradient: function (on) {
      gradientOn = Boolean(on);
      write(GRAD_KEY, String(gradientOn));
      applyGradient(gradientOn);
    },
  };
})();
