<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ChunkedPsdUpload
{
    public const CHUNK_BYTES = 8 * 1024 * 1024;

    private function directory(string $id): string
    {
        abort_unless(preg_match('/^[a-f0-9]{32}$/D', $id), 422, 'Invalid upload identifier.');

        return rtrim(config('psd.work_dir'), '/\\').'/chunks_'.$id;
    }

    public function append(string $id, string $owner, string $filename, int $size, int $index, UploadedFile $chunk): array
    {
        abort_unless($size >= 6 && $size <= config('psd.max_upload_bytes'), 422, 'PSD must be between 6 bytes and 1 GB.');
        abort_unless(strtolower(pathinfo($filename, PATHINFO_EXTENSION)) === 'psd' && strlen($filename) <= 255, 422, 'Select a PSD file.');
        $total = (int) ceil($size / self::CHUNK_BYTES);
        abort_unless($index >= 0 && $index < $total, 422, 'Invalid chunk index.');
        $expected = min(self::CHUNK_BYTES, $size - $index * self::CHUNK_BYTES);
        abort_unless($chunk->isValid() && $chunk->getSize() === $expected, 422, 'Upload chunk is incomplete. Retry the upload.');
        $directory = $this->directory($id);
        if (! is_dir($directory)) {
            abort_unless($index === 0, 409, 'Upload expired. Start again.');
            File::ensureDirectoryExists($directory);
        }
        $lock = fopen($directory.'/upload.lock', 'c+b');
        if (! $lock || ! flock($lock, LOCK_EX)) {
            throw new HttpException(503, 'Upload is busy. Retry.');
        }
        try {
            $metaPath = $directory.'/metadata.json';
            $meta = is_file($metaPath) ? json_decode(File::get($metaPath), true, 512, JSON_THROW_ON_ERROR) : [
                'owner' => hash('sha256', $owner), 'filename' => basename(str_replace('\\', '/', $filename)),
                'size' => $size, 'next' => 0, 'created' => time(), 'consumed' => false,
            ];
            abort_unless(hash_equals($meta['owner'], hash('sha256', $owner)), 403, 'This upload belongs to another session.');
            abort_unless(! $meta['consumed'] && $meta['created'] > time() - 86400, 409, 'Upload expired or already converted.');
            abort_unless($meta['size'] === $size && $meta['filename'] === basename(str_replace('\\', '/', $filename)), 409, 'Upload metadata changed. Start again.');
            $hash = hash_file('sha256', $chunk->getRealPath());
            // A lost response can cause a retry; acknowledge the same chunk without appending twice.
            if ($index === $meta['next'] - 1 && ($meta['last_hash'] ?? null) === $hash) {
                return ['complete' => $meta['next'] === $total, 'next' => $meta['next']];
            }
            abort_unless($index === $meta['next'], 409, 'Chunks arrived out of order. Start again.');
            abort_unless(disk_free_space($directory) > $expected + config('psd.min_free_bytes'), 507, 'Not enough disk space for this upload.');
            $payloadPath = $directory.'/payload.psd';
            if ($index === 0) {
                $header = fopen($chunk->getRealPath(), 'rb');
                try {
                    $signature = fread($header, 6);
                } finally {
                    fclose($header);
                }
                abort_unless($signature === "8BPS\0\1", 422, 'Invalid PSD file.');
            }
            $input = fopen($chunk->getRealPath(), 'rb');
            $output = fopen($payloadPath, 'c+b');
            if (! $input || ! $output) {
                throw new HttpException(507, 'Cannot write the upload to temporary storage.');
            }
            try {
                $offset = $index * self::CHUNK_BYTES;
                // Restore the last committed boundary after an interrupted append.
                ftruncate($output, $offset);
                fseek($output, $offset);
                $written = stream_copy_to_stream($input, $output);
                if ($written !== $expected) {
                    ftruncate($output, $offset);
                    throw new HttpException(507, 'Cannot store the complete upload chunk.');
                }
                fflush($output);
            } finally {
                fclose($input);
                fclose($output);
            }
            $meta['next']++;
            $meta['last_hash'] = $hash;
            File::put($metaPath, json_encode($meta, JSON_THROW_ON_ERROR));

            return ['complete' => $meta['next'] === $total, 'next' => $meta['next']];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function consume(string $id, string $owner): UploadedFile
    {
        $directory = $this->directory($id);
        abort_unless(is_file($directory.'/metadata.json'), 404, 'Upload not found or expired.');
        $lock = fopen($directory.'/upload.lock', 'c+b');
        if (! $lock || ! flock($lock, LOCK_EX)) {
            throw new HttpException(503, 'Upload is busy.');
        }
        try {
            $meta = json_decode(File::get($directory.'/metadata.json'), true, 512, JSON_THROW_ON_ERROR);
            abort_unless(hash_equals($meta['owner'], hash('sha256', $owner)), 403, 'This upload belongs to another session.');
            abort_unless(! $meta['consumed'] && $meta['created'] > time() - 86400, 409, 'Upload expired or already converted.');
            $path = $directory.'/payload.psd';
            abort_unless($meta['next'] === (int) ceil($meta['size'] / self::CHUNK_BYTES) && is_file($path) && filesize($path) === $meta['size'], 409, 'Upload is incomplete.');
            $meta['consumed'] = true;
            File::put($directory.'/metadata.json', json_encode($meta, JSON_THROW_ON_ERROR));

            return new UploadedFile($path, $meta['filename'], 'image/vnd.adobe.photoshop', null, true);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function discard(string $id): void
    {
        $directory = $this->directory($id);
        if (is_dir($directory)) {
            File::deleteDirectory($directory);
        }
    }
}
