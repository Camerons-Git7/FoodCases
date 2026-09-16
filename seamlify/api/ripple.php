<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, Range');
header('Access-Control-Expose-Headers: Accept-Ranges, Content-Range, Content-Length, Content-Type');

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

if (!preg_match('#^/(api|assets)/[a-zA-Z0-9_./-]+$#', $path)) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Invalid Ripple path']);
    exit;
}

$url = $base . $path;

$query = $_GET;
unset($query['path']);
if (!empty($query)) {
    $url .= '?' . http_build_query($query);
}

$method = $_SERVER['REQUEST_METHOD'];
$isStream = str_starts_with($path, '/api/stream/');

$upstreamHeaders = [
    'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0'),
];

// Forward Range so the browser can seek mid-track.
if (!empty($_SERVER['HTTP_RANGE'])) {
    $upstreamHeaders[] = 'Range: ' . $_SERVER['HTTP_RANGE'];
}
if (!empty($_SERVER['HTTP_IF_RANGE'])) {
    $upstreamHeaders[] = 'If-Range: ' . $_SERVER['HTTP_IF_RANGE'];
}

$ch = curl_init($url);

if ($isStream) {
    // Stream audio through without buffering the full file.
    @ini_set('zlib.output_compression', '0');
    @ini_set('output_buffering', '0');
    if (function_exists('apache_setenv')) {
        @apache_setenv('no-gzip', '1');
    }
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }

    $statusCode = 0;
    $responseHeaders = [];
    $headersSent = false;

    $sendHeaders = static function () use (&$headersSent, &$statusCode, &$responseHeaders): void {
        if ($headersSent) {
            return;
        }
        $headersSent = true;
        http_response_code($statusCode > 0 ? $statusCode : 200);

        $forward = [
            'content-type',
            'content-length',
            'content-range',
            'accept-ranges',
            'content-disposition',
            'etag',
            'last-modified',
            'cache-control',
        ];
        foreach ($forward as $name) {
            if (!empty($responseHeaders[$name])) {
                header($name . ': ' . $responseHeaders[$name], true);
            }
        }
        if (empty($responseHeaders['accept-ranges'])) {
            header('Accept-Ranges: bytes', true);
        }
        header('X-Accel-Buffering: no');
    };

    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => $upstreamHeaders,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_HEADER => false,
        CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$statusCode, &$responseHeaders) {
            $len = strlen($line);
            if (preg_match('#^HTTP/\d+(?:\.\d+)?\s+(\d+)#', $line, $m)) {
                // Last status wins (after redirects).
                $statusCode = (int) $m[1];
                $responseHeaders = [];
                return $len;
            }
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $len;
        },
        CURLOPT_WRITEFUNCTION => static function ($ch, string $data) use ($sendHeaders) {
            $sendHeaders();
            echo $data;
            flush();
            return strlen($data);
        },
    ]);

    $ok = curl_exec($ch);
    if ($ok === false) {
        $error = curl_error($ch);
        curl_close($ch);
        if (!$headersSent) {
            http_response_code(502);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'error' => 'Ripple upstream request failed',
                'details' => $error,
            ]);
        }
        exit;
    }

    // Upstream returned headers but no body (e.g. empty 206) — still emit headers.
    $sendHeaders();
    curl_close($ch);
    exit;
}

// JSON / images / other non-stream requests.
$options = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HEADER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => $upstreamHeaders,
];

if ($method === 'POST') {
    $options[CURLOPT_POST] = true;
    $options[CURLOPT_POSTFIELDS] = file_get_contents('php://input');
    $options[CURLOPT_HTTPHEADER] = array_merge($upstreamHeaders, [
        'Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'application/json'),
    ]);
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
        'details' => $error,
    ]);
    exit;
}

$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);
curl_close($ch);

http_response_code($status);

foreach ([
    'Content-Type',
    'Content-Length',
    'Content-Range',
    'Accept-Ranges',
    'Content-Disposition',
    'ETag',
    'Last-Modified',
    'Cache-Control',
] as $name) {
    if (preg_match('/^' . preg_quote($name, '/') . ':\s*([^\r\n]+)/im', $headers, $match)) {
        header($name . ': ' . trim($match[1]), true);
    }
}

echo $body;
