<?php

namespace App\Http\Controllers;

use App\Services\ChunkedPsdUpload;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class PsdUploadController extends Controller
{
    public function store(Request $request, ChunkedPsdUpload $uploads)
    {
        $data = $request->validate([
            'upload_id' => ['required', 'regex:/^[a-f0-9]{32}$/D'],
            'filename' => ['required', 'string', 'max:255'],
            'file_size' => ['required', 'integer', 'min:6', 'max:1073741824'],
            'chunk_index' => ['required', 'integer', 'min:0'],
        ]);
        $chunk = $request->file('chunk');
        abort_unless($chunk instanceof UploadedFile, 422, 'Upload chunk is missing.');
        $result = $uploads->append($data['upload_id'], $request->session()->getId(), $data['filename'], (int) $data['file_size'], (int) $data['chunk_index'], $chunk);

        return response()->json(['success' => true] + $result + ['conversion_url' => route('convert.upload', ['uploadId' => $data['upload_id']])]);
    }

    public function convert(Request $request, string $uploadId, ChunkedPsdUpload $uploads, PsdConverterController $converter)
    {
        $file = $uploads->consume($uploadId, $request->session()->getId());
        try {
            $request->files->set('psd_file', $file);

            return $converter->convert($request);
        } finally {
            $uploads->discard($uploadId);
        }
    }
}
