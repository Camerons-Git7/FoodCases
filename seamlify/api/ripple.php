<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$base = 'https://edit.progressiveschoolhouse.org/ripple';

$path = $_GET['path'] ?? '';

if ($path === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing API path']);
    exit;
}

/*
 * Only allow Ripple API paths.
 */
if (!preg_match('#^/(api|assets)/[a-zA-Z0-9_./-]+$#', $path)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid path']);
    exit;
}

$url = $base . $path;

/* Preserve query parameters except "path". */
$query = $_GET;
unset($query['path']);

if (!empty($query)) {
    $url .= '?' . http_build_query($query);
}

$ch = curl_init($url);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HEADER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_USERAGENT => $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0'
]);

$response = curl_exec($ch);

if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Ripple API request failed',
        'details' => curl_error($ch)
    ]);
    curl_close($ch);
    exit;
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

$headers = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

curl_close($ch);

http_response_code($status);

/* Forward useful response headers. */
if (preg_match('/Content-Type:\s*([^\r\n]+)/i', $headers, $match)) {
    header('Content-Type: ' . trim($match[1]));
}

echo $body;
