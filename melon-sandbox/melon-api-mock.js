/**
 * melon-api-mock.js — single-file offline stand-in for Melon / playmelonpg APIs
 *
 * Host this next to your game (e.g. https://menist.free.nf/melon-sandbox/melon-api-mock.js)
 * and load it BEFORE the game / MelWebSdk:
 *
 *   <script src="melon-api-mock.js"></script>
 *
 * It intercepts fetch + XHR to:
 *   - pg-proxy.playmelonpg.com
 *   - us-discovery-01.playmelonpg.com
 *   - config.uca.cloud.unity3d.com
 *   - cdp.cloud.unity3d.com
 *   - gameanalytics.com / melonsandbox.com/api
 *
 * and returns JSON shapes the WebGL client expects so map load can proceed offline.
 */
(function (global) {
  "use strict";

  var NOW = function () { return Date.now(); };

  // ---------- response builders ----------
  function authBody() {
    return {
      status: "ok",
      isAuthorized: true,
      isGuest: true,
      isAvailable: true,
      playerId: "guest-standalone",
      userId: "guest-standalone",
      nickname: "Guest",
      deviceId: "standalone-device",
      token: "standalone-token",
      accessToken: "standalone-token",
      sessionId: "standalone-session-" + NOW(),
      softCurrency: 999999,
      hardCurrency: 999999,
      coins: 999999,
      mells: 999999,
      language: "en",
      region: "US",
      inventory: [],
      serverTime: NOW()
    };
  }

  function walletBody() {
    return {
      soft: 999999,
      hard: 999999,
      coins: 999999,
      mells: 999999,
      balance: 999999,
      softCurrency: 999999,
      hardCurrency: 999999,
      status: "ok"
    };
  }

  function discoveryBody() {
    return {
      status: "ok",
      endpoints: [],
      resolve: { endpoints: [] },
      region: "us",
      serverTime: NOW()
    };
  }

  function serverTimeBody() {
    return {
      serverTime: NOW(),
      time: NOW(),
      status: "ok",
      sections: []
    };
  }

  /** Route table: regex → body (string or object) */
  var ROUTES = [
    // --- Melon pg-proxy ---
    { re: /tab-config|get-tabs|tabs-by-moniker/i, body: [] },
    { re: /manifest\/list|list-active/i, body: [] },
    { re: /achievement/i, body: [] },
    { re: /wallet\/me|account-preview/i, body: walletBody },
    { re: /server-time|app-section-status/i, body: serverTimeBody },
    { re: /content-pack|workshop|catalog|maps?/i, body: [] },
    { re: /auth|login|session|token/i, body: authBody },

    // --- discovery ---
    { re: /us-discovery|\/v1\/resolve/i, body: discoveryBody },

    // --- Unity analytics (harmless empty) ---
    { re: /config\.uca\.cloud\.unity3d\.com/i, body: {} },
    { re: /cdp\.cloud\.unity3d\.com/i, body: {} },
    { re: /gameanalytics\.com/i, body: {} },

    // --- catch-all list-ish ---
    { re: /\/list|\/all|\/get-/i, body: [] }
  ];

  function bodyFor(url) {
    url = String(url || "");
    for (var i = 0; i < ROUTES.length; i++) {
      if (ROUTES[i].re.test(url)) {
        var b = ROUTES[i].body;
        return typeof b === "function" ? b() : b;
      }
    }
    return {
      status: "ok",
      data: [],
      result: [],
      items: [],
      ready: true,
      serverTime: NOW()
    };
  }

  function toText(body) {
    return typeof body === "string" ? body : JSON.stringify(body);
  }

  function shouldStub(url) {
    return /playmelonpg\.com|melonsandbox\.com\/api|pg-proxy|us-discovery|gameanalytics\.com|cdp\.cloud\.unity3d\.com|config\.uca\.cloud\.unity3d\.com/i.test(
      String(url || "")
    );
  }

  // ---------- fetch stub ----------
  if (typeof global.fetch === "function") {
    var _fetch = global.fetch.bind(global);
    global.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (shouldStub(url)) {
        var text = toText(bodyFor(url));
        if (global.console && console.log) {
          console.log("[melon-api-mock] fetch", url.slice(0, 120));
        }
        return Promise.resolve(
          new Response(text, {
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          })
        );
      }
      return _fetch(input, init);
    };
  }

  // ---------- XHR stub ----------
  if (typeof XMLHttpRequest !== "undefined") {
    var _open = XMLHttpRequest.prototype.open;
    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__melonMockUrl = url;
      return _open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      var u = String(this.__melonMockUrl || "");
      if (!shouldStub(u)) {
        return _send.apply(this, arguments);
      }
      var xhr = this;
      var text = toText(bodyFor(u));
      var rt = xhr.responseType;
      if (global.console && console.log) {
        console.log("[melon-api-mock] xhr", u.slice(0, 120));
      }
      setTimeout(function () {
        try {
          Object.defineProperty(xhr, "status", { configurable: true, value: 200 });
          Object.defineProperty(xhr, "statusText", { configurable: true, value: "OK" });
          Object.defineProperty(xhr, "readyState", { configurable: true, value: 4 });
          Object.defineProperty(xhr, "responseText", { configurable: true, value: text });
          var resp = text;
          if (rt === "json") {
            try {
              resp = JSON.parse(text);
            } catch (e) {
              resp = {};
            }
          }
          Object.defineProperty(xhr, "response", { configurable: true, value: resp });
        } catch (e) {}
        if (typeof xhr.onreadystatechange === "function") {
          try {
            xhr.onreadystatechange();
          } catch (e) {}
        }
        if (typeof xhr.onload === "function") {
          try {
            xhr.onload();
          } catch (e) {}
        }
        try {
          xhr.dispatchEvent(new Event("load"));
        } catch (e) {}
        try {
          xhr.dispatchEvent(new Event("loadend"));
        } catch (e) {}
      }, 5);
    };
  }

  // ---------- optional: expose for debugging ----------
  global.MelonApiMock = {
    bodyFor: bodyFor,
    shouldStub: shouldStub,
    routes: ROUTES,
    version: "1.0.0"
  };

  if (global.console && console.log) {
    console.log("[melon-api-mock] v1.0.0 active — playmelonpg / discovery / UCA stubbed");
  }
})(typeof window !== "undefined" ? window : globalThis);
