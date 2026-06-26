"use strict";

/**
 * @type {HTMLFormElement}
 */
const form = document.getElementById("sj-form");
/**
 * @type {HTMLInputElement}
 */
const address = document.getElementById("sj-address");
/**
 * @type {HTMLInputElement}
 */
const searchEngine = document.getElementById("sj-search-engine");
/**
 * @type {HTMLParagraphElement}
 */
const error = document.getElementById("sj-error");
/**
 * @type {HTMLPreElement}
 */
const errorCode = document.getElementById("sj-error-code");

// Base path for subfolder support (automatically detects current folder)
const basePath = window.location.pathname.replace(/\/[^/]*$/, '') + '/';

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
    files: {
        wasm: basePath + "scram/scramjet.wasm.wasm",
        all: basePath + "scram/scramjet.all.js",
        sync: basePath + "scram/scramjet.sync.js",
    },
});

scramjet.init();

const connection = new BareMux.BareMuxConnection(basePath + "baremux/worker.js");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await registerSW();
    } catch (err) {
        error.textContent = "Failed to register service worker.";
        errorCode.textContent = err.toString();
        console.error(err);
        throw err;
    }

    const url = search(address.value, searchEngine.value);

    // Dynamic wisp URL based on current folder
    let wispUrl = 
        (location.protocol === "https:" ? "wss" : "ws") +
        "://" + location.host + 
        basePath + "wisp/";

    if ((await connection.getTransport()) !== basePath + "libcurl/index.mjs") {
        await connection.setTransport(basePath + "libcurl/index.mjs", [
            { websocket: wispUrl },
        ]);
    }

    const frame = scramjet.createFrame();
    frame.frame.id = "sj-frame";
    document.body.appendChild(frame.frame);
    frame.go(url);
});

// Auto-submit support
const params = new URLSearchParams(window.location.search);
const autoUrl = params.get("url");
if (autoUrl) {
    address.value = autoUrl;
    form.requestSubmit();
}
