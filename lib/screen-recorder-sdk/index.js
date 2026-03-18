/**
 * Screen Recorder SDK — In-house entry point.
 * All API calls target the host app's own routes (same-origin, no auth needed).
 */
import { CanvasCompositor } from './compositor';
import { MediaRecorderManager } from './recorder';
import { UploadManager } from './uploader';
import {
    DEFAULT_AUDIO_CHUNK_MIME_TYPE,
    OPENAI_TRANSCRIPTION_MAX_BYTES,
    VIDEO_TIMESLICE_MS,
    AUDIO_COLLECTION_TIMEOUT_MS,
    getSupportedAudioChunkMimeType,
} from './audio-chunks';

const FULL_AUDIO_BITS_PER_SECOND = 48000;

export class ScreenRecorder {
    constructor(options = {}) {
        this.state = 'idle';
        this.recordingId = null;
        this.compositor = null;
        this.recorder = null;
        this.uploader = null;
        this.screenStream = null;
        this.webcamStream = null;
        this.audioStream = null;
        this.backupTranscriptionAudioStream = null;
        this.compositeStream = null;
        this.backupAudioChunkRecorder = null;
        this.audioChunkMimeType = DEFAULT_AUDIO_CHUNK_MIME_TYPE;
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;

        // Incremental audio chunk upload state
        this.uploadedAudioChunkUrls = [];
        this.audioChunkIndex = 0;
        this.audioChunkUploadPromises = [];
        this.audioChunkUploader = null;

        this.audioChunkStopRequested = false;
        this.audioChunkUploadContext = null;
        this.overlayRoot = null;
        this.timerLabel = null;
        this.webcamBubble = null;
        this.handleWindowResize = null;
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.isSessionOpen = false;
        this.closing = false;

        // Timer-based duration tracking
        this.recordingStartTime = 0;
        this.recordingEndTime = 0;

        // beforeunload handler reference
        this._beforeUnloadHandler = null;

        this.options = {
            maxDuration: 7200,
            autoStopEnabled: true,
            ...options,
        };
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    open() {
        if (this.isSessionOpen) return;
        this.isSessionOpen = true;
        void this.startCaptureFlow();
    }

    stop() {
        if (this.state !== 'recording') return;
        this.closing = false;
        this.recordingEndTime = Date.now();
        this.updateState('stopping');
        this.stopTimer();
        this.recorder?.stop();
    }

    close() {
        this.closing = true;
        this.uploader?.abort();
        this.stopAudioChunkRecorder();
        this.stopTimer();
        this.stopAllTracks();
        this.removeOverlayUI();
        this.removeBeforeUnloadWarning();
        this.compositor?.destroy();
        this.compositor = null;
        this.recorder?.destroy();
        this.recorder = null;
        this.resetAudioChunkRecorderState();
        this.uploader = null;
        this.isSessionOpen = false;
        if (this.state !== 'idle' && this.state !== 'error') {
            this.updateState('idle');
        }
        this.options.onClose?.();
    }

    getState() { return this.state; }
    getRecordingId() { return this.recordingId; }
    setCallbacks(callbacks) { Object.assign(this.options, callbacks); }
    destroy() { this.close(); }

    // -----------------------------------------------------------------------
    // Capture flow
    // -----------------------------------------------------------------------

    async startCaptureFlow() {
        try {
            this.updateState('selecting_sources');

            const initRes = await fetch('/api/recordings/init', { method: 'POST' });
            if (!initRes.ok) {
                const error = new Error(`Failed to initialize recording (${initRes.status})`);
                error.stage = 'init';
                error.code = 'INIT_FAILED';
                throw error;
            }
            const initJson = await initRes.json();
            if (!initJson.recordingId) {
                const error = new Error('Recording initialization did not return a recording ID');
                error.stage = 'init';
                error.code = 'INIT_FAILED';
                throw error;
            }
            this.recordingId = initJson.recordingId;

            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            const screenTrack = this.screenStream.getVideoTracks()[0];
            if (!screenTrack) throw new Error('No screen video track available');
            screenTrack.onended = () => this.stop();

            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            await this.startAudioChunkRecorder(this.audioStream, {
                recordingId: this.recordingId,
            });

            try {
                this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch {
                this.webcamStream = null;
            }

            this.compositor = new CanvasCompositor(this.screenStream, this.webcamStream ?? undefined);
            await this.compositor.init();
            this.compositor.start();
            this.mountOverlayUI();

            const videoTracks = this.compositor.getStream(30).getVideoTracks();
            const audioTracks = this.audioStream.getAudioTracks();
            this.compositeStream = new MediaStream([...videoTracks, ...audioTracks]);

            this.recorder = new MediaRecorderManager();
            this.recorder.init(this.compositeStream);
            this.recorder.onError = (error) => {
                this.handleError({
                    recordingId: this.recordingId ?? undefined,
                    stage: 'recording',
                    code: 'RECORDING_FAILED',
                    message: error.message,
                });
            };
            this.recorder.onStop = async () => {
                if (this.closing) return;
                await this.handleRecordingStopped();
            };

            this.recorder.start(VIDEO_TIMESLICE_MS);
            this.recordingStartTime = Date.now();
            this.startTimer();
            this.updateState('recording');
        } catch (error) {
            const stage = typeof error?.stage === 'string' ? error.stage : 'permission';
            const code = typeof error?.code === 'string' ? error.code : 'START_FAILED';
            this.handleError({
                recordingId: this.recordingId ?? undefined,
                stage,
                code,
                message: error instanceof Error ? error.message : 'Failed to start recording',
            });
            this.close();
        }
    }

    // -----------------------------------------------------------------------
    // Post-recording: upload + transcription
    // -----------------------------------------------------------------------

    async handleRecordingStopped() {
        const currentRecordingId = this.recordingId;
        try {
            if (!this.recorder) throw new Error('Recorder not initialized');
            if (!currentRecordingId) throw new Error('Missing recording ID');

            // 1. Create final video blob + measure duration
            const blob = this.recorder.createFinalBlob();
            const mimeType = this.recorder.getMimeType();
            const recordingDurationSeconds = await this.computeDuration(blob);

            // Stop audio recorder (triggers final chunk upload)
            this.stopAudioChunkRecorder();

            this.stopAllTracks();
            this.removeOverlayUI();
            this.compositor?.destroy();
            this.compositor = null;

            // 2. Upload video
            this.updateState('uploading');
            this.addBeforeUnloadWarning();

            this.uploader = new UploadManager(currentRecordingId, '/api/blob/upload');
            this.uploader.onProgress = (progress) => {
                this.options.onUploadProgress?.(progress);
            };

            const uploadResult = await this.uploader.uploadWithRetry(blob, mimeType);

            // 3. Fire onVideoReady immediately after video upload
            this.updateState('video_ready');
            this.options.onVideoReady?.({
                recordingId: currentRecordingId,
                playbackUrl: uploadResult.url,
                durationSeconds: recordingDurationSeconds,
            });

            this.recorder?.destroy();
            this.recorder = null;
            this.uploader = null;

            // 4. Wait for remaining in-flight audio chunk uploads
            const audioChunkUrls = await this.collectUploadedAudioChunks();

            this.removeBeforeUnloadWarning();
            this.isSessionOpen = false;
            this.options.onClose?.();

            const exceedsDirectLimit = blob.size > OPENAI_TRANSCRIPTION_MAX_BYTES;
            if (exceedsDirectLimit && audioChunkUrls.length === 0) {
                console.warn('[ScreenRecorder] No uploaded audio chunks available for large recording — transcription may fail');
            }

            // 5. Fire transcription in background
            void this.runTranscriptionInBackground({
                recordingId: currentRecordingId,
                blobUrl: uploadResult.url,
                audioChunkUrls,
            });
        } catch (error) {
            this.removeBeforeUnloadWarning();
            this.handleError({
                recordingId: currentRecordingId ?? undefined,
                stage: this.state === 'transcribing' ? 'transcription' : 'upload',
                code: this.state === 'transcribing' ? 'TRANSCRIPTION_FAILED' : 'UPLOAD_FAILED',
                message: error instanceof Error ? error.message : 'Failed while processing recording',
            });
            this.close();
        }
    }

    /**
     * Compute recording duration, preferring blob metadata measurement and
     * falling back to timer-based duration.
     */
    async computeDuration(blob) {
        // Timer-based duration (fallback)
        const timerDurationSeconds = this.recordingEndTime > 0 && this.recordingStartTime > 0
            ? (this.recordingEndTime - this.recordingStartTime) / 1000
            : 0;

        // Blob-based duration (primary)
        const measuredDurationSeconds = await this.measureBlobDurationSeconds(blob);

        if (measuredDurationSeconds > 0 && Number.isFinite(measuredDurationSeconds)) {
            return measuredDurationSeconds;
        }

        if (timerDurationSeconds > 0) {
            console.warn('[ScreenRecorder] Blob duration measurement returned invalid value, falling back to timer-based duration:', timerDurationSeconds.toFixed(1), 's');
            return timerDurationSeconds;
        }

        // Last resort: recorder's elapsed time
        const fallbackDurationSeconds = this.recorder?.getElapsedTime() ?? 0;
        if (fallbackDurationSeconds > 0) {
            console.warn('[ScreenRecorder] Using recorder elapsed time as duration fallback:', fallbackDurationSeconds, 's');
        }
        return fallbackDurationSeconds;
    }

    async runTranscriptionInBackground({ recordingId, blobUrl, audioChunkUrls }) {
        try {
            const transcriptionRes = await fetch(`/api/recordings/${recordingId}/transcription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blobUrl, audioChunkUrls }),
            });

            if (!transcriptionRes.ok) return;

            const pollStartedAt = Date.now();
            const maxPollMs = 15 * 60 * 1000;

            while (Date.now() - pollStartedAt < maxPollMs) {
                const statusRes = await fetch(`/api/recordings/${recordingId}`, {
                    cache: 'no-store',
                });
                if (!statusRes.ok) {
                    throw new Error(`Failed to fetch recording status (${statusRes.status})`);
                }

                const statusData = await statusRes.json();

                if (statusData.status === 'transcript_ready') {
                    this.options.onTranscriptReady?.({
                        recordingId,
                        transcriptText: statusData.transcriptText || '',
                    });
                    return;
                }
                if (statusData.status === 'error') return;

                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error('[ScreenRecorder] transcription polling failed:', error);
        }
    }

    // -----------------------------------------------------------------------
    // Backup audio recording (for transcription) — incremental chunk upload
    // -----------------------------------------------------------------------

    async startAudioChunkRecorder(audioStream, context) {
        const chunkMimeType = getSupportedAudioChunkMimeType() || DEFAULT_AUDIO_CHUNK_MIME_TYPE;

        this.audioChunkUploadContext = context;
        this.audioChunkStopRequested = false;
        this.audioChunkMimeType = chunkMimeType;
        this.backupAudioChunkRecorder = null;
        this.uploadedAudioChunkUrls = [];
        this.audioChunkIndex = 0;
        this.audioChunkUploadPromises = [];
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;

        // Create a dedicated uploader for audio chunks
        this.audioChunkUploader = new UploadManager(context.recordingId, '/api/blob/upload');

        const backupTracks = audioStream.getAudioTracks().map((track) => track.clone());
        this.backupTranscriptionAudioStream = new MediaStream(backupTracks);

        try {
            const mediaRecorderOptions = { audioBitsPerSecond: FULL_AUDIO_BITS_PER_SECOND };
            if (chunkMimeType && MediaRecorder.isTypeSupported(chunkMimeType)) {
                mediaRecorderOptions.mimeType = chunkMimeType;
            }

            const backupRecorder = new MediaRecorder(this.backupTranscriptionAudioStream, mediaRecorderOptions);

            backupRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.uploadAudioChunkImmediately(event.data);
                }
            };
            backupRecorder.onstop = () => {
                this.resolveBackupAudioChunkStop?.();
                this.resolveBackupAudioChunkStop = null;
            };
            backupRecorder.onerror = (event) => {
                console.warn('[ScreenRecorder] Backup audio recorder error:', event.message || 'Unknown');
            };

            this.backupAudioChunkStopPromise = new Promise((resolve) => {
                this.resolveBackupAudioChunkStop = resolve;
            });
            backupRecorder.start();
            this.backupAudioChunkRecorder = backupRecorder;
        } catch (error) {
            console.warn('[ScreenRecorder] Failed to start backup audio recorder:', error);
            this.backupTranscriptionAudioStream?.getTracks().forEach((track) => track.stop());
            this.backupTranscriptionAudioStream = null;
        }
    }

    /**
     * Upload a single audio chunk immediately (fire-and-forget with tracking).
     */
    uploadAudioChunkImmediately(blob) {
        if (!this.audioChunkUploader || !this.audioChunkUploadContext) return;

        const chunkIndex = this.audioChunkIndex++;
        const { recordingId } = this.audioChunkUploadContext;

        const uploadPromise = this.audioChunkUploader.uploadAudioChunk(blob, recordingId, chunkIndex)
            .then((url) => {
                if (url) {
                    this.uploadedAudioChunkUrls.push({ index: chunkIndex, url });
                } else {
                    console.warn(`[ScreenRecorder] Audio chunk ${chunkIndex} upload returned null — chunk lost`);
                }
            })
            .catch((error) => {
                console.warn(`[ScreenRecorder] Audio chunk ${chunkIndex} upload error:`, error);
            });

        this.audioChunkUploadPromises.push(uploadPromise);
    }

    stopAudioChunkRecorder() {
        if (this.audioChunkStopRequested) return;
        if (!this.backupAudioChunkRecorder) return;

        this.audioChunkStopRequested = true;

        if (this.backupAudioChunkRecorder.state !== 'inactive') {
            try { this.backupAudioChunkRecorder.requestData(); } catch { /* no-op */ }
            this.backupAudioChunkRecorder.stop();
        } else {
            this.resolveBackupAudioChunkStop?.();
            this.resolveBackupAudioChunkStop = null;
        }
    }

    /**
     * Wait for the backup recorder to stop, then wait for all in-flight
     * chunk uploads to finish (with timeout). Returns sorted URLs.
     */
    async collectUploadedAudioChunks() {
        try {
            // Wait for the recorder's onstop to fire
            if (this.backupAudioChunkStopPromise) {
                let timedOut = false;
                await Promise.race([
                    this.backupAudioChunkStopPromise,
                    new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(); }, AUDIO_COLLECTION_TIMEOUT_MS)),
                ]);
                if (timedOut) {
                    console.warn(`[ScreenRecorder] Audio chunk recorder stop timed out after ${AUDIO_COLLECTION_TIMEOUT_MS / 1000}s`);
                }
            }

            // Wait for all in-flight chunk uploads to settle
            if (this.audioChunkUploadPromises.length > 0) {
                let timedOut = false;
                await Promise.race([
                    Promise.allSettled(this.audioChunkUploadPromises),
                    new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(); }, AUDIO_COLLECTION_TIMEOUT_MS)),
                ]);
                if (timedOut) {
                    console.warn(`[ScreenRecorder] In-flight audio chunk uploads timed out after ${AUDIO_COLLECTION_TIMEOUT_MS / 1000}s`);
                }
            }

            // Sort by chunk index to maintain order and extract URLs
            const sortedUrls = this.uploadedAudioChunkUrls
                .sort((a, b) => a.index - b.index)
                .map((entry) => entry.url);

            return sortedUrls;
        } finally {
            this.resetAudioChunkRecorderState();
        }
    }

    resetAudioChunkRecorderState() {
        this.backupAudioChunkRecorder = null;
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.uploadedAudioChunkUrls = [];
        this.audioChunkIndex = 0;
        this.audioChunkUploadPromises = [];
        this.audioChunkUploader = null;

        this.audioChunkStopRequested = false;
        this.audioChunkUploadContext = null;
        this.backupTranscriptionAudioStream?.getTracks().forEach((track) => track.stop());
        this.backupTranscriptionAudioStream = null;
    }

    // -----------------------------------------------------------------------
    // beforeunload warning
    // -----------------------------------------------------------------------

    addBeforeUnloadWarning() {
        if (this._beforeUnloadHandler) return;
        this._beforeUnloadHandler = (e) => {
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    }

    removeBeforeUnloadWarning() {
        if (!this._beforeUnloadHandler) return;
        window.removeEventListener('beforeunload', this._beforeUnloadHandler);
        this._beforeUnloadHandler = null;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    updateState(nextState) {
        this.state = nextState;
        this.options.onLifecycleUpdate?.(nextState);
    }

    handleError(error) {
        this.state = 'error';
        this.options.onError?.(error);
    }

    async measureBlobDurationSeconds(blob) {
        if (!blob || blob.size <= 0) return 0;
        const objectUrl = URL.createObjectURL(blob);
        try {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = objectUrl;
            const duration = await new Promise((resolve) => {
                const timeoutId = setTimeout(() => resolve(0), 4000);
                const handleSuccess = () => {
                    clearTimeout(timeoutId);
                    resolve(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
                };
                const handleError = () => {
                    clearTimeout(timeoutId);
                    resolve(0);
                };
                video.addEventListener('loadedmetadata', handleSuccess, { once: true });
                video.addEventListener('error', handleError, { once: true });
            });
            video.src = '';
            return duration;
        } catch {
            return 0;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    // -----------------------------------------------------------------------
    // Overlay UI
    // -----------------------------------------------------------------------

    mountOverlayUI() {
        const root = document.createElement('div');
        root.id = 'screen-recorder-runtime-overlay';
        root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none';

        const controls = document.createElement('div');
        controls.style.cssText = [
            'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
            'display:flex', 'align-items:center', 'gap:12px', 'padding:10px 14px',
            'border-radius:999px', 'background:rgba(15,23,42,0.78)',
            'box-shadow:0 10px 35px rgba(0,0,0,0.35)', 'backdrop-filter:blur(8px)',
            'pointer-events:auto',
        ].join(';');

        const timer = document.createElement('span');
        timer.style.cssText = 'font:600 14px system-ui,-apple-system,sans-serif;color:#f8fafc;min-width:52px;text-align:center';
        timer.textContent = '00:00';

        const stopButton = document.createElement('button');
        stopButton.type = 'button';
        stopButton.textContent = 'Stop Recording';
        stopButton.style.cssText = [
            'border:0', 'border-radius:999px', 'padding:10px 14px',
            'font:600 13px system-ui,-apple-system,sans-serif', 'color:#fff',
            'background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%)', 'cursor:pointer',
        ].join(';');
        stopButton.addEventListener('click', () => this.stop());

        controls.appendChild(timer);
        controls.appendChild(stopButton);
        root.appendChild(controls);

        if (this.webcamStream && this.compositor) {
            const pip = this.compositor.getPIPPosition();
            const bubble = document.createElement('div');
            bubble.style.cssText = [
                'position:fixed',
                `width:${Math.round(pip.width)}px`,
                `height:${Math.round(pip.height)}px`,
                'left:0', 'top:0', 'border-radius:12px', 'overflow:hidden',
                'box-shadow:0 10px 35px rgba(0,0,0,0.45)',
                'border:2px solid rgba(255,255,255,0.9)',
                'box-sizing:border-box', 'cursor:move', 'pointer-events:auto', 'user-select:none',
            ].join(';');

            const video = document.createElement('video');
            video.srcObject = this.webcamStream;
            video.muted = true;
            video.playsInline = true;
            video.autoplay = true;
            video.style.cssText = 'width:100%;height:100%;object-fit:cover';
            bubble.appendChild(video);
            root.appendChild(bubble);
            this.attachBubbleDragHandlers(bubble);
            this.webcamBubble = bubble;
            this.syncBubbleToCompositor();

            this.handleWindowResize = () => this.syncBubbleToCompositor();
            window.addEventListener('resize', this.handleWindowResize);
        }

        document.body.appendChild(root);
        this.overlayRoot = root;
        this.timerLabel = timer;

        if (this.webcamBubble) {
            requestAnimationFrame(() => {
                this.syncCompositorPipToBubble();
                this.syncBubbleToCompositor();
            });
        }
    }

    attachBubbleDragHandlers(element) {
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onMouseMove = (event) => {
            if (!dragging) return;
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            element.style.left = `${Math.min(Math.max(0, event.clientX - offsetX), window.innerWidth - width)}px`;
            element.style.top = `${Math.min(Math.max(0, event.clientY - offsetY), window.innerHeight - height)}px`;
            this.syncCompositorPipToBubble();
        };
        const onMouseUp = () => {
            dragging = false;
            window.removeEventListener('mousemove', onMouseMove, true);
            window.removeEventListener('mouseup', onMouseUp, true);
        };

        element.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const rect = element.getBoundingClientRect();
            dragging = true;
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            window.addEventListener('mousemove', onMouseMove, true);
            window.addEventListener('mouseup', onMouseUp, true);
        });
    }

    syncCompositorPipToBubble() {
        if (!this.compositor || !this.webcamBubble) return;
        const bubbleRect = this.webcamBubble.getBoundingClientRect();
        const canvas = this.compositor.getCanvasSize();
        this.compositor.setPIPRect(
            (bubbleRect.left / Math.max(window.innerWidth, 1)) * canvas.width,
            (bubbleRect.top / Math.max(window.innerHeight, 1)) * canvas.height,
            (bubbleRect.width / Math.max(window.innerWidth, 1)) * canvas.width,
            (bubbleRect.height / Math.max(window.innerHeight, 1)) * canvas.height,
        );
    }

    syncBubbleToCompositor() {
        if (!this.compositor || !this.webcamBubble) return;
        const pip = this.compositor.getPIPPosition();
        const canvas = this.compositor.getCanvasSize();
        const wr = window.innerWidth / Math.max(canvas.width, 1);
        const hr = window.innerHeight / Math.max(canvas.height, 1);
        this.webcamBubble.style.left = `${Math.round(pip.x * wr)}px`;
        this.webcamBubble.style.top = `${Math.round(pip.y * hr)}px`;
        this.webcamBubble.style.width = `${Math.round(pip.width * wr)}px`;
        this.webcamBubble.style.height = `${Math.round(pip.height * hr)}px`;
    }

    removeOverlayUI() {
        if (this.handleWindowResize) {
            window.removeEventListener('resize', this.handleWindowResize);
            this.handleWindowResize = null;
        }
        if (this.overlayRoot) {
            this.overlayRoot.remove();
            this.overlayRoot = null;
        }
        this.timerLabel = null;
        this.webcamBubble = null;
    }

    // -----------------------------------------------------------------------
    // Timer
    // -----------------------------------------------------------------------

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startTimer() {
        this.elapsedSeconds = 0;
        this.updateTimerLabel(0);
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds += 1;
            this.updateTimerLabel(this.elapsedSeconds);
            const maxDuration = this.options.maxDuration ?? 7200;
            const autoStop = this.options.autoStopEnabled ?? true;
            if (autoStop && this.elapsedSeconds >= maxDuration) {
                this.stop();
            }
        }, 1000);
    }

    updateTimerLabel(seconds) {
        if (!this.timerLabel) return;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        this.timerLabel.textContent = `${mins}:${secs}`;
    }

    stopAllTracks() {
        const stopTracks = (stream) => stream?.getTracks().forEach((track) => track.stop());
        stopTracks(this.screenStream);
        stopTracks(this.webcamStream);
        stopTracks(this.audioStream);
        stopTracks(this.backupTranscriptionAudioStream);
        stopTracks(this.compositeStream);
        this.screenStream = null;
        this.webcamStream = null;
        this.audioStream = null;
        this.backupTranscriptionAudioStream = null;
        this.compositeStream = null;
    }
}

export { CanvasCompositor } from './compositor';
export { MediaRecorderManager } from './recorder';
export { UploadManager } from './uploader';
