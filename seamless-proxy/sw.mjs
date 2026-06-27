const BASE_PATH = './'; // change if needed
const PREFIX = 'proxy/';

async function go() {
    let input = document.getElementById('url').value.trim();
    if (!input.startsWith('http')) input = 'https://' + input;
    
    const encoded = btoa(input);
    window.location.href = PREFIX + encoded;
}

// Register SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(reg => console.log('SW registered'))
        .catch(err => console.error('SW failed', err));
}
