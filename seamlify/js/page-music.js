/* desync — Music page controller.
 *
 * Talks to the music service through the main app's same-origin reverse proxy
 * (src/index.js forwards /api/music/* and /api/sp/* to the desync-music
 * process). Three data paths:
 *   - home sections : GET /api/music/ytm/home   (SSE, {section,tracks} events)
 *   - search        : GET /api/music/ytm/search (SSE, one track per event)
 *   - audio         : GET /api/sp/audio/:id?t=&a=  (ranged audio, seekable)
 *   - lyrics        : GET /api/music/lyrics?track=&artist=&duration=
 */
(function () {
  "use strict";

  // Overlay mode (?overlay=1) — how the in-game music button embeds this page
  // in an iframe; drops the site chrome via a body class, nothing else changes.
  if (new URLSearchParams(location.search).has("overlay")) document.body.classList.add("overlay");

  var $ = function (id) { return document.getElementById(id); };
  var body = $("musicBody");
  var statusEl = $("musicStatus");
  var searchInput = $("musicSearch");

  var audio = $("audio");
  var player = $("player");

  // The flat list of tracks currently on screen — this is the play queue that
  // prev/next walk. Rebuilt whenever the body is re-rendered (home or search).
  var queue = [];
  var current = -1;

  // Favorites (accounts only). favIds is the quick lookup for heart states;
  // favTracks is the ordered list backing the Liked view. Both stay in sync.
  var SESSION_KEY = "onlylessons_session";
  var account = { loggedIn: false, token: null };
  var favIds = new Set();  // track ids, for quick heart-state lookup
  var favTracks = [];      // full track objects, newest first
  var viewingFavs = false;

  // ── helpers ──────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function setStatus(text) {
    if (!text) { statusEl.hidden = true; statusEl.textContent = ""; return; }
    statusEl.hidden = false;
    statusEl.textContent = text;
  }

  var HEART_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  function trackCard(track, index) {
    var art = track.thumb || "";
    return (
      '<button class="track-card" data-index="' + index + '" type="button">' +
        '<span class="track-art">' +
          (art ? '<img loading="lazy" src="' + esc(art) + '" alt="">' : "") +
          '<span class="play-dot"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' +
          // The heart is a span (not a button) because the card itself is a
          // button and nesting buttons is invalid; its click is handled with
          // stopPropagation so favoriting doesn't also start playback.
          '<span class="track-fav' + (favIds.has(track.id) ? " is-fav" : "") + '" data-fav title="Save to favorites">' + HEART_SVG + "</span>" +
        "</span>" +
        '<span class="track-title">' + esc(track.title) + "</span>" +
        '<span class="track-artist">' + esc(track.artist || "Unknown") + "</span>" +
      "</button>"
    );
  }

  // Wire one card's click (play) and its heart (favorite). Idempotent via the
  // data-wired flag so incremental renders (home streams, search) don't stack
  // duplicate listeners on cards that were already wired.
  function wireCard(card) {
    if (card.getAttribute("data-wired")) return;
    card.setAttribute("data-wired", "1");
    var idx = parseInt(card.getAttribute("data-index"), 10);
    card.addEventListener("click", function () { playIndex(idx); });
    var heart = card.querySelector(".track-fav");
    if (heart) heart.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleFavorite(queue[idx]);
    });
  }

  // Wire any not-yet-wired cards in the body.
  function bindCards() {
    var cards = body.querySelectorAll(".track-card");
    for (var i = 0; i < cards.length; i++) wireCard(cards[i]);
    markPlaying();
  }

  function markPlaying() {
    var cards = body.querySelectorAll(".track-card");
    for (var i = 0; i < cards.length; i++) {
      var idx = parseInt(cards[i].getAttribute("data-index"), 10);
      cards[i].classList.toggle("playing", idx === current);
    }
  }

  // ── streaming render (shared by home + search) ───────────────────────────
  // Both endpoints are SSE. We keep a handle to the live EventSource so a new
  // search can cancel an in-flight one instead of racing it.

  var activeStream = null;

  function closeStream() {
    if (activeStream) { try { activeStream.close(); } catch (e) {} activeStream = null; }
  }

  function loadHome() {
    closeStream();
    queue = [];
    current = current; // keep whatever is playing
    body.innerHTML = "";
    setStatus("Loading…");

    var es = new EventSource("/api/music/ytm/home?limit=12");
    activeStream = es;

    es.onmessage = function (ev) {
      if (ev.data === "[DONE]") {
        closeStream();
        setStatus("");
        if (!queue.length) body.innerHTML = '<div class="music-empty">Nothing to show right now. Try a search.</div>';
        return;
      }
      var payload;
      try { payload = JSON.parse(ev.data); } catch (e) { return; }
      if (!payload.section || !payload.tracks) return;

      var section = document.createElement("section");
      section.className = "music-section";
      var startIndex = queue.length;
      var cardsHtml = payload.tracks.map(function (t, i) {
        queue.push(t);
        return trackCard(t, startIndex + i);
      }).join("");
      section.innerHTML =
        '<h2 class="music-section-title">' + esc(payload.section) + "</h2>" +
        '<div class="track-grid">' + cardsHtml + "</div>";
      body.appendChild(section);
      bindCards();
      setStatus("");
    };

    es.onerror = function () {
      closeStream();
      setStatus("");
      if (!queue.length) body.innerHTML = '<div class="music-empty">Couldn\'t reach the music service.</div>';
    };
  }

  function skeletons(n) {
    var out = "";
    for (var i = 0; i < n; i++) out += '<div class="track-skeleton"></div>';
    return out;
  }

  function runSearch(q) {
    closeStream();
    queue = [];
    body.innerHTML =
      '<section class="music-section">' +
        '<h2 class="music-section-title">Results for "' + esc(q) + '"</h2>' +
        '<div class="track-grid" id="searchGrid">' + skeletons(10) + "</div>" +
      "</section>";
    var grid = $("searchGrid");
    var first = true;
    setStatus("Searching…");

    var es = new EventSource("/api/music/ytm/search?q=" + encodeURIComponent(q) + "&limit=30");
    activeStream = es;

    es.onmessage = function (ev) {
      if (ev.data === "[DONE]") {
        closeStream();
        setStatus("");
        if (!queue.length) grid.parentNode.innerHTML = '<div class="music-empty">No results for "' + esc(q) + '".</div>';
        return;
      }
      var track;
      try { track = JSON.parse(ev.data); } catch (e) { return; }
      if (first) { grid.innerHTML = ""; first = false; }
      var index = queue.length;
      queue.push(track);
      grid.insertAdjacentHTML("beforeend", trackCard(track, index));
      wireCard(grid.lastElementChild);
      markPlaying();
    };

    es.onerror = function () {
      closeStream();
      setStatus("");
      if (!queue.length) grid.parentNode.innerHTML = '<div class="music-empty">Search failed. Try again.</div>';
    };
  }

  // ── playback ─────────────────────────────────────────────────────────────

  var playIcon = player.querySelector(".ic-play");
  var pauseIcon = player.querySelector(".ic-pause");

  // These two are <svg>, not HTML elements, and `hidden` is an HTMLElement IDL
  // attribute — `svg.hidden = true` only sets a JS expando and never touches
  // the DOM attribute, so the icons never swapped. Set the attribute directly.
  // (css/page-music.css carries the matching svg[hidden] rule, because the UA's
  // own [hidden] rule is HTML-namespaced and doesn't reach inline SVG either.)
  function showTransport(playing) {
    playIcon.toggleAttribute("hidden", playing);
    pauseIcon.toggleAttribute("hidden", !playing);
  }

  function playIndex(idx) {
    if (idx < 0 || idx >= queue.length) return;
    current = idx;
    var track = queue[idx];

    player.hidden = false;
    $("pThumb").src = track.thumb || "";
    $("pTitle").textContent = track.title || "—";
    $("pArtist").textContent = track.artist || "";

    var url = "/api/sp/audio/" + encodeURIComponent(track.id) +
      "?t=" + encodeURIComponent(track.title || "") +
      "&a=" + encodeURIComponent(track.artist || "");
    audio.src = url;
    setArtistState("loading"); // first play waits on the server-side resolve (~5-10s)
    beginDownloadLog(track);
    audio.play().catch(function () {});
    setStatus("");
    markPlaying();
    refreshHearts();
    resetLyrics(track);
  }

  // The now-playing bar's second line doubles as a status line: it shows
  // "Loading…" while the track is fetched/buffered (the first play of a track
  // waits ~5-10s while the server resolves a media URL for it; after that the
  // audio is streamed, so seeking is served from upstream immediately), the
  // real artist once it's playing, and an error if it can't be loaded at all.
  function setArtistState(state) {
    var t = queue[current];
    if (state === "loading") $("pArtist").textContent = "Loading…";
    else if (state === "error") $("pArtist").textContent = "Couldn’t load this track";
    else $("pArtist").textContent = (t && t.artist) || "";
  }

  function togglePlay() {
    if (current < 0) { if (queue.length) playIndex(0); return; }
    if (audio.paused) audio.play().catch(function () {}); else audio.pause();
  }

  function step(delta) {
    if (!queue.length) return;
    var next = current + delta;
    if (next < 0) next = queue.length - 1;
    if (next >= queue.length) next = 0;
    playIndex(next);
  }

  $("pPlay").addEventListener("click", togglePlay);
  $("pPrev").addEventListener("click", function () { step(-1); });
  $("pNext").addEventListener("click", function () { step(1); });

  // ── Remote control from the host page ────────────────────────────────────
  // This page is also mounted as an iframe by js/game-music.js, which puts
  // play/pause buttons next to its floating button so you can control playback
  // without sliding the whole panel open. Those buttons live in another
  // document, so the only way across is postMessage. Everything is namespaced
  // and the outbound state is broadcast on every transport event, so the host's
  // icons follow whatever happens in here — including a track ending on its own.
  var REMOTE_NS = "desync-music";

  function remoteState() {
    var track = queue[current];
    return {
      ns: REMOTE_NS,
      type: "state",
      playing: Boolean(track) && !audio.paused,
      hasTrack: Boolean(track),
      title: (track && track.title) || "",
      artist: (track && track.artist) || "",
    };
  }

  function pushState() {
    if (window.parent === window) return;
    try { window.parent.postMessage(remoteState(), window.location.origin); } catch (e) {}
  }

  ["play", "pause", "ended", "loadedmetadata", "error"].forEach(function (event) {
    audio.addEventListener(event, pushState);
  });

  window.addEventListener("message", function (event) {
    // Same-origin only: this page is framed by the site itself, never by a
    // proxied third-party page.
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.ns !== REMOTE_NS) return;

    if (data.action === "play") {
      if (current < 0) { if (queue.length) playIndex(0); }
      else audio.play().catch(function () {});
    } else if (data.action === "pause") {
      audio.pause();
    } else if (data.action === "toggle") {
      togglePlay();
    } else if (data.action === "next") {
      step(1);
    } else if (data.action === "prev") {
      step(-1);
    }
    pushState();
  });

  // The host mounts its controls before this page finishes loading, so announce
  // the starting state rather than waiting for the first play.
  pushState();

  audio.addEventListener("play", function () { showTransport(true); });
  audio.addEventListener("pause", function () { showTransport(false); });
  audio.addEventListener("ended", function () { step(1); });
  audio.addEventListener("waiting", function () { setArtistState("loading"); });
  audio.addEventListener("playing", function () { setArtistState("ok"); });
  audio.addEventListener("canplay", function () { setArtistState("ok"); });
  audio.addEventListener("error", function () {
    setArtistState("error");
    setStatus("Couldn’t load that track — try another.");
    showTransport(false);
    stopHeartbeat();
    console.warn("[desync music] ✗ failed to load audio for this track");
  });

  // ── console stream progress (devtools) ───────────────────────────────────
  // The server resolves a media URL before any bytes can flow, so the first
  // play still has a short silent gap (~5-10s) with nothing buffered. Log a
  // heartbeat during that, then a buffered-percentage bar as data streams in.
  function bar(pct) {
    var n = Math.max(0, Math.min(10, Math.round(pct / 10)));
    return "[" + Array(n + 1).join("█") + Array(11 - n).join("░") + "] " + Math.round(pct) + "%";
  }
  var dlStart = 0, dlHeartbeat = null, lastPctLogged = -1;
  function stopHeartbeat() { if (dlHeartbeat) { clearInterval(dlHeartbeat); dlHeartbeat = null; } }
  function beginDownloadLog(track) {
    dlStart = Date.now();
    lastPctLogged = -1;
    stopHeartbeat();
    console.log("%c[desync music] ▶ " + (track.title || "") + " — " + (track.artist || ""), "font-weight:bold");
    console.log("[desync music] requesting audio… first play resolves through the proxy (~5-10s), then streams");
    dlHeartbeat = setInterval(function () {
      if (audio.readyState >= 2) { stopHeartbeat(); return; }
      console.log("[desync music] resolving source… " + Math.round((Date.now() - dlStart) / 1000) + "s");
    }, 2000);
  }
  audio.addEventListener("progress", function () {
    if (!audio.duration || !isFinite(audio.duration)) return;
    var end = 0;
    try { if (audio.buffered.length) end = audio.buffered.end(audio.buffered.length - 1); } catch (e) { return; }
    var pct = Math.min(100, (end / audio.duration) * 100);
    if (pct - lastPctLogged < 8 && pct < 100) return; // throttle to meaningful steps
    lastPctLogged = pct;
    console.log("[desync music] buffered " + bar(pct));
  });
  audio.addEventListener("canplay", function () {
    stopHeartbeat();
    console.log("[desync music] ✓ ready — started in " + ((Date.now() - dlStart) / 1000).toFixed(1) + "s");
  });

  // Seek bar (0–1000 scale so we don't depend on knowing duration up front).
  var seek = $("pSeek");
  var seeking = false;
  seek.addEventListener("input", function () { seeking = true; $("pCur").textContent = fmtTime((seek.value / 1000) * (audio.duration || 0)); });
  seek.addEventListener("change", function () {
    if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
    seeking = false;
  });

  audio.addEventListener("loadedmetadata", function () { $("pDur").textContent = fmtTime(audio.duration); });
  audio.addEventListener("timeupdate", function () {
    if (!seeking && audio.duration) {
      seek.value = String((audio.currentTime / audio.duration) * 1000);
      $("pCur").textContent = fmtTime(audio.currentTime);
    }
    updateLyricHighlight(audio.currentTime);
  });

  // Volume
  var vol = $("pVol");
  vol.addEventListener("input", function () { audio.volume = vol.value / 100; });

  // Keyboard: space toggles play (unless typing in the search box).
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" && document.activeElement !== searchInput && !player.hidden) {
      e.preventDefault();
      togglePlay();
    }
  });

  // ── lyrics ───────────────────────────────────────────────────────────────

  var lyricsPanel = $("lyricsPanel");
  var lyricsBody = $("lyricsBody");
  var lyricsBtn = $("pLyrics");
  var syncedLines = null; // [{time, text}] or null

  function openLyrics() {
    lyricsPanel.hidden = false;
    lyricsBtn.classList.add("active");
    if (current >= 0) resetLyrics(queue[current]);
  }
  function closeLyrics() {
    lyricsPanel.hidden = true;
    lyricsBtn.classList.remove("active");
  }
  lyricsBtn.addEventListener("click", function () {
    if (lyricsPanel.hidden) openLyrics(); else closeLyrics();
  });
  $("lyricsClose").addEventListener("click", closeLyrics);

  function parseLrc(lrc) {
    var out = [];
    var lines = lrc.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var m = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(lines[i]);
      if (m) {
        var t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
        var text = m[3].trim();
        out.push({ time: t, text: text });
      }
    }
    return out.length ? out : null;
  }

  function resetLyrics(track) {
    syncedLines = null;
    if (lyricsPanel.hidden) return; // don't fetch until the panel is open
    $("lyricsTitle").textContent = track.title || "Lyrics";
    lyricsBody.innerHTML = '<div class="lyrics-empty">Loading lyrics…</div>';

    var url = "/api/music/lyrics?track=" + encodeURIComponent(track.title || "") +
      "&artist=" + encodeURIComponent(track.artist || "");
    if (track.duration) url += "&duration=" + encodeURIComponent(track.duration);

    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (data.syncedLyrics) {
        syncedLines = parseLrc(data.syncedLyrics);
      }
      if (syncedLines) {
        lyricsBody.innerHTML = syncedLines.map(function (l, i) {
          return '<div class="lyric-line" data-i="' + i + '">' + esc(l.text || "♪") + "</div>";
        }).join("");
      } else if (data.plainLyrics) {
        lyricsBody.innerHTML = data.plainLyrics.split("\n").map(function (line) {
          return '<div class="lyric-line plain">' + esc(line || "&nbsp;") + "</div>";
        }).join("");
      } else {
        lyricsBody.innerHTML = '<div class="lyrics-empty">No lyrics found for this track.</div>';
      }
    }).catch(function () {
      lyricsBody.innerHTML = '<div class="lyrics-empty">Couldn\'t load lyrics.</div>';
    });
  }

  var lastLyricIndex = -1;
  function updateLyricHighlight(time) {
    if (!syncedLines || lyricsPanel.hidden) return;
    var idx = -1;
    for (var i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= time) idx = i; else break;
    }
    if (idx === lastLyricIndex) return;
    lastLyricIndex = idx;
    var lines = lyricsBody.querySelectorAll(".lyric-line");
    for (var j = 0; j < lines.length; j++) lines[j].classList.remove("active");
    if (idx >= 0 && lines[idx]) {
      lines[idx].classList.add("active");
      lines[idx].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  // ── favorites (accounts only) ────────────────────────────────────────────
  var favBtn = $("favViewBtn");
  var favPlayerBtn = $("pFav");

  // Reflect the current fav state onto every visible heart (cards + player).
  function refreshHearts() {
    var hearts = body.querySelectorAll(".track-fav");
    for (var i = 0; i < hearts.length; i++) {
      var card = hearts[i].closest(".track-card");
      var idx = card ? parseInt(card.getAttribute("data-index"), 10) : -1;
      var t = queue[idx];
      hearts[i].classList.toggle("is-fav", !!(t && favIds.has(t.id)));
    }
    var cur = queue[current];
    favPlayerBtn.classList.toggle("is-fav", !!(cur && favIds.has(cur.id)));
  }

  function toggleFavorite(track) {
    if (!track) return;
    if (!account.loggedIn) {
      if (confirm("Make a free account to save your favorite songs.\n\nGo to sign up?")) {
        window.location.href = "/account.html";
      }
      return;
    }
    var id = track.id;
    var lean = { id: id, title: track.title, artist: track.artist, thumb: track.thumb, duration: track.duration };
    if (favIds.has(id)) {
      favIds.delete(id);
      favTracks = favTracks.filter(function (t) { return t.id !== id; });
      fetch("/api/favorites/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + account.token },
      }).catch(function () {});
    } else {
      favIds.add(id);
      favTracks.unshift(lean);
      fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + account.token },
        body: JSON.stringify(lean),
      }).catch(function () {});
    }
    refreshHearts();
    if (viewingFavs) showFavorites(); // keep the Liked list in sync
  }

  // Render the saved tracks as their own view (like search results).
  function showFavorites() {
    viewingFavs = true;
    favBtn.classList.add("active");
    closeStream();
    queue = favTracks.slice();
    if (!queue.length) {
      body.innerHTML = '<div class="music-empty">No liked songs yet. Tap the ♥ on any track to save it.</div>';
      return;
    }
    var cards = "";
    for (var i = 0; i < queue.length; i++) cards += trackCard(queue[i], i);
    body.innerHTML =
      '<section class="music-section"><h2 class="music-section-title">Liked Songs</h2>' +
      '<div class="track-grid">' + cards + "</div></section>";
    bindCards();
    refreshHearts();
  }

  function loadFavorites() {
    fetch("/api/favorites", { headers: { Authorization: "Bearer " + account.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        favTracks = data.favorites || [];
        favIds = new Set(favTracks.map(function (t) { return t.id; }));
        refreshHearts();
        if (viewingFavs) showFavorites();
      }).catch(function () {});
  }

  favBtn.addEventListener("click", function () {
    if (viewingFavs) { viewingFavs = false; favBtn.classList.remove("active"); loadHome(); }
    else showFavorites();
  });
  favPlayerBtn.addEventListener("click", function () { toggleFavorite(queue[current]); });

  // Check login once; enable the favorites UI (via a body class) only for
  // accounts. Guests see no hearts and get a hint if they try.
  (function initAuth() {
    var token = null;
    try { token = localStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.loggedIn) {
          account = { loggedIn: true, token: token };
          document.body.classList.add("music-authed");
          loadFavorites();
        }
      }).catch(function () {});
  })();

  // ── search wiring (debounced) ────────────────────────────────────────────

  var searchTimer = null;
  searchInput.addEventListener("input", function () {
    var q = searchInput.value.trim();
    clearTimeout(searchTimer);
    viewingFavs = false; favBtn.classList.remove("active");
    if (!q) { loadHome(); return; }
    searchTimer = setTimeout(function () { runSearch(q); }, 320);
  });
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      clearTimeout(searchTimer);
      var q = searchInput.value.trim();
      if (q) { viewingFavs = false; favBtn.classList.remove("active"); runSearch(q); }
    }
  });

  // ── init ─────────────────────────────────────────────────────────────────
  loadHome();
})();
