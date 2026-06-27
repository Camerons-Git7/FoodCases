<?php header('Content-Type: text/html; charset=utf-8'); ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Minimal Proxy</title>
    <style>body { font-family: Arial; margin: 20px; }</style>
    <base href="./">
</head>
<body>
    <h1>Minimal Proxy (Subfolder)</h1>
    <input type="text" id="url" placeholder="https://tiktok.com" style="width: 70%;">
    <button onclick="go()">Go</button>

    <script src="proxy.js"></script>
</body>
</html>
