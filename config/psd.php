<?php

return [
    'node' => env('PSD_NODE_BINARY', 'node'),
    'work_dir' => env('PSD_WORK_DIR', storage_path('app/temp')),
    'max_upload_bytes' => 1073741824,
    'min_free_bytes' => 32 * 1024 * 1024,
    'ai_enabled' => env('PSD_AI_ENABLED', true),
    'ai_vision' => env('PSD_AI_VISION', true),
    'ai_max_tokens' => (int) env('PSD_AI_MAX_TOKENS', 16000),
    'ai_timeout' => (int) env('PSD_AI_TIMEOUT', 180),
];
