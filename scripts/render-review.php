<?php

use App\Services\PsdWebsiteGenerator;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\File;

require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$dir = $argv[1] ?? throw new RuntimeException('Output directory required');
$doc = json_decode(file_get_contents($dir.'/layers.json'), true, 512, JSON_THROW_ON_ERROR);
File::ensureDirectoryExists($dir.'/assets/css');
File::ensureDirectoryExists($dir.'/assets/js');
$result = app(PsdWebsiteGenerator::class)->generate($doc, $dir, false);
file_put_contents($dir.'/index.html', $result['html']);
file_put_contents($dir.'/assets/css/style.css', $result['css']);
file_put_contents($dir.'/assets/js/main.js', $result['js']);
copy(dirname(__DIR__).'/node_modules/bootstrap/dist/css/bootstrap.min.css', $dir.'/assets/css/bootstrap.min.css');
copy(dirname(__DIR__).'/node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', $dir.'/assets/js/bootstrap.bundle.min.js');
echo json_encode(['html_bytes' => strlen($result['html']), 'status' => $result['message']]),PHP_EOL;
