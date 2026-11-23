<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PSD2HTML - Premium PSD to HTML/CSS Converter</title>
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Lucide Icons for clean visuals -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <!-- Custom Styling (Aesthetic Dark Theme) -->
    <link rel="stylesheet" href="{{ asset('assets/css/converter.css') }}">
</head>
<body>

    <div class="app-container">
        <!-- Header -->
        <header>
            <div class="logo-container">
                <div class="logo-icon">
                    <i class="converter-detail-1" data-lucide="layers"></i>
                </div>
                <div class="logo-text">PSD<span class="converter-detail-2">2</span>HTML</div>
                <div class="logo-badge">Engine v2.0</div>
            </div>
            <div>
                <a href="#" class="btn-cancel converter-detail-3">
                    <i class="converter-detail-4" data-lucide="help-circle"></i> Help Docs
                </a>
            </div>
        </header>

        <!-- Hero Section -->
        <div class="hero-section">
            <h1 class="hero-title">Convert PSD files to clean HTML/CSS instantly</h1>
            <p class="hero-subtitle">Upload a PSD to export HTML, CSS, local Bootstrap and extracted images. Includes an original-design reference when available. Editable output may differ for unavailable fonts and Photoshop effects.</p>
        </div>

        <!-- Main Workspace -->
        <div class="workspace-card">
            <input type="hidden" id="csrf_token" value="{{ csrf_token() }}">

            <!-- Drag & Drop Uploader -->
            <div class="upload-area" id="drop_zone">
                <div class="upload-icon-container">
                    <i class="converter-detail-5" data-lucide="upload-cloud"></i>
                </div>
                <h3 class="upload-title">Drag & drop your PSD file here</h3>
                <p class="upload-desc">or click below to browse your local computer (Max file size: {{ round($maxUploadBytes / 1048576) }} MB)</p>
                <button type="button" class="upload-btn" onclick="document.getElementById('psd_file_input').click()">
                    <i class="converter-detail-6" data-lucide="file-plus"></i> Browse File
                </button>
                <input type="file" id="psd_file_input" accept=".psd" name="psd_file">
                @if ($freeSpaceBytes < 536870912)
                    <p class="upload-desc converter-detail-7">Low disk space: {{ round($freeSpaceBytes / 1048576) }} MB available. Free space before uploading a large PSD.</p>
                @endif
            </div>

            <div class="converter-detail-8">
                <label class="converter-detail-9">
                    <input type="checkbox" id="use_ai" @checked(config('psd.ai_enabled') && config('services.openrouter.key'))>
                    Refine layout with AI
                </label>
                <p class="upload-desc converter-detail-10">AI refinement sends design text and a preview to your configured provider. Turn it off for local export.</p>
            </div>

            <!-- Selected File Banner -->
            <div class="selected-file-banner" id="file_banner">
                <div class="selected-file-info">
                    <div class="logo-icon converter-detail-11">
                        <i class="converter-detail-6" data-lucide="file-code"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name" id="display_file_name">design_template.psd</div>
                        <div class="file-size" id="display_file_size">24.5 MB</div>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn-cancel" id="btn_reset_upload">Cancel</button>
                    <button class="btn-convert" id="btn_start_convert">
                        <i class="converter-detail-4" data-lucide="zap"></i> Generate Code
                    </button>
                </div>
            </div>

            <!-- Process Status Dashboard -->
            <div class="processing-dashboard" id="dashboard_panel">
                <div class="progress-header">
                    <span class="progress-label" id="dashboard_status">Parsing layers & asset extraction...</span>
                    <span class="progress-percent" id="dashboard_percent">25%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" id="dashboard_progress_fill"></div>
                </div>

                <!-- Step Trackers -->
                <div class="tracker-steps">
                    <div class="step-card" id="step_1">
                        <div class="step-icon-status">
                            <i class="converter-detail-12" data-lucide="upload"></i>
                        </div>
                        <div class="step-title">1. Storing PSD</div>
                        <div class="step-desc">Uploading and validating PSD format.</div>
                    </div>
                    <div class="step-card" id="step_2">
                        <div class="step-icon-status">
                            <i class="converter-detail-12" data-lucide="layout"></i>
                        </div>
                        <div class="step-title">2. Semantic Layout</div>
                        <div class="step-desc">Classifying sections, headings, grids &amp; forms.</div>
                    </div>
                    <div class="step-card" id="step_3">
                        <div class="step-icon-status">
                            <i class="converter-detail-12" data-lucide="image"></i>
                        </div>
                        <div class="step-title">3. Exporting Assets</div>
                        <div class="step-desc">Rendering and saving image layer assets.</div>
                    </div>
                    <div class="step-card" id="step_4">
                        <div class="step-icon-status">
                            <i class="converter-detail-12" data-lucide="archive"></i>
                        </div>
                        <div class="step-title">4. Compiling ZIP</div>
                        <div class="step-desc">Packaging code files &amp; asset folders.</div>
                    </div>
                </div>

                <!-- Console Stream Output -->
                <div class="console-container">
                    <div class="console-header">
                        <div class="console-title-container">
                            <i class="converter-detail-13" data-lucide="terminal"></i>
                            <span>Parser Engine Console Output</span>
                        </div>
                        <div class="converter-detail-14">
                            <div class="console-dot"></div>
                            <div class="console-dot"></div>
                            <div class="console-dot"></div>
                        </div>
                    </div>
                    <div class="console-body" id="console_log_area">
                        <div class="console-line">
                            <span class="console-prompt">$</span>
                            <span class="console-text">Awaiting conversion trigger...</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Success Panel -->
            <div class="success-card" id="success_panel">
                <div class="success-icon-container">
                    <i class="converter-detail-15" data-lucide="check-circle"></i>
                </div>
                <h3 class="success-title">Website Generated Successfully!</h3>
                <p class="success-desc">Your generated HTML, CSS, JavaScript and extracted images are packaged in the archive. Review the conversion log and compare the result with your PSD. Download the ZIP file below.</p>
                <a href="#" class="download-btn" id="btn_download_zip">
                    <i class="converter-detail-16" data-lucide="download"></i> Download Website ZIP
                </a>
            </div>
        </div>

        <!-- Features Grid -->
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon-container">
                    <i class="converter-detail-17" data-lucide="maximize"></i>
                </div>
                <h4 class="feature-title">Responsive Bootstrap Layout</h4>
                <p class="feature-desc">Builds editable sections, containers, rows and columns. Desktop geometry follows the PSD; mobile content reflows.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon-container">
                    <i class="converter-detail-17" data-lucide="image"></i>
                </div>
                <h4 class="feature-title">Automated Asset Export</h4>
                <p class="feature-desc">Extracts raster images and vector shapes directly from the PSD canvas and saves them as web-optimized PNGs.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon-container">
                    <i class="converter-detail-17" data-lucide="type"></i>
                </div>
                <h4 class="feature-title">Layer Typography</h4>
                <p class="feature-desc">Preserves text sizes, mixed colors and font weights. Unavailable fonts use a browser fallback.</p>
            </div>
        </div>

        <!-- Footer -->
        <footer>
            <p>&copy; 2026 PSD2HTML. Core engine built using Node.js & Laravel. All rights reserved.</p>
        </footer>
    </div>

    <!-- Frontend Script Logic -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            window.lucide?.createIcons();

            const dropZone = document.getElementById('drop_zone');
            const fileInput = document.getElementById('psd_file_input');
            const fileBanner = document.getElementById('file_banner');
            const resetBtn = document.getElementById('btn_reset_upload');
            const convertBtn = document.getElementById('btn_start_convert');
            const displayFileName = document.getElementById('display_file_name');
            const displayFileSize = document.getElementById('display_file_size');
            const dashboardPanel = document.getElementById('dashboard_panel');
            const successPanel = document.getElementById('success_panel');
            const downloadZipBtn = document.getElementById('btn_download_zip');
            
            const dashboardStatus = document.getElementById('dashboard_status');
            const dashboardPercent = document.getElementById('dashboard_percent');
            const dashboardProgressFill = document.getElementById('dashboard_progress_fill');
            const consoleLogArea = document.getElementById('console_log_area');
            const csrfToken = document.getElementById('csrf_token').value;

            let selectedFile = null;

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropZone.classList.add('drag-over');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('drag-over');
                }, false);
            });

            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    handleFileSelect(files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (fileInput.files.length > 0) {
                    handleFileSelect(fileInput.files[0]);
                }
            });

            function handleFileSelect(file) {
                const extension = file.name.split('.').pop().toLowerCase();
                if (extension !== 'psd') {
                    alert('Please upload a valid .psd Photoshop file.');
                    return;
                }

                if (file.size > @json($maxUploadBytes)) {
                    alert('This PSD exceeds the server upload limit. Maximum: ' + formatBytes(@json($maxUploadBytes)));
                    return;
                }

                if (file.size + 33554432 > @json($freeSpaceBytes)) {
                    alert('Not enough free disk space to upload and convert this PSD. Free space on the server, then refresh this page.');
                    return;
                }
                selectedFile = file;
                displayFileName.textContent = file.name;
                displayFileSize.textContent = formatBytes(file.size);

                dropZone.style.display = 'none';
                fileBanner.style.display = 'flex';
                dashboardPanel.style.display = 'none';
                successPanel.style.display = 'none';
            }

            function formatBytes(bytes, decimals = 2) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
            }

            resetBtn.addEventListener('click', () => {
                selectedFile = null;
                fileInput.value = '';
                dropZone.style.display = 'block';
                fileBanner.style.display = 'none';
                dashboardPanel.style.display = 'none';
                successPanel.style.display = 'none';
            });

            convertBtn.addEventListener('click', async () => {
                if (!selectedFile || convertBtn.disabled) return;
                convertBtn.disabled = true;
                dashboardStatus.style.color = '';
                dashboardPercent.style.color = '';
                dashboardProgressFill.style.background = '';
                document.querySelectorAll('.step-card').forEach(card => {
                    card.style.borderColor = '';
                    card.style.background = '';
                    const icon = card.querySelector('.step-icon-status');
                    if (icon) { icon.style.color = ''; icon.style.background = ''; icon.textContent = String(Array.from(card.parentNode.children).indexOf(card) + 1); }
                });

                fileBanner.style.display = 'none';
                dashboardPanel.style.display = 'block';
                
                consoleLogArea.innerHTML = '';
                appendConsoleLog('System', 'Initializing file conversion request...');
                appendConsoleLog('Upload', 'Uploading and staging PSD file in storage...');
                
                updateProgress(25, 'Step 1 of 4: Uploading PSD file', 1);

                const formData = new FormData();
                let conversionUrl = @json(route('convert'));
                const chunkBytes = 8 * 1024 * 1024;
                if (selectedFile.size > chunkBytes) {
                    try {
                        const random = new Uint8Array(16);
                        crypto.getRandomValues(random);
                        const uploadId = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
                        const total = Math.ceil(selectedFile.size / chunkBytes);
                        for (let index = 0; index < total; index++) {
                            const part = new FormData();
                            part.append('upload_id', uploadId);
                            part.append('filename', selectedFile.name);
                            part.append('file_size', String(selectedFile.size));
                            part.append('chunk_index', String(index));
                            part.append('chunk', selectedFile.slice(index * chunkBytes, Math.min((index + 1) * chunkBytes, selectedFile.size)), 'chunk.bin');
                            let receipt;
                            for (let attempt = 0; attempt < 2; attempt++) {
                                try {
                                    const response = await fetch(@json(route('upload.chunk')), {method: 'POST', headers: {'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json'}, body: part, signal: AbortSignal.timeout(120000)});
                                    const content = await response.text();
                                    try { receipt = JSON.parse(content); } catch { throw new Error('Upload server returned HTTP ' + response.status + '. Please retry.'); }
                                    if (!response.ok || !receipt.success) throw new Error(receipt.message || 'Upload chunk failed.');
                                    break;
                                } catch (error) { if (attempt === 1) throw error; }
                            }
                            const percentage = Math.round(100 * (index + 1) / total);
                            updateProgress(Math.round(percentage * .35), `Step 1 of 4: Uploading PSD (${percentage}%)`, 1);
                            if (receipt.complete) conversionUrl = receipt.conversion_url;
                        }
                        if (conversionUrl === @json(route('convert'))) throw new Error('Upload did not finish. Please retry.');
                    } catch (error) { handleFail(error.message || 'PSD upload failed.'); return; }
                } else {
                    formData.append('psd_file', selectedFile);
                }
                formData.append('use_ai', document.getElementById('use_ai').checked ? '1' : '0');

                const xhr = new XMLHttpRequest();
                xhr.open('POST', conversionUrl, true);
                xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json');

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        if (selectedFile.size > chunkBytes) return;
                        const scaledProgress = Math.round(percentComplete * 0.35);
                        updateProgress(scaledProgress, `Step 1 of 4: Uploading PSD File (${percentComplete}%)`, 1);
                    }
                };

                xhr.upload.onload = () => updateProgress(40, 'Step 2 of 4: Reading PSD and generating website', 2);
                xhr.onload = () => {
                    convertBtn.disabled = false;
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.success) {
                                updateProgress(85, 'Step 3 of 4: Exporting assets and compiling ZIP', 3);

                                // Stream the engine console logs into the dashboard
                                if (response.logs) {
                                    const logLines = response.logs.split('\n').filter(l => l.trim());
                                    logLines.forEach((line, i) => {
                                        setTimeout(() => {
                                            const src = /\[AI\]/i.test(line) ? 'AI Polish' : 'Parser Engine';
                                            appendConsoleLog(src, line.trim());
                                        }, i * 180);
                                    });
                                }

                                setTimeout(() => {
                                    updateProgress(98, 'Step 4 of 4: Packaging HTML, CSS, and Images into ZIP', 4);
                                    appendConsoleLog('Compiler', 'ZIP archive created and verified.');
                                }, 1200);

                                setTimeout(() => {
                                    updateProgress(100, 'Conversion completed successfully!', 4);
                                    markStepCompleted(4);

                                    successPanel.style.display = 'block';
                                    downloadZipBtn.href = response.download_url;
                                    appendConsoleLog('System', 'All processes finished. ZIP download is ready!');

                                    successPanel.scrollIntoView({ behavior: 'smooth' });
                                }, 2500);
                            } else {
                                handleFail(response.message || 'An error occurred during parsing.');
                            }
                        } catch (err) {
                            handleFail('Failed to read engine output stream.');
                        }
                    } else {
                        try {
                            const errResp = JSON.parse(xhr.responseText);
                            if (errResp.logs) {
                                errResp.logs.split('\n').forEach((line, i) => {
                                    if (line.trim()) setTimeout(() => appendConsoleLog('Engine', line.trim()), i * 150);
                                });
                            }
                            if (errResp.error) {
                                appendConsoleLog('System Error', errResp.error);
                            }
                            handleFail(errResp.message || 'An error occurred on the server.');
                        } catch (e) {
                            handleFail('Conversion server returned HTTP ' + xhr.status + '. The server could not complete the request. Please retry the upload; if it persists, check the server log.');
                        }
                    }
                };

                xhr.timeout = 600000;
                xhr.ontimeout = () => handleFail('Conversion timed out. Try a smaller PSD or retry.');
                xhr.onerror = () => {
                    handleFail('Network connection failed or upload aborted.');
                };

                xhr.send(formData);
            });

            function updateProgress(percent, label, activeStepIndex) {
                dashboardPercent.textContent = percent + '%';
                dashboardProgressFill.style.width = percent + '%';
                dashboardStatus.textContent = label;

                for (let i = 1; i <= 4; i++) {
                    const stepCard = document.getElementById(`step_${i}`);
                    if (i < activeStepIndex) {
                        stepCard.classList.remove('active');
                        stepCard.classList.add('completed');
                    } else if (i === activeStepIndex) {
                        stepCard.classList.remove('completed');
                        stepCard.classList.add('active');
                    } else {
                        stepCard.classList.remove('active', 'completed');
                    }
                }
            }

            function markStepCompleted(stepIndex) {
                for (let i = 1; i <= stepIndex; i++) {
                    const stepCard = document.getElementById(`step_${i}`);
                    stepCard.classList.remove('active');
                    stepCard.classList.add('completed');
                }
            }

            function appendConsoleLog(source, text) {
                const line = document.createElement('div');
                line.className = 'console-line';
                
                const prompt = document.createElement('span');
                prompt.className = 'console-prompt';
                prompt.textContent = `[${source}] >`;
                
                const txt = document.createElement('span');
                txt.className = 'console-text';
                txt.textContent = text;
                
                line.appendChild(prompt);
                line.appendChild(txt);
                consoleLogArea.appendChild(line);
                consoleLogArea.scrollTop = consoleLogArea.scrollHeight;
            }

            function handleFail(errorText) {
                convertBtn.disabled = false;
                appendConsoleLog('Error', errorText);
                dashboardStatus.textContent = 'Conversion failed.';
                dashboardStatus.style.color = 'var(--danger)';
                dashboardPercent.textContent = 'ERROR';
                dashboardPercent.style.color = 'var(--danger)';
                dashboardProgressFill.style.background = 'var(--danger)';
                
                const activeCard = document.querySelector('.step-card.active');
                if (activeCard) {
                    activeCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    activeCard.style.background = 'rgba(239, 68, 68, 0.05)';
                    const statusIcon = activeCard.querySelector('.step-icon-status');
                    statusIcon.innerHTML = '<i class="converter-detail-18" data-lucide="x-circle"></i>';
                    statusIcon.style.color = 'var(--danger)';
                    statusIcon.style.background = 'rgba(239, 68, 68, 0.15)';
                    window.lucide?.createIcons();
                }
                
                fileBanner.style.display = 'flex';
                alert('Conversion failed: ' + errorText);
            }
        });
    </script>
</body>
</html>