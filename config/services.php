<?php

return [
    /*
    |--------------------------------------------------------------------------|
    | Third Party Services                                                     |
    |--------------------------------------------------------------------------|
    | This file is for storing configuration for third party services that
    | your app makes use of. Services such as Mailgun, Postmark, etc.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
        'endpoint' => env('POSTMARK_ENDPOINT', 'https://api.postmarkapp.com'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'sendmail' => env('SENDMAIL_PATH', '/usr/sbin/sendmail -t -i'),

    'log' => env('LOG_CHANNEL', 'stack'),

    'slack' => [
        'webhook_url' => env('SLACK_WEBHOOK_URL'),
    ],

    // Optional full-layout AI generation, with local Bootstrap fallback.
    'openrouter' => [
        'key' => env('OPENROUTER_API_KEY', ''),
        'model' => env('OPENROUTER_MODEL', 'openrouter/free'),
        'endpoint' => env('OPENROUTER_ENDPOINT', 'https://openrouter.ai/api/v1/chat/completions'),
    ],
];
