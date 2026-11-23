<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "route('index'): " . route('index') . "\n";
echo "route('convert'): " . route('convert') . "\n";
echo "route('download', ['filename' => 'test.zip']): " . route('download', ['filename' => 'test.zip']) . "\n";
