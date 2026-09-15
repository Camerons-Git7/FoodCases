<?php

/*
 * Downloads EVERYTHING inside the current /ripple/ directory
 * recursively as a ZIP.
 *
 * The PHP file itself is excluded from the ZIP.
 */

set_time_limit(0);
ini_set('memory_limit', '-1');

$root = realpath(__DIR__);

if ($root === false) {
    http_response_code(500);
    exit("Could not determine Ripple directory.");
}

$zip = new ZipArchive();

$tmp = tempnam(sys_get_temp_dir(), 'ripple_');

if ($tmp === false) {
    http_response_code(500);
    exit("Could not create temporary file.");
}

if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    @unlink($tmp);
    http_response_code(500);
    exit("Could not create ZIP.");
}

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(
        $root,
        FilesystemIterator::SKIP_DOTS
    ),
    RecursiveIteratorIterator::LEAVES_ONLY
);

foreach ($iterator as $file) {

    if (!$file->isFile()) {
        continue;
    }

    $fullPath = $file->getRealPath();

    if ($fullPath === false) {
        continue;
    }

    /*
     * Don't include this PHP downloader itself.
     */
    if ($fullPath === __FILE__) {
        continue;
    }

    /*
     * Don't include the temporary ZIP if it happens to
     * be inside this directory.
     */
    if ($fullPath === $tmp) {
        continue;
    }

    /*
     * Convert absolute filesystem path into a path
     * relative to /ripple/.
     */
    $relativePath = substr(
        $fullPath,
        strlen($root) + 1
    );

    /*
     * Normalize Windows backslashes.
     */
    $relativePath = str_replace('\\', '/', $relativePath);

    $zip->addFile($fullPath, $relativePath);
}

$zip->close();

/*
 * Send ZIP to browser.
 */
if (!file_exists($tmp)) {
    http_response_code(500);
    exit("ZIP was not created.");
}

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="ripple-everything.zip"');
header('Content-Length: ' . filesize($tmp));
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

readfile($tmp);

@unlink($tmp);
exit;
