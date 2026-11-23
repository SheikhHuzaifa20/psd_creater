<?php
require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\File;

echo "=== Testing Node.js Execution from PHP ===" . PHP_EOL;

// Test 1: Basic node version
$nodePaths = [
    'node',
    'C:\Program Files\nodejs\node.exe',
    'C:\laragon\bin\nodejs\node.exe'
];

$nodePath = null;
foreach ($nodePaths as $path) {
    try {
        $check = Process::run([$path, '--version']);
        echo "Trying: $path => ExitCode: " . $check->exitCode() . " Output: " . trim($check->output()) . PHP_EOL;
        if (!$check->failed()) {
            $nodePath = $path;
            echo "Found Node.js at: $nodePath" . PHP_EOL;
            break;
        }
    } catch (\Exception $e) {
        echo "Failed $path: " . $e->getMessage() . PHP_EOL;
    }
}

if (!$nodePath) {
    echo "ERROR: Node.js not found!" . PHP_EOL;
    exit(1);
}

// Test 2: Check if psd_parser_simple.cjs exists
$scriptPath = base_path('psd_parser_simple.cjs');
echo "Script path: $scriptPath" . PHP_EOL;
echo "Script exists: " . (File::exists($scriptPath) ? 'YES' : 'NO') . PHP_EOL;

// Test 3: Run the actual parser with a dummy file
$testOutDir = storage_path('app/temp/test_run_' . time());
File::makeDirectory($testOutDir, 0755, true);

// Create a minimal fake PSD file to test fallback
$fakePsdPath = storage_path('app/temp/fake_test.psd');
file_put_contents($fakePsdPath, 'not a real psd');

echo "Running parser..." . PHP_EOL;
$result = Process::timeout(30)->run([
    $nodePath,
    $scriptPath,
    $fakePsdPath,
    $testOutDir
]);

echo "ExitCode: " . $result->exitCode() . PHP_EOL;
echo "Output: " . $result->output() . PHP_EOL;
echo "ErrorOutput: " . $result->errorOutput() . PHP_EOL;
echo "Failed: " . ($result->failed() ? 'YES' : 'NO') . PHP_EOL;

// Check files
if (File::exists($testOutDir . '/index.html')) {
    echo "index.html: CREATED ✅" . PHP_EOL;
} else {
    echo "index.html: MISSING ❌" . PHP_EOL;
}

// Cleanup
File::deleteDirectory($testOutDir);
if (File::exists($fakePsdPath)) File::delete($fakePsdPath);

echo "=== Test Complete ===" . PHP_EOL;
