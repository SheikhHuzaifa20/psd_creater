<?php

namespace Tests\Feature;

use App\Http\Controllers\PsdConverterController;
use App\Services\PsdWebsiteGenerator;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PsdConversionTest extends TestCase
{
    public function test_failed_upload_reports_size_error_instead_of_missing_file(): void
    {
        $file = new UploadedFile(__FILE__, 'design.psd', null, UPLOAD_ERR_INI_SIZE, true);
        $request = Request::create('/convert', 'POST');
        $request->files->set('psd_file', $file);
        $response = app(PsdConverterController::class)->convert($request);
        $this->assertSame(413, $response->getStatusCode());
        $this->assertStringContainsString('upload limit', $response->getData()->message);
    }

    public function test_failed_disk_upload_reports_storage_problem(): void
    {
        $request = Request::create('/convert', 'POST');
        $request->files->set('psd_file', new UploadedFile(__FILE__, 'design.psd', null, UPLOAD_ERR_CANT_WRITE, true));
        $this->assertSame(507, app(PsdConverterController::class)->convert($request)->getStatusCode());
    }

    public function test_multiple_files_are_rejected(): void
    {
        $this->postJson('http://localhost/convert', ['psd_file' => [UploadedFile::fake()->createWithContent('bad.psd', 'invalid')]])->assertStatus(422);
    }

    public function test_get_is_not_a_conversion(): void
    {
        $this->getJson('http://localhost/convert')->assertStatus(405);
    }

    public function test_ai_accepts_complete_psd_copy_and_falls_back_on_canned_content(): void
    {
        config(['psd.ai_enabled' => true, 'services.openrouter.key' => 'test-only']);
        $document = ['width' => 1200, 'height' => 600, 'layers' => [['name' => 'Heading', 'type' => 'text', 'text' => 'Mountain Travel', 'textStyle' => ['fontSize' => 48]]]];
        $generator = app(PsdWebsiteGenerator::class);
        $local = $generator->render($document);
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => json_encode($local)], 'finish_reason' => 'stop']]])]);
        $this->assertStringContainsString('[AI] Generated', $generator->generate($document, storage_path('app/temp'))['message']);
        $local['html'] = str_replace('Mountain Travel', 'Book Editing', $local['html']);
        Http::swap(new Factory);
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => json_encode($local)]]]])]);
        $result = $generator->generate($document, storage_path('app/temp'));
        $this->assertStringContainsString('Mountain Travel', $result['html']);
        $this->assertStringContainsString('output incomplete', $result['message']);
    }

    public function test_local_export_choice_does_not_send_the_document_to_ai(): void
    {
        config(['psd.ai_enabled' => true, 'services.openrouter.key' => 'test-only']);
        Http::fake();
        $document = ['width' => 800, 'height' => 600, 'layers' => [['type' => 'text', 'name' => 'Heading', 'text' => 'Local only', 'textStyle' => ['fontSize' => 48]]]];
        $result = app(PsdWebsiteGenerator::class)->generate($document, storage_path('app/temp'), false);
        $this->assertStringContainsString('Local only', $result['html']);
        Http::assertNothingSent();
    }

    public function test_missing_upload_is_reported(): void
    {
        $this->postJson('http://localhost/convert')->assertStatus(422)->assertJsonPath('success', false);
    }

    public function test_invalid_file_is_rejected(): void
    {
        $this->postJson('http://localhost/convert', ['psd_file' => UploadedFile::fake()->createWithContent('bad.psd', 'not a PSD')])->assertStatus(422);
    }

    public function test_different_psds_export_their_own_text_and_complete_assets_even_when_ai_fails(): void
    {
        config(['psd.ai_enabled' => true, 'services.openrouter.key' => 'test-only']);
        Http::fake(['*' => Http::response(['error' => 'Unavailable'], 503)]);
        $outputs = [];
        foreach (['Mountain Travel', 'Dental Care'] as $title) {
            $path = tempnam(sys_get_temp_dir(), 'psd');
            try {
                (new Process(['node', base_path('tests/make_fixture.cjs'), $path, $title], base_path()))->mustRun();
                $file = new UploadedFile($path, 'design.psd', 'image/vnd.adobe.photoshop', null, true);
                $response = $this->postJson('http://localhost/convert', ['psd_file' => $file]);
                $response->assertOk()->assertJsonPath('success', true);
                $zip = storage_path('app/temp/'.basename($response->json('download_url')));
                $this->assertFileExists($zip);
                try {
                    $script = 'Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($args[0]); try { $reader = [IO.StreamReader]::new($zip.GetEntry("index.html").Open()); $html = $reader.ReadToEnd(); $reader.Dispose(); @{html=$html; entries=@($zip.Entries.FullName)} | ConvertTo-Json -Compress } finally { $zip.Dispose() }';
                    // Pass path through a quoted literal to PowerShell; all path data is generated locally.
                    $script = str_replace('$args[0]', "'".str_replace("'", "''", $zip)."'", $script);
                    $process = new Process(['powershell', '-NoProfile', '-NonInteractive', '-Command', $script]);
                    $process->mustRun();
                    $result = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
                    $this->assertStringContainsString($title, $result['html']);
                    $this->assertStringNotContainsString('Book Editing', $result['html']);
                    $this->assertStringContainsString('<section', $result['html']);
                    $this->assertStringContainsString('class="container"', $result['html']);
                    foreach (['index.html', 'assets/css/style.css', 'assets/css/bootstrap.min.css', 'assets/js/main.js', 'assets/js/bootstrap.bundle.min.js'] as $entry) {
                        $this->assertContains($entry, array_map(fn ($name) => str_replace('\\', '/', $name), $result['entries']));
                    }
                    $outputs[] = $result['html'];
                } finally {
                    @unlink($zip);
                }
            } finally {
                @unlink($path);
            }
        }
        $this->assertNotSame($outputs[0], $outputs[1]);
        Http::assertSentCount(2);
    }
}
