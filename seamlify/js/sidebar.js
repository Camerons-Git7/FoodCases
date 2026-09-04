/* Shared sidebar. Every page gets the same nav from one place instead of a
   hand-copied <nav> block that drifts. Include css/ui.css, then this script,
   and put page content inside <main class="ol-stage">. */
(function () {
  var ICONS = {
    home: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>',
    chat: '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>',
    games: '<path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2z"/>',
    cloud: '<path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>',
    movies: '<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>',
    apps: '<path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>',
    ai: '<path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>',
    music: '<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>',
    account: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    settings: '<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>',
    panic: '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>',
    collapse: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  // The rail is built from groups, each rendered as its own floating pill.
  // Home leads the main nav in one pill (rather than sitting alone) so the rail
  // reads as a single block instead of a stray button plus a group.
  var TOP = [
    [
      { href: "/main.html", icon: "home", label: "Home", match: ["/", "/main.html"] },
      { href: "/chat.html", icon: "chat", label: "Chat", match: ["/c", "/chat", "/chat.html"] },
      { href: "/g", icon: "games", label: "Games", match: ["/g", "/games", "/science.html", "/history.html"] },
      { href: "/cloud", icon: "cloud", label: "Cloud", match: ["/cloud", "/cloud.html"] },
      { href: "/movies", icon: "movies", label: "Movies", match: ["/movies", "/movies.html"] },
      { href: "/music.html", icon: "music", label: "Music", match: ["/music", "/music.html"] },
      { href: "/spanish.html", icon: "apps", label: "Apps", match: ["/apps", "/spanish.html"] },
      { href: "/studying.html", icon: "ai", label: "AI", match: ["/ai", "/studying", "/studying.html"] }
    ]
  ];

  var BOTTOM = [
    [
      { href: "/account.html", icon: "account", label: "Account", match: ["/account", "/account.html"] },
      { href: "/settings.html", icon: "settings", label: "Settings", match: ["/settings", "/settings.html"] }
    ]
  ];

  var KEY = "onlylessons_rail_open";

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  // The whole site runs inside index.html's cloak iframe, so navigation must
  // replace the page *inside* that iframe. Escaping to the top document would
  // throw away the cloak (its IXL title, favicon, and the "/" URL).
  //
  // It can't just navigate this window either: /g loads science.html, which
  // frames history.html, so a sidebar click from there would land the next
  // page inside science's frame. The right target is whichever frame sits
  // directly inside the top document — that's the cloak iframe.
  function navWindow() {
    try {
      if (window === window.top) return window; // opened directly, no cloak
      var w = window;
      for (var i = 0; i < 10 && w.parent !== window.top; i++) w = w.parent;
      return w;
    } catch (e) {
      return window; // cross-origin ancestor; same-origin here, so unexpected
    }
  }

  // The Settings "Open in about:blank" feature wraps the whole site in a
  // sandboxed iframe inside an about:blank / blob: window. A sandboxed page may
  // navigate itself, its descendants and the top — but NOT a frame in between,
  // which is what navWindow() hands back there, so those clicks silently do
  // nothing. In that case post the destination to the wrapper's relay (see
  // js/autoblank.js) and let it move the iframe.
  function cloakRelayTop() {
    try {
      var t = window.top.location.href;
      if (t === "about:blank" || t.indexOf("blob:") === 0) return window.top;
    } catch (e) {}
    return null;
  }

  function label(text) {
    return '<span class="ol-label">' + text + "</span>";
  }

  // Render a set of nav items as bare links (no group wrapper). The whole rail
  // is one pill now, so links from every section live inside a single group.
  function links(items, path) {
    var html = "";
    items.forEach(function (item) {
      var active = item.match.indexOf(path) !== -1;
      html +=
        '<a class="ol-link' + (active ? " active" : "") + '" href="' + item.href + '"' +
        (active ? ' aria-current="page"' : "") +
        ' title="' + item.label + '">' +
        svg(item.icon) +
        label(item.label) +
        "</a>";
    });
    return html;
  }

  function build() {
    if (document.querySelector(".ol-sidebar")) return;

    var path = window.location.pathname;
    var aside = document.createElement("aside");
    aside.className = "ol-sidebar";

    // One pill holding everything: brand header, the nav, then account/settings
    // and panic/collapse pushed to the bottom by the spacer.
    var html = '<div class="ol-group ol-rail">';

    html +=
      '<a class="ol-brand" href="/main.html" title="desync">' +
      '<img class="ol-brand-logo" src="/images/desynclogo.png" alt="desync">' +
      '<span class="ol-brand-name ol-label">desync</span>' +
      "</a>";

    TOP.forEach(function (items) { html += links(items, path); });

    html += '<div class="ol-spacer"></div>';
    BOTTOM.forEach(function (items) { html += links(items, path); });

    // Panic already worked on the ` key, but nothing on screen said so.
    html +=
      '<button class="ol-link ol-panic" id="olPanic" type="button" title="Panic (`)">' +
      svg("panic") +
      label("Panic") +
      "</button>" +
      '<button class="ol-link ol-toggle" id="olRailToggle" type="button" aria-label="Toggle sidebar">' +
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' + ICONS.collapse + "</svg>" +
      label("Collapse") +
      "</button>";

    html += "</div>";

    aside.innerHTML = html;
    document.body.insertBefore(aside, document.body.firstChild);

    aside.addEventListener("click", function (event) {
      var link = event.target.closest("a[href]");
      if (!link) return;
      // Let modified clicks (new tab, etc.) behave normally.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      var href = link.getAttribute("href");

      var relay = cloakRelayTop();
      if (relay) {
        event.preventDefault();
        relay.postMessage({ __olnav: new URL(href, window.location.origin).href }, "*");
        return;
      }

      var target = navWindow();
      if (target === window) return; // plain navigation is already correct
      event.preventDefault();
      target.location.href = href;
    });

    // Panic has to take the whole tab, not just the frame this rail lives in.
    // js/panic.js owns the destination (it is user-configurable now), so the
    // button and the key press cannot disagree about where "panic" goes.
    document.getElementById("olPanic").addEventListener("click", function () {
      if (window.desyncPanic) { window.desyncPanic(); return; }
      try { window.top.location.href = "about:blank"; }
      catch (e) { window.location.href = "about:blank"; }
    });

    document.getElementById("olRailToggle").addEventListener("click", function () {
      var open = document.body.classList.toggle("rail-open");
      try { localStorage.setItem(KEY, String(open)); } catch (e) {}
    });
  }

  // Apply the saved width before paint so the rail does not visibly jump.
  try {
    if (localStorage.getItem(KEY) === "true") {
      document.documentElement.classList.add("rail-open-init");
    }
  } catch (e) {}

  function init() {
    if (document.documentElement.classList.contains("rail-open-init")) {
      document.body.classList.add("rail-open");
    }
    build();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
