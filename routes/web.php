<?php

use App\Http\Controllers\PsdConverterController;
use App\Http\Controllers\PsdUploadController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PsdConverterController::class, 'index'])->name('index');
Route::post('/convert', [PsdConverterController::class, 'convert'])->name('convert');
Route::get('/download/{filename}', [PsdConverterController::class, 'download'])->name('download');

Route::post('/upload-chunk', [PsdUploadController::class, 'store'])->name('upload.chunk');
Route::post('/convert-upload/{uploadId}', [PsdUploadController::class, 'convert'])->where('uploadId', '[a-f0-9]{32}')->name('convert.upload');
