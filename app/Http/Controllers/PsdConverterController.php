<?php

namespace App\Http\Controllers;

use App\Services\PsdWebsiteGenerator;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class PsdConverterController extends Controller
{
    public function index()
    {
        $bytes = static function (string $value): int {
            $value = trim($value);
            $power = array_search(strtolower(substr($value, -1)), ['k', 'm', 'g']);

            return (int) ((float) $value * ($power === false ? 1 : 1024 ** ($power + 1)));
        };
        $upload = $bytes(ini_get('upload_max_filesize'));
        $post = $bytes(ini_get('post_max_size'));
        $maxUploadBytes = min(config('psd.max_upload_bytes'), $upload > 0 ? $upload : PHP_INT_MAX, $post > 0 ? max(0, $post - 65536) : PHP_INT_MAX);
        $workDir = config('psd.work_dir');
        File::ensureDirectoryExists($workDir);
        $freeSpaceBytes = min(disk_free_space($workDir), disk_free_space(ini_get('upload_tmp_dir') ?: sys_get_temp_dir()));

        return view('welcome', compact('maxUploadBytes', 'freeSpaceBytes'));
    }

    public function convert(Request $request)
    {
        $input = $request->file('psd_file');
        if ($input && !($input instanceof UploadedFile)) {
            return response()->json(['success' => false, 'message' => 'Upload one PSD file at a time.'], 422);
        }
        if ($input && !$input->isValid()) {
            $sizeError = in_array($input->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE]);
            if (in_array($input->getError(), [UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_NO_TMP_DIR])) {
                return response()->json(['success' => false, 'message' => 'Server cannot store the PSD upload. Free disk space and check the PHP upload temporary directory.'], 507);
            }

            return response()->json(['success' => false, 'message' => $sizeError
                ? 'PSD exceeds the PHP upload limit. Restart PHP using start-converter.ps1 or increase upload_max_filesize and post_max_size.'
                : 'PSD upload failed. Please select the file and upload again.'], $sizeError ? 413 : 422);
        }
        if (!$input) {
            return response()->json(['success' => false, 'message' => 'Please select a PSD file to upload.'], 422);
        }
        if ($input->getSize() > config('psd.max_upload_bytes')) {
            return response()->json(['success' => false, 'message' => 'Maximum PSD size is 1 GB.'], 413);
        }
        if (strtolower($input->getClientOriginalExtension()) !== 'psd') {
            return response()->json(['success' => false, 'message' => 'Only .psd files are supported.'], 422);
        }
        $header = fopen($input->getRealPath(), 'rb');
        $signature = fread($header, 6);
        fclose($header);
        if ($signature !== "8BPS\0\x01") {
            return response()->json(['success' => false, 'message' => 'Invalid PSD file. Export a standard PSD from Photoshop.'], 422);
        }

        $id = bin2hex(random_bytes(16));
        $base = config('psd.work_dir');
        $output = $base . '/output_' . $id;
        $source = $base . '/uploaded_' . $id . '.psd';
        $zipPath = $base . '/website_' . $id . '.zip';
        $stage = 'preparing output';
        try {
            set_time_limit(600);
            File::ensureDirectoryExists($base);
            if (disk_free_space($base) < config('psd.min_free_bytes')) {
                return response()->json(['success' => false, 'message' => 'Insufficient free disk space for conversion. Free space on the conversion drive or configure PSD_WORK_DIR on a drive with room.'], 507);
            }
            File::ensureDirectoryExists($output);
            $input->move($base, basename($source));
            $stage = 'extracting PSD layers';
            $node = config('psd.node', 'node');
            $process = new Process([$node, base_path('psd_to_json.cjs'), $source, $output], base_path(), null, null, 300);
            $process->mustRun();
            $metadata = json_decode(File::get($output . '/layers.json'), true, 512, JSON_THROW_ON_ERROR);
            $stage = 'generating website';
            File::ensureDirectoryExists($output . '/assets/css');
            File::ensureDirectoryExists($output . '/assets/js');
            $result = app(PsdWebsiteGenerator::class)->generate($metadata, $output, $request->boolean('use_ai', config('psd.ai_enabled')));
            File::put($output . '/index.html', $result['html']);
            File::put($output . '/assets/css/style.css', $result['css']);
            File::put($output . '/assets/js/main.js', $result['js'] ?? '');
            File::copy(base_path('node_modules/bootstrap/dist/css/bootstrap.min.css'), $output . '/assets/css/bootstrap.min.css');
            File::copy(base_path('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js'), $output . '/assets/js/bootstrap.bundle.min.js');
            if (!empty($metadata['compositePath'])) {
                File::put($output . '/reference.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Original PSD reference</title></head><body style="margin:0"><img src="assets/images/original-design.png" alt="Original PSD reference" style="display:block;width:100%;height:auto"></body></html>');
            }
            File::put($output . '/README.txt', $result['message'] . "\nOpen index.html to view the generated website and reference.html to compare the Photoshop composite. Forms require a submission endpoint to send messages.\n");
            File::delete($output . '/layers.json');
            $stage = 'packaging ZIP';
            if (class_exists(\ZipArchive::class)) {
                $zip = new \ZipArchive;
                if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
                    throw new \RuntimeException('Cannot create ZIP archive.');
                }
                foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($output, \FilesystemIterator::SKIP_DOTS)) as $file) {
                    if ($file->isFile()) {
                        $zip->addFile($file->getPathname(), str_replace('\\', '/', substr($file->getPathname(), strlen($output) + 1)));
                    }
                }
                if (!$zip->close()) {
                    throw new \RuntimeException('ZIP packaging failed.');
                }
            } elseif (PHP_OS_FAMILY === 'Windows') {
                $quote = fn($value) => "'" . str_replace("'", "''", $value) . "'";
                // Single quoted PHP literal keeps the PowerShell variable intact.
                $script = "\$ErrorActionPreference = 'Stop'; Compress-Archive -Path " . $quote($output . '/*') . ' -DestinationPath ' . $quote($zipPath) . ' -Force';
                (new Process(['powershell', '-NoProfile', '-NonInteractive', '-Command', $script], base_path(), null, null, 120))->mustRun();
            } else {
                throw new \RuntimeException('Install PHP ZIP extension.');
            }
            if (!is_file($zipPath) || filesize($zipPath) === 0) {
                throw new \RuntimeException('ZIP packaging failed.');
            }

            return response()->json(['success' => true, 'message' => 'Website generated.', 'logs' => $result['message'], 'download_url' => route('download', ['filename' => basename($zipPath)])]);
        } catch (\Throwable $error) {
            File::delete($zipPath);
            Log::error('PSD conversion failed', ['stage' => $stage, 'type' => get_class($error), 'detail' => $error->getMessage()]);

            return response()->json(['success' => false, 'message' => 'Conversion failed while ' . $stage . '. Check free disk space, Node.js and the PSD format; details are in the server log.'], 500);
        } finally {
            File::delete($source);
            if (File::isDirectory($output)) {
                File::deleteDirectory($output);
            }
        }
    }

    public function download($filename)
    {
        abort_unless(preg_match('/^website_[a-f0-9]{32}\.zip$/', $filename), 404);
        $path = rtrim(config('psd.work_dir'), '/\\') . DIRECTORY_SEPARATOR . $filename;
        abort_unless(is_file($path), 404);

        return response()->download($path)->deleteFileAfterSend(true);
    }
}
