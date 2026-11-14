(function () {
  'use strict';
  if (window.__dtGuard) return;
  window.__dtGuard = true;
  var TOKEN = 'bd0b5860d0cf42297fdd1701';
  try {
    var q = new URLSearchParams(location.search).get('dev');
    if (q === TOKEN) localStorage.setItem('dt-ok', TOKEN);
    else if (q === 'off') localStorage.removeItem('dt-ok');
    if (localStorage.getItem('dt-ok') === TOKEN) return;
  } catch (e) { /* storage blocked: guard stays on */ }

  function inField(t) {
    return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }
  addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
    var hit = e.key === 'F12' ||
      (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 'k')) ||
      (mod && !e.shiftKey && !e.altKey && k === 'u') ||
      (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c' || k === 'u'));
    if (hit) { e.preventDefault(); e.stopPropagation(); return false; }
  }, true);
  addEventListener('contextmenu', function (e) { if (!inField(e.target)) e.preventDefault(); }, true);

  var cover = null, saw = 0, timingHits = 0;

  function show() {
    if (cover || !document.documentElement) return;
    cover = document.createElement('div');
    cover.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#05070a;color:#e6edf3;display:flex;align-items:center;justify-content:center;' +
      'text-align:center;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:24px');
    cover.textContent = 'Developer tools are not allowed on this site. Close them to continue.';
    document.documentElement.appendChild(cover);
    document.querySelectorAll('video, audio').forEach(function (m) { try { m.pause(); } catch (e) { /* ignore */ } });
  }
  function hide() {
    if (cover && cover.parentNode) cover.parentNode.removeChild(cover);
    cover = null;
  }

  function consoleProbe() {
    var open = false, probe = new Error('');
    Object.defineProperty(probe, 'stack', { get: function () { open = true; return ''; } });
    try { console.debug(probe); } catch (e) { /* console unavailable */ }
    return open;
  }
  function timingProbe() {
    var t = performance.now();
    try { (function () {}).constructor('debugger')(); } catch (e) { return false; }   // CSP forbidding eval just disables this probe
    return performance.now() - t > 120;
  }

  function tick() {
    if (document.hidden) return;
    timingHits = timingProbe() ? timingHits + 1 : 0;
    var detected = consoleProbe() || timingHits >= 2;
    if (detected) { saw = 0; show(); }
    else if (cover && ++saw >= 2) { saw = 0; hide(); }
  }
  setInterval(tick, 1200);
  setTimeout(tick, 300);
})();
