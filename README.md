# PSD converter

Requirements: PHP 8.2+, Composer dependencies, Node.js with npm dependencies, and PHP ZIP extension or Windows PowerShell Compress-Archive.

Start from the project terminal:

```powershell
.\start-converter.ps1
```

The launcher reuses the existing Laragon converter at http://localhost/psd_creater/public/ when available. Otherwise it starts http://127.0.0.1:8000 with 1 GB PHP upload limits. Use `-Standalone -Port 8088` to select a separate server. For Laragon/FastCGI, public/.user.ini supplies equivalent limits; restart PHP after configuration changes. Apache module configurations may require equivalent settings in their active php.ini. Web server request limits can also constrain uploads. The upload page displays the active limit and warns when disk space is low.

Each conversion reads the uploaded PSD's visible layers, groups, text runs and image assets. The local exporter creates Bootstrap sections, containers, rows and columns, with natural content flow inside semantic Bootstrap columns and a mobile reflow below 768px. The exporter no longer positions each PSD layer in a page-wide coordinate grid. All generated declarations are collected in assets/css/style.css; index.html has no style attributes or embedded style blocks. Editable mixed-color text, solid vector shapes, common form controls and question/answer pairs are supported. Simple layer masks and clipping bases are applied to exported raster layers. ZIPs contain local Bootstrap CSS/JS, custom CSS/JS, extracted assets, a conversion README, and reference.html with the saved Photoshop composite when available. Generated website JavaScript does not send contact messages; connect an endpoint to enable delivery.

Use the upload page's "Refine layout with AI" switch to choose AI or local export for each PSD. AI uses OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_ENDPOINT and PSD_AI_ENABLED in .env. Keys stay server-side. The default model is openrouter/free, which routes requests to available free models; rate limits and model capabilities still apply. PSD layer metadata is sent to the configured provider when AI is enabled. With PSD_AI_VISION=true, a reduced-size design preview is also sent. Set PSD_AI_ENABLED=false for local conversion only. Provider errors, malformed responses, omitted PSD copy, missing assets, screenshot-based pages or invalid JavaScript cause a local Bootstrap fallback, reported in the conversion log. Other services' credentials are not interchangeable with OpenRouter keys.

Automatic PSD interpretation cannot guarantee exact visual matching for arbitrary designs. Unavailable fonts, unusual masks, blending effects and ambiguous grouping may need refinement. Flattened PSDs export their saved composite; editable headings require text layers. Empty groups are ignored. The older semantic_engine.cjs uses fixed templates and is not called by the web converter.

Storage defaults to storage/app/temp. To use a drive with more free space, set PSD_WORK_DIR to an existing writable directory on that drive and configure PHP's upload_tmp_dir there as well. Change these paths only to storage you control, then restart PHP. Uploads need disk space for the PSD, extracted assets and ZIP. The controller removes staged PSDs and extraction directories on completion or failure. Successful ZIP downloads are deleted after sending.

Diagnostics and verification:

```powershell
php artisan psd:doctor
php artisan psd:doctor --ai
php vendor/phpunit/phpunit/phpunit
node --test tests/psd_parser.test.js tests/psd_layout.test.js tests/psd_extraction.test.js
node tests/http_smoke.cjs http://localhost/psd_creater/public/
php test_controller.php sample_test.psd
```

The HTTP smoke test submits only a generated synthetic PSD, verifies CSRF upload validation, generates a website through the running server, downloads its ZIP and inspects the contents. If AI is enabled, this synthetic fixture may be processed by the configured provider. The CLI test preserves its source using a hard link when supported, avoiding a duplicate large PSD on a nearly full disk. Add --ai only when you intend to send that PSD's metadata and optional preview to your configured provider.

OpenRouter documentation: [API](https://openrouter.ai/docs/api/reference/overview), [free model router](https://openrouter.ai/docs/guides/routing/routers/free-router).

Large browser uploads use sequential 8 MB chunks, validated and assembled on the conversion drive before extraction. This avoids a single large FastCGI request being buffered on C drive. Chunk IDs are bound to the browser session, out-of-order/incomplete chunks are rejected, and a duplicate retry is not appended twice. Completed upload staging folders are deleted after conversion. Interrupted staging folders can be removed from the configured temporary directory when no upload is active.

Large local regression check (synthetic PSD with padding, not a complex 1 GB Photoshop design):

```powershell
node tests/large_upload_smoke.cjs D:\psd_creater-temp\conversions --chunked --size-mb=1024
```

The direct non-chunked mode is retained to diagnose legacy FastCGI buffering failures. Normal browser uploads above 8 MB automatically use the chunked path.

PSD document backgrounds preserve texture blend modes and opacity in a background-only asset, without rasterizing page content. Available open-license Cinzel Decorative, Playfair Display, Libre Baskerville, Manrope, Cabin and Great Vibes fonts are packaged locally with their SIL license files. Local system fonts such as Garamond remain local font references. Unsupported custom signature lettering can use the saved PSD lettering artwork with semantic accessible text. Overset Photoshop text is clipped to the visible paragraph line count instead of overlapping the following content. Font sources and licenses: https://github.com/google/fonts
