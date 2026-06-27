const PREFIX = 'proxy/'; // relative to current folder

async function go() {
    let input = document.getElementById('url').value.trim();
    if (!input.startsWith('http')) input = 'https://' + input;
    
    const encoded = btoa(input);
    window.location.href = PREFIX + encoded;
}

// Register Service Worker with subfolder support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.log('Service Worker registered for subfolder'))
        .catch(err => console.error('SW registration failed', err));
}
