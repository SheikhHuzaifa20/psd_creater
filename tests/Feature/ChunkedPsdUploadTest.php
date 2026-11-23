<?php

namespace Tests\Feature;

use App\Services\ChunkedPsdUpload;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ChunkedPsdUploadTest extends TestCase
{
    public function test_chunks_reassemble_in_order_and_duplicate_retry_is_idempotent(): void
    {
        $service = app(ChunkedPsdUpload::class);
        $id = bin2hex(random_bytes(16));
        $first = "8BPS\0\1".str_repeat('x', ChunkedPsdUpload::CHUNK_BYTES - 6);
        $size = strlen($first) + 4;
        try {
            $chunk = fn ($data) => UploadedFile::fake()->createWithContent('chunk.bin', $data);
            $result = $service->append($id, 'session-a', 'test.psd', $size, 0, $chunk($first));
            $this->assertFalse($result['complete']);
            $this->assertSame(1, $service->append($id, 'session-a', 'test.psd', $size, 0, $chunk($first))['next']);
            $this->assertTrue($service->append($id, 'session-a', 'test.psd', $size, 1, $chunk('tail'))['complete']);
            $file = $service->consume($id, 'session-a');
            $this->assertSame($size, $file->getSize());
            $this->assertSame(hash('sha256', $first.'tail'), hash_file('sha256', $file->getRealPath()));
            try {
                $service->consume($id, 'session-a');
                $this->fail('Consumed upload was reused.');
            } catch (HttpException $error) {
                $this->assertSame(409, $error->getStatusCode());
            }
        } finally {
            $service->discard($id);
        }
    }

    public function test_other_sessions_cannot_consume_an_upload(): void
    {
        $service = app(ChunkedPsdUpload::class);
        $id = bin2hex(random_bytes(16));
        try {
            $service->append($id, 'session-a', 'test.psd', 6, 0, UploadedFile::fake()->createWithContent('part', "8BPS\0\1"));
            try {
                $service->consume($id, 'session-b');
                $this->fail('Foreign session consumed the upload.');
            } catch (HttpException $error) {
                $this->assertSame(403, $error->getStatusCode());
            }
        } finally {
            $service->discard($id);
        }
    }

    public function test_incomplete_chunk_is_rejected_before_it_is_written(): void
    {
        $this->expectException(HttpException::class);
        app(ChunkedPsdUpload::class)->append(bin2hex(random_bytes(16)), 'session-a', 'test.psd', 100, 0, UploadedFile::fake()->createWithContent('part', "8BPS\0\1"));
    }
}
