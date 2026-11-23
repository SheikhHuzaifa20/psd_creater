<?php

use App\Http\Controllers\PsdConverterController;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$source = $argv[1] ?? __DIR__.'/sample_test.psd';
if (! is_file($source)) {
    fwrite(STDERR, "PSD not found\n");
    exit(1);
}
// Preserve the original PSD: conversion moves only this temporary copy.
$staged = storage_path('app/temp/check_'.bin2hex(random_bytes(8)).'.psd');
// A hard link preserves the source without duplicating a large PSD on a nearly full disk.
if (! @link(realpath($source), $staged)) {
    if (disk_free_space(dirname($staged)) < filesize($source) + 32 * 1024 * 1024) {
        fwrite(STDERR, "Insufficient space to stage PSD safely. Original file preserved.\n");
        exit(1);
    }
    if (! copy($source, $staged)) {
        @unlink($staged);
        exit(1);
    }
}
config(['psd.ai_enabled' => in_array('--ai', $argv, true)]);
$request = Request::create('/convert', 'POST');
$request->files->set('psd_file', new UploadedFile($staged, 'design.psd', 'image/vnd.adobe.photoshop', null, true));
try {
    $response = app(PsdConverterController::class)->convert($request);
    echo $response->getContent(), PHP_EOL;
    exit($response->getStatusCode() === 200 ? 0 : 1);
} finally {
    if (is_file($staged)) {
        unlink($staged);
    }
}
