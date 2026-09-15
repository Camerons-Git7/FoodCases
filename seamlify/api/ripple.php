<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$base = 'https://edit.progressiveschoolhouse.org/ripple';

$path = $_GET['path'] ?? '';

if ($path === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Missing API path']);
    exit;
}

/*
 * Allow Ripple API endpoints and assets.
 */
if (!preg_match(
    '#^/(api|assets)/[a-zA-Z0-9_./-]+$#',
    $path
)) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Invalid Ripple path']);
    exit;
}

$url = $base . $path;

/*
 * Preserve query parameters except "path".
 */
$query = $_GET;
unset($query['path']);

if (!empty($query)) {
    $url .= '?' . http_build_query($query);
}

$method = $_SERVER['REQUEST_METHOD'];

$ch = curl_init($url);

$options = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HEADER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_USERAGENT => $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0',
];

if ($method === 'POST') {
    $options[CURLOPT_POST] = true;
    $options[CURLOPT_POSTFIELDS] = file_get_contents('php://input');

    $options[CURLOPT_HTTPHEADER] = [
        'Content-Type: ' . (
            $_SERVER['CONTENT_TYPE'] ?? 'application/json'
        )
    ];
}

curl_setopt_array($ch, $options);

$response = curl_exec($ch);

if ($response === false) {
    $error = curl_error($ch);
    curl_close($ch);

    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'error' => 'Ripple upstream request failed',
        'details' => $error
    ]);

    exit;
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

$headers = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

curl_close($ch);

http_response_code($status);

/*
 * Forward the upstream Content-Type.
 */
if (preg_match(
    '/Content-Type:\s*([^\r\n]+)/i',
    $headers,
    $match
)) {
    header('Content-Type: ' . trim($match[1]));
} else {
    header('Content-Type: application/json; charset=utf-8');
}

echo $body;
