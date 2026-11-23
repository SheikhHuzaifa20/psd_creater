<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('psd:doctor {--ai : Verify the configured AI connection} {--model= : Override model for this check}', function () {
    $root = config('psd.work_dir');
    File::ensureDirectoryExists($root);
    $this->line('PHP: '.PHP_VERSION);
    $this->line('Upload limit: '.ini_get('upload_max_filesize').'; POST limit: '.ini_get('post_max_size'));
    $this->line('ZIP: '.(class_exists(ZipArchive::class) ? 'PHP extension' : (PHP_OS_FAMILY === 'Windows' ? 'PowerShell fallback' : 'MISSING')));
    $this->line('Working disk free: '.round(disk_free_space($root) / 1048576).' MB');
    $this->line('AI key configured: '.(config('services.openrouter.key') ? 'yes' : 'no'));
    $this->line('AI model: '.config('services.openrouter.model'));
    try {
        $process = new Process([config('psd.node'), '--version']);
        $process->mustRun();
        $this->line('Node: '.trim($process->getOutput()));
    } catch (Throwable $error) {
        $this->error('Node.js is unavailable.');

        return 1;
    }
    if (! $this->option('ai')) {
        return 0;
    }
    try {
        $response = Http::withToken(config('services.openrouter.key'))
            ->connectTimeout(15)->timeout(45)->post(config('services.openrouter.endpoint'), [
                'model' => $this->option('model') ?: config('services.openrouter.model'),
                'messages' => [['role' => 'user', 'content' => 'Reply with {"ok":true} as JSON.']],
                'max_tokens' => 128,
                'response_format' => ['type' => 'json_object'],
            ]);
        $this->line('AI HTTP status: '.$response->status());
        if ($response->successful() && is_string($response->json('choices.0.message.content'))) {
            $this->info('AI connection verified.');

            return 0;
        }
        $messages = [401 => 'AI key is invalid or expired.', 402 => 'AI account needs credits.', 404 => 'Configured AI model is unavailable.', 429 => 'AI provider rate limit reached. Local export remains available.'];
        $this->error($messages[$response->status()] ?? 'AI rejected the request. Check model availability and JSON-mode support.');
    } catch (Throwable $error) {
        $this->error('AI connection failed. Check network access and endpoint.');
    }

    return 1;
})->purpose('Check PSD converter requirements without displaying credentials');
