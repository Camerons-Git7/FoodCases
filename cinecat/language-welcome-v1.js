// Runs before either app reads its persisted locale. Keep this shared with the
// React public/ and Svelte static/ copy; the saved envelope works with both.
(() => {
  const localeKey = "__MW::locale";
  const welcomeKey = "__MW::languageWelcome.v1";
  let saved = { state: { language: "en" }, version: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem(localeKey) || "null");
    if (stored && typeof stored === "object") {
      saved = stored.state ? stored : { state: stored, version: 0 };
    }
    if (
      !saved.state ||
      typeof saved.state.language !== "string" ||
      !saved.state.language
    ) {
      saved = { ...saved, state: { ...saved.state, language: "en" } };
    }
    localStorage.setItem(localeKey, JSON.stringify(saved));
    if (localStorage.getItem(welcomeKey) === "done") return;
  } catch {
    // The dialog remains usable when storage is restricted; save reports errors.
  }

  function openWelcome() {
    const languages = [
      "en",
      "ar",
      "bg",
      "bn",
      "ca",
      "cs",
      "da",
      "de",
      "de-CH",
      "el",
      "es",
      "et",
      "fa",
      "fi",
      "fr",
      "gl",
      "gu",
      "he",
      "hi",
      "hu",
      "id",
      "is",
      "it",
      "ja",
      "km",
      "ko",
      "lv",
      "ne",
      "nl",
      "nv",
      "pa",
      "pl",
      "pt-BR",
      "pt-PT",
      "ro",
      "ru",
      "si",
      "sl",
      "sv",
      "ta",
      "th",
      "tok",
      "tr",
      "uk",
      "umb",
      "ur-PK",
      "vi",
      "zh",
      "zh-Hant",
    ];
    const dialog = document.createElement("dialog");
    dialog.id = "cinecat-language-welcome";
    dialog.setAttribute("aria-labelledby", "cinecat-language-title");
    dialog.setAttribute("aria-describedby", "cinecat-language-description");
    const style = document.createElement("style");
    style.textContent = `
      #cinecat-language-welcome { box-sizing:border-box; position:fixed; inset:0; width:min(420px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); margin:auto; padding:28px; border:1px solid rgb(255 255 255 / .1); border-radius:28px; background:rgb(13 13 13 / .96); color:#fff; box-shadow:0 24px 60px -20px rgb(0 0 0 / .8); font:16px/1.5 Lato,system-ui,sans-serif; text-align:left; animation:cinecat-lang-in 260ms cubic-bezier(.16,1,.3,1); }
      #cinecat-language-welcome::backdrop { background:rgb(0 0 0 / .6); backdrop-filter:blur(12px); animation:cinecat-lang-fade 200ms ease-out; }
      #cinecat-language-welcome * { box-sizing:border-box; }
      #cinecat-language-welcome h2 { font-size:26px; line-height:1.15; font-weight:700; margin:0 0 8px; letter-spacing:-.02em; color:#fff; }
      #cinecat-language-welcome p { margin:0 0 22px; color:rgb(255 255 255 / .6); font-size:14px; line-height:1.5; }
      #cinecat-language-welcome label { display:block; font-size:13px; font-weight:600; margin:0 0 8px 4px; color:rgb(255 255 255 / .75); }
      #cinecat-language-welcome input[type=search] { appearance:none; -webkit-appearance:none; width:100%; height:48px; padding:0 18px 0 46px; font:500 15px/1 Lato,system-ui,sans-serif; color:#fff; background:rgb(255 255 255 / .06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff99' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat left 16px center / 18px; border:1px solid rgb(255 255 255 / .12); border-radius:999px; color-scheme:dark; transition:background-color 200ms,border-color 200ms; }
      #cinecat-language-welcome input[type=search]::placeholder { color:rgb(255 255 255 / .45); }
      #cinecat-language-welcome input[type=search]::-webkit-search-cancel-button { display:none; }
      #cinecat-language-welcome input[type=search]:hover, #cinecat-language-welcome input[type=search]:focus { background-color:rgb(255 255 255 / .1); border-color:rgb(255 255 255 / .22); outline:none; }
      #cinecat-language-welcome ul { list-style:none; margin:10px 0 0; padding:6px; height:216px; overflow-y:auto; scrollbar-width:none; border:1px solid rgb(255 255 255 / .08); border-radius:20px; background:rgb(255 255 255 / .03); }
      #cinecat-language-welcome ul::-webkit-scrollbar { display:none; }
      #cinecat-language-welcome li { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:40px; padding:0 14px; border-radius:14px; font-size:14px; font-weight:500; color:rgb(255 255 255 / .7); cursor:pointer; transition:background-color 150ms,color 150ms; }
      #cinecat-language-welcome li small { display:inline; margin:0; color:rgb(255 255 255 / .4); font-size:12px; }
      #cinecat-language-welcome li:hover, #cinecat-language-welcome li.active { background:rgb(255 255 255 / .08); color:#fff; }
      #cinecat-language-welcome li[aria-selected=true] { background:rgb(255 255 255 / .14); color:#fff; }
      #cinecat-language-welcome li.empty { cursor:default; color:rgb(255 255 255 / .45); justify-content:center; }
      #cinecat-language-welcome li.empty:hover { background:none; }
      #cinecat-language-welcome button { display:block; width:100%; height:48px; margin-top:20px; padding:0 18px; border:0; border-radius:999px; background:#fff; color:#000; font:700 15px/1 Lato,system-ui,sans-serif; cursor:pointer; transition:background-color 200ms,scale 120ms; }
      #cinecat-language-welcome button:hover { background:#e5e7eb; }
      #cinecat-language-welcome button:active { scale:.97; }
      #cinecat-language-welcome :focus-visible { outline:2px solid rgb(255 255 255 / .85); outline-offset:3px; }
      #cinecat-language-welcome small { display:block; margin-top:14px; color:rgb(255 255 255 / .45); font-size:12px; text-align:center; }
      #cinecat-language-welcome [role=alert] { margin:12px 0 0; color:#fca5a5; font-size:13px; }
      @keyframes cinecat-lang-in { from { opacity:0; transform:translateY(10px) scale(.96); } }
      @keyframes cinecat-lang-fade { from { opacity:0; } }
      @media (prefers-reduced-motion:reduce) { #cinecat-language-welcome, #cinecat-language-welcome::backdrop { animation:none; } }
    `;
    dialog.innerHTML = `<form><h2 id="cinecat-language-title">Make yourself at home.</h2><p id="cinecat-language-description">Choose the language for Cinecat and movie and show titles. English is our default.</p><label for="cinecat-language-search">Your language</label><input id="cinecat-language-search" type="search" placeholder="Search your language" autocomplete="off" spellcheck="false" autofocus><ul id="cinecat-language-list" role="listbox" aria-label="Languages"></ul><button type="submit">Continue to Cinecat</button><small>You can change this anytime in Settings.</small><p role="alert" hidden></p></form>`;
    const search = dialog.querySelector("input");
    const list = dialog.querySelector("ul");
    const current = saved.state.language;
    if (!languages.includes(current)) languages.push(current);
    const english = (() => {
      try {
        return new Intl.DisplayNames(["en"], { type: "language" });
      } catch {
        return null;
      }
    })();
    const entries = languages.map((code) => {
      let name = code;
      try {
        name =
          new Intl.DisplayNames([code], { type: "language" }).of(code) || code;
      } catch {
        /* Keep the code for custom locales. */
      }
      let label = "";
      try {
        label = (english && english.of(code)) || "";
      } catch {
        /* No English name for this code. */
      }
      if (code === "en") name = "English";
      return { code, name, label: label && label !== name ? label : "" };
    });
    const select = { value: current };
    let visible = [];
    let active = -1;
    const fold = (text) =>
      text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    function render() {
      const query = fold(search.value.trim());
      visible = entries.filter(
        (e) =>
          !query ||
          fold(e.name).includes(query) ||
          fold(e.label).includes(query) ||
          e.code.toLowerCase().includes(query),
      );
      list.textContent = "";
      if (!visible.length) {
        const none = document.createElement("li");
        none.className = "empty";
        none.textContent = "No language found";
        list.appendChild(none);
        active = -1;
        return;
      }
      if (active >= visible.length || active < 0) {
        const at = visible.findIndex((e) => e.code === select.value);
        active = query ? 0 : at;
      }
      visible.forEach((e, i) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(e.code === select.value));
        if (i === active) li.className = "active";
        li.append(e.name);
        if (e.label) {
          const hint = document.createElement("small");
          hint.textContent = e.label;
          li.append(hint);
        }
        li.addEventListener("click", () => {
          select.value = e.code;
          render();
        });
        list.appendChild(li);
      });
    }
    function move(step) {
      if (!visible.length) return;
      active = (active + step + visible.length) % visible.length;
      render();
      if (list.children[active]) list.children[active].scrollIntoView({ block: "nearest" });
    }
    search.addEventListener("input", () => {
      active = -1;
      render();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter" && search.value.trim() && visible[active]) {
        event.preventDefault();
        select.value = visible[active].code;
        search.value = "";
        render();
      }
    });
    render();
    setTimeout(() => { const sel = list.querySelector("[aria-selected=true]"); if (sel) sel.scrollIntoView({ block: "center" }); }, 0);
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        // Re-read to preserve account restoration or other updates during welcome.
        const latest =
          JSON.parse(localStorage.getItem(localeKey) || "null") || saved;
        const envelope = latest.state ? latest : { state: latest, version: 0 };
        localStorage.setItem(
          localeKey,
          JSON.stringify({
            ...envelope,
            state: { ...envelope.state, language: select.value },
          }),
        );
        localStorage.setItem(welcomeKey, "done");
        location.reload();
      } catch {
        const error = dialog.querySelector("[role=alert]");
        error.textContent =
          "Your browser could not save this choice. Allow site storage, or press Escape and choose a language in Settings.";
        error.hidden = false;
      }
    });
    dialog.addEventListener("cancel", () => {
      try {
        localStorage.setItem(welcomeKey, "done");
      } catch {
        /* Storage may be unavailable. */
      }
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      style.remove();
    });
    document.head.appendChild(style);
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", openWelcome, { once: true });
  else openWelcome();
})();
