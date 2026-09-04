/* Site-wide settings.
   Everything in here has to run on every page, not just the settings page:
   the tab cloak has to be applied before anyone sees the tab, and the proxy
   engine, particle and DM-sound preferences are read by other pages. Controls
   that only exist on the settings page live in js/page-settings.js instead.

   The accent colour is deliberately NOT here — it has to be on <html> before
   the first paint, which means a blocking script in <head> (js/theme.js), and
   this file is loaded at the end of the body. */
document.addEventListener("DOMContentLoaded", function () {

  const CLOAK_OPTIONS = {
    default: { title: "Apps | desync", favicon: "/images/onlylessons.png" },
    quizlet:            { title: "Your Sets | Quizlet",       favicon: "https://quizlet.com/favicon.ico" },
    google:             { title: "Google",                     favicon: "https://www.google.com/favicon.ico" },
    "google-classroom": { title: "Home | Google Classroom",   favicon: "https://ssl.gstatic.com/classroom/favicon.png" },
    "google-docs":      { title: "Google Docs",                favicon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico" },
    "google-drive":     { title: "Google Drive",               favicon: "https://ssl.gstatic.com/docs/documents/images/icons/ic_menu_docs_new_48px.svg" },
    "peardeck":         { title: "Pear Deck",                   favicon: "https://cdn.peardeck.com/favicon.ico" },
    "khan-academy":     { title: "Khan Academy",               favicon: "https://www.khanacademy.org/favicon.ico" },
    wikipedia:          { title: "Wikipedia",                  favicon: "https://en.wikipedia.org/favicon.ico" },
    youtube:            { title: "YouTube",                    favicon: "https://www.youtube.com/favicon.ico" },
    outlook:            { title: "Inbox - Outlook",            favicon: "https://outlook.live.com/favicon.ico" },
    ixl:                { title: "IXL | Math, Language Arts, Science, Social Studies, and Spanish", favicon: "https://www.ixl.com/favicon.ico" },
    classroom:          { title: "Canvas",                     favicon: "https://www.instructure.com/favicon.ico" },
    powerschool:        { title: "PowerSchool",                favicon: "https://www.powerschool.com/favicon.ico" },
  };

  // Auto-apply tab cloak on all pages if user has set one
  (function() {
    const savedCloak = localStorage.getItem("tabCloak");
    if (savedCloak && savedCloak !== "default") applyCloak(savedCloak);
  })();

  // "custom" is not in CLOAK_OPTIONS: its title and favicon are whatever the
  // user typed on the settings page, read from storage at apply time so editing
  // either field takes effect without a reload.
  function cloakFor(key) {
    if (key === "custom") {
      const title = localStorage.getItem("desync_cloak_title");
      const favicon = localStorage.getItem("desync_cloak_favicon");
      // A half-filled custom cloak still applies the half that was filled in.
      return {
        title: title || document.title,
        favicon: favicon || CLOAK_OPTIONS.default.favicon,
      };
    }
    return CLOAK_OPTIONS[key] || CLOAK_OPTIONS["quizlet"];
  }

  function applyCloak(key) {
    const opt = cloakFor(key);
    document.title = opt.title;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = opt.favicon;
  }

  // page-settings.js calls this to re-apply a custom cloak as it is typed.
  window.applyCloak = applyCloak;

  const tabCloakSelect = document.getElementById("tabCloakSelect");
  if (tabCloakSelect) {
    const savedCloak = localStorage.getItem("tabCloak") || "quizlet";
    tabCloakSelect.value = savedCloak;
    applyCloak(savedCloak);

    tabCloakSelect.addEventListener("change", () => {
      const val = tabCloakSelect.value;
      localStorage.setItem("tabCloak", val);
      applyCloak(val);
      showToast("Tab cloak updated!");
      setTimeout(() => window.top.location.reload(), 500);
    });
  }
  // Particles are drawn by the shared component in js/particles.js. This used
  // to hand-drive a particles.js instance in #particles-js, an element that
  // only exists on two pages, so the toggle did nothing on the settings page
  // it lived on.
  function toggleParticles(enabled) {
    if (window.olParticles) window.olParticles.set(enabled);
  }


  // Proxy engine. js/proxy.js reads this same key on the proxy page, so the
  // choice applies to the next site opened there — no picker in the browser bar.
  const proxyBackendSelect = document.getElementById("proxyBackend");
  if (proxyBackendSelect) {
    const PROXY_KEY = "onlylessons_proxy_backend";
    const saved = localStorage.getItem(PROXY_KEY);
    proxyBackendSelect.value = saved === "scramjet" ? "scramjet" : "uv";

    proxyBackendSelect.addEventListener("change", () => {
      const value = proxyBackendSelect.value;
      localStorage.setItem(PROXY_KEY, value);
      showToast(value === "scramjet" ? "Now using Scramjet" : "Now using Ultraviolet");
    });
  }

  const particlesToggle = document.getElementById("particlesToggle");
  if (particlesToggle) {
    const savedParticles = localStorage.getItem("particlesEnabled") !== "false"; // default true
    particlesToggle.checked = savedParticles;
    if (savedParticles) {
      toggleParticles(true);
    }

    particlesToggle.addEventListener("change", () => {
      const enabled = particlesToggle.checked;
      localStorage.setItem("particlesEnabled", enabled);
      toggleParticles(enabled);
      showToast(enabled ? "Particles enabled!" : "Particles disabled!");
    });
  }

  // New-DM sound. Off unless explicitly turned on; the chat page (page-chat.js)
  // reads this same key and only chimes for DMs that arrive live.
  const dmSoundToggle = document.getElementById("dmSoundToggle");
  if (dmSoundToggle) {
    const DM_SOUND_KEY = "onlylessons_dm_sound";
    dmSoundToggle.checked = localStorage.getItem(DM_SOUND_KEY) === "true"; // default off

    dmSoundToggle.addEventListener("change", () => {
      const enabled = dmSoundToggle.checked;
      localStorage.setItem(DM_SOUND_KEY, String(enabled));
      showToast(enabled ? "DM sound on" : "DM sound off");
      // Give an immediate preview when enabling, which also satisfies the
      // browser's "audio needs a user gesture" rule for later plays.
      if (enabled) {
        try { const a = new Audio("/images/MSN.mp3"); a.volume = 0.6; a.play().catch(() => {}); } catch (e) {}
      }
    });
  }





  // Kept because other pages call it. The theme half is gone — js/theme.js
  // applies the accent from <head> on every page — so this now only settles the
  // particle field, which mounts after this file runs.
  window.applySavedTheme = function() {
    setTimeout(() => {
      toggleParticles(localStorage.getItem("particlesEnabled") !== "false");
    }, 100);
  };

  class ABC {
    constructor(config = {}) {
      this.type = config.type || "blank";
      this.url  = config.url  || "about:blank";
    }
    setType(type) { if (!type) return; this.type = type; }
    setUrl(url)   { if (!url)  return; this.url  = url;  }
    // Full document, not a bare <iframe>: the relay lets the sidebar inside the
    // sandboxed frame navigate by posting up here (see js/autoblank.js and the
    // matching handler in js/sidebar.js).
    getCode() {
      const origin = JSON.stringify(window.location.origin);
      return `<!doctype html><meta charset="utf-8"><title>Google</title>
        <link rel="icon" href="https://www.google.com/favicon.ico">
        <style>html,body{margin:0;height:100%;background:#05060a;overflow:hidden}
        iframe{border:0;width:100%;height:100%;display:block}</style>
        <script>addEventListener('message',function(e){var h=e.data&&e.data.__olnav;
        if(typeof h==='string'&&h.indexOf(${origin})===0){var f=document.querySelector('iframe');
        if(f)f.src=h;}});<\/script>
        <iframe src="${this.url}" allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups
                 allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts
                 allow-top-navigation allow-top-navigation-by-user-activation"></iframe>`;
    }
    open() {
      const html = this.getCode();
      if (this.type === "blank") {
        try {
          const p = window.open("about:blank");
          if (p) { p.document.open(); p.document.write(html); p.document.close(); }
        } catch(e) {}
      } else if (this.type === "blob") {
        try {
          const blob = new Blob([html], { type: "text/html" });
          window.open(URL.createObjectURL(blob));
        } catch(e) {}
      }
    }
  }

  const abOpenBtn = document.getElementById("abOpenBtn");
  if (abOpenBtn) {
    abOpenBtn.addEventListener("click", () => {
      const type = document.getElementById("abTypeSelect").value;
      const ab = new ABC({ type, url: window.location.href });
      ab.open();
    });
  }

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  // The top/left navbar toggle is gone: navigation is the fixed sidebar from
  // js/sidebar.js, which has its own collapse control.
  localStorage.removeItem("navbarPosition");

});

// exportData / importData / clearData used to live here as well as in
// js/page-settings.js. Both are classic scripts declaring the same three global
// functions, so whichever loaded last silently replaced the other — and this
// copy's importData() took no arguments, while settings.html calls
// importData(event). They now live only in page-settings.js, next to the
// buttons that call them.
