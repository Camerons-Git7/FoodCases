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

// Wait for Scramjet to be available
async function main() {
    if (typeof $scramjetLoadController === "undefined") {
        error.textContent = "Scramjet failed to load. Check scram/scramjet.all.js";
        console.error("Scramjet not loaded");
        return;
    }

    const { ScramjetController } = $scramjetLoadController();

    const scramjet = new ScramjetController({
        files: {
            wasm: "scram/scramjet.wasm.wasm",
            all: "scram/scramjet.all.js",
            sync: "scram/scramjet.sync.js",
        },
    });

    try {
        await scramjet.init();
    } catch (err) {
        console.error("Scramjet init failed:", err);
    }

    const connection = new BareMux.BareMuxConnection("baremux/worker.js");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            await registerSW();
        } catch (err) {
            error.textContent = "Failed to register service worker.";
            errorCode.textContent = err.toString();
            console.error(err);
            return;
        }

        const url = search(address.value, searchEngine.value);

        // Wisp is disabled
        try {
            await connection.setTransport("libcurl/index.mjs");
        } catch (err) {
            console.warn("Transport set failed, continuing anyway:", err);
        }

        const frame = scramjet.createFrame();
        frame.frame.id = "sj-frame";
        document.body.appendChild(frame.frame);
        frame.go(url);
    });

    // Auto-load URL from query parameter
    const params = new URLSearchParams(window.location.search);
    const autoUrl = params.get("url");
    if (autoUrl) {
        address.value = autoUrl;
        form.requestSubmit();
    }
}

// Start everything
main().catch(console.error);
