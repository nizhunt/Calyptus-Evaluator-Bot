/**
 * Screen Recorder SDK Entry Point
 * Embeddable SDK for host websites to integrate screen recording
 */
import { CanvasCompositor } from './compositor';
import { MediaRecorderManager } from './recorder';
import { UploadManager } from './uploader';
import { upload } from '@vercel/blob/client';
import { DEFAULT_AUDIO_CHUNK_MIME_TYPE, OPENAI_TRANSCRIPTION_MAX_BYTES, getSupportedAudioChunkMimeType, } from './audio-chunks';
const FULL_AUDIO_BITS_PER_SECOND = 48000;
export class ScreenRecorder {
    constructor(options) {
        this.state = 'idle';
        this.recordingId = null;
        this.compositor = null;
        this.recorder = null;
        this.uploader = null;
        this.screenStream = null;
        this.webcamStream = null;
        this.audioStream = null;
        this.transcriptionAudioStream = null;
        this.backupTranscriptionAudioStream = null;
        this.compositeStream = null;
        this.backupAudioChunkRecorder = null;
        this.audioChunkMimeType = DEFAULT_AUDIO_CHUNK_MIME_TYPE;
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.backupAudioChunkBlobs = [];
        this.preferredBackupAudioUrl = null;
        this.audioChunkStopRequested = false;
        this.audioChunkUploadContext = null;
        this.overlayRoot = null;
        this.timerLabel = null;
        this.webcamBubble = null;
        this.handleWindowResize = null;
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.isSessionOpen = false;
        this.ignoreRecorderStop = false;
        const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const resolvedApiBaseUrl = options.apiBaseUrl || runtimeOrigin;
        this.options = {
            maxDuration: 7200,
            autoStopEnabled: true,
            ...options,
            apiBaseUrl: resolvedApiBaseUrl,
        };
    }
    /**
     * Open recorder flow and start capture directly on host page
     */
    open() {
        if (this.isSessionOpen) {
            return;
        }
        this.isSessionOpen = true;
        void this.startCaptureFlow();
    }
    /**
     * Manually stop active recording
     */
    stop() {
        if (this.state !== 'recording') {
            return;
        }
        this.ignoreRecorderStop = false;
        this.updateState('stopping');
        this.stopTimer();
        this.recorder?.stop();
    }
    /**
     * Close recorder and clean up resources
     */
    close() {
        this.ignoreRecorderStop = true;
        this.uploader?.abort();
        this.stopAudioChunkRecorder();
        this.stopTimer();
        this.stopAllTracks();
        this.removeOverlayUI();
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
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Get current recording ID
     */
    getRecordingId() {
        return this.recordingId;
    }
    /**
     * Update callbacks
     */
    setCallbacks(callbacks) {
        Object.assign(this.options, callbacks);
    }
    /**
     * Destroy the SDK instance
     */
    destroy() {
        this.close();
    }
    serializeError(error) {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        return { value: String(error) };
    }
    logTrace(event, details = {}) {
        console.log('[ScreenRecorder:TRACE]', {
            event,
            recordingId: this.recordingId,
            state: this.state,
            ...details,
        });
    }
    logTraceError(event, error, details = {}) {
        console.error('[ScreenRecorder:TRACE]', {
            event,
            recordingId: this.recordingId,
            state: this.state,
            ...details,
            error: this.serializeError(error),
        });
    }
    async startCaptureFlow() {
        try {
            const apiBaseUrl = this.getApiBaseUrl();
            this.logTrace('capture:start', { apiBaseUrl });
            this.updateState('selecting_sources');
            const initRes = await fetch(`${apiBaseUrl}/api/recordings/init`, {
                method: 'POST',
                headers: this.buildAuthHeaders(),
            });
            if (!initRes.ok) {
                throw new Error(`Failed to initialize recording (${initRes.status})`);
            }
            const initJson = (await initRes.json());
            if (!initJson.recordingId) {
                throw new Error('Recording initialization did not return a recording ID');
            }
            this.recordingId = initJson.recordingId;
            this.logTrace('capture:init_success');
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            const screenTrack = this.screenStream.getVideoTracks()[0];
            if (!screenTrack) {
                throw new Error('No screen video track available');
            }
            this.logTrace('capture:screen_stream_ready', {
                screenTrackSettings: screenTrack.getSettings(),
            });
            screenTrack.onended = () => {
                this.logTrace('capture:screen_track_ended');
                this.stop();
            };
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            this.logTrace('capture:audio_stream_ready', {
                audioTrackSettings: this.audioStream.getAudioTracks()[0]?.getSettings() ?? null,
            });
            await this.startAudioChunkRecorder(this.audioStream, {
                apiBaseUrl,
                recordingId: this.recordingId,
            });
            try {
                this.webcamStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                });
            }
            catch (webcamError) {
                console.warn('[ScreenRecorder] Webcam unavailable, continuing without webcam', webcamError);
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
                if (this.ignoreRecorderStop) {
                    this.ignoreRecorderStop = false;
                    return;
                }
                await this.handleRecordingStopped(apiBaseUrl);
            };
            this.recorder.start(5000);
            this.startTimer();
            this.updateState('recording');
            this.logTrace('capture:recording_started');
        }
        catch (error) {
            this.logTraceError('capture:start_failed', error);
            this.handleError({
                recordingId: this.recordingId ?? undefined,
                stage: 'permission',
                code: 'START_FAILED',
                message: error instanceof Error ? error.message : 'Failed to start recording',
            });
            this.close();
        }
    }
    async handleRecordingStopped(apiBaseUrl) {
        const currentRecordingId = this.recordingId;
        this.logTrace('recording:stop_handler_entered', { currentRecordingId });
        try {
            if (!this.recorder) {
                throw new Error('Recorder not initialized');
            }
            if (!currentRecordingId) {
                throw new Error('Missing recording ID');
            }
            const blob = this.recorder.createFinalBlob();
            const mimeType = this.recorder.getMimeType();
            this.logTrace('recording:video_blob_ready', {
                mimeType,
                videoBytes: blob.size,
            });
            const audioChunkUrls = await this.stopAndCollectAudioChunks();
            this.logTrace('audio_chunks:collected_for_transcription', {
                count: audioChunkUrls.length,
                sample: audioChunkUrls.slice(0, 3),
            });
            this.stopAllTracks();
            this.removeOverlayUI();
            this.compositor?.destroy();
            this.compositor = null;
            this.updateState('uploading');
            this.uploader = new UploadManager(currentRecordingId, `${apiBaseUrl}/api/blob/upload`, this.buildAuthHeaders());
            this.uploader.onProgress = (progress) => {
                this.options.onUploadProgress?.(progress);
            };
            this.logTrace('upload:video_start', {
                mimeType,
                videoBytes: blob.size,
            });
            const uploadResult = await this.uploader.uploadWithRetry(blob, mimeType);
            this.logTrace('upload:video_complete', {
                videoUrl: uploadResult.url,
            });
            const exceedsDirectLimit = blob.size > OPENAI_TRANSCRIPTION_MAX_BYTES;
            const backupAudioUrl = audioChunkUrls[0];
            this.logTrace('transcription:preflight', {
                videoBytes: blob.size,
                directLimitBytes: OPENAI_TRANSCRIPTION_MAX_BYTES,
                exceedsDirectLimit,
                audioChunkUrlsCount: audioChunkUrls.length,
                hasBackupAudioUrl: Boolean(backupAudioUrl),
                shouldBlockForMissingBackupAudio: exceedsDirectLimit && !backupAudioUrl,
            });
            if (blob.size > OPENAI_TRANSCRIPTION_MAX_BYTES && !backupAudioUrl) {
                throw new Error('No uploaded transcription audio was available for this large recording. Please retry and keep microphone access enabled.');
            }
            this.updateState('transcribing');
            this.logTrace('transcription:request_start', {
                blobUrl: uploadResult.url,
                audioChunkUrlsCount: audioChunkUrls.length,
                hasBackupAudioUrl: Boolean(backupAudioUrl),
            });
            const transcriptionRes = await fetch(`${apiBaseUrl}/api/recordings/${currentRecordingId}/transcription`, {
                method: 'POST',
                headers: this.buildAuthHeaders({ withJsonContentType: true }),
                body: JSON.stringify({
                    blobUrl: uploadResult.url,
                    audioChunkUrls,
                    backupAudioUrl,
                }),
            });
            if (!transcriptionRes.ok) {
                this.logTrace('transcription:request_failed', {
                    status: transcriptionRes.status,
                });
                throw new Error(`Failed to start transcription (${transcriptionRes.status})`);
            }
            this.logTrace('transcription:request_accepted');
            const pollStartedAt = Date.now();
            const maxPollMs = 15 * 60 * 1000;
            let transcriptText = '';
            let resolvedPlaybackUrl = uploadResult.url;
            let transcriptResolved = false;
            while (Date.now() - pollStartedAt < maxPollMs) {
                const statusRes = await fetch(`${apiBaseUrl}/api/recordings/${currentRecordingId}`, {
                    headers: this.buildAuthHeaders(),
                    cache: 'no-store',
                });
                if (!statusRes.ok) {
                    throw new Error(`Failed to fetch recording status (${statusRes.status})`);
                }
                const statusData = (await statusRes.json());
                if (statusData.status === 'transcript_ready') {
                    transcriptText = statusData.transcriptText || '';
                    resolvedPlaybackUrl = statusData.blobUrl || uploadResult.url;
                    transcriptResolved = true;
                    this.logTrace('transcription:ready', {
                        transcriptChars: transcriptText.length,
                    });
                    break;
                }
                if (statusData.status === 'error') {
                    this.logTrace('transcription:status_error', {
                        errorMessage: statusData.errorMessage || '',
                    });
                    throw new Error(statusData.errorMessage || 'Transcription failed');
                }
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            if (!transcriptResolved) {
                throw new Error('Transcription timed out');
            }
            this.options.onTranscriptReady?.({
                recordingId: currentRecordingId,
                transcriptText,
            });
            this.updateState('video_ready');
            this.options.onVideoReady?.({
                recordingId: currentRecordingId,
                playbackUrl: resolvedPlaybackUrl,
            });
            this.recorder?.destroy();
            this.recorder = null;
            this.uploader = null;
            this.isSessionOpen = false;
            this.options.onClose?.();
            this.logTrace('recording:flow_complete');
        }
        catch (error) {
            this.logTraceError('recording:flow_failed', error, { currentRecordingId });
            this.handleError({
                recordingId: currentRecordingId ?? undefined,
                stage: this.state === 'transcribing' ? 'transcription' : 'upload',
                code: this.state === 'transcribing' ? 'TRANSCRIPTION_FAILED' : 'UPLOAD_FAILED',
                message: error instanceof Error ? error.message : 'Failed while processing recording',
            });
            this.close();
        }
    }
    async startAudioChunkRecorder(audioStream, context) {
        const chunkMimeType = getSupportedAudioChunkMimeType() || DEFAULT_AUDIO_CHUNK_MIME_TYPE;
        this.logTrace('audio_full:start', {
            chunkMimeType,
            audioBitsPerSecond: FULL_AUDIO_BITS_PER_SECOND,
            audioTrackCount: audioStream.getAudioTracks().length,
        });
        this.transcriptionAudioStream = null;
        this.audioChunkUploadContext = context;
        this.audioChunkStopRequested = false;
        this.audioChunkMimeType = chunkMimeType;
        this.backupAudioChunkRecorder = null;
        this.backupAudioChunkBlobs = [];
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.preferredBackupAudioUrl = null;
        const backupTracks = audioStream.getAudioTracks().map((track) => track.clone());
        this.backupTranscriptionAudioStream = new MediaStream(backupTracks);
        try {
            const mediaRecorderOptions = {
                audioBitsPerSecond: FULL_AUDIO_BITS_PER_SECOND,
            };
            if (chunkMimeType && MediaRecorder.isTypeSupported(chunkMimeType)) {
                mediaRecorderOptions.mimeType = chunkMimeType;
            }
            const backupRecorder = new MediaRecorder(this.backupTranscriptionAudioStream, mediaRecorderOptions);
            backupRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.backupAudioChunkBlobs.push(event.data);
                    this.logTrace('audio_chunks:backup_blob', {
                        blobBytes: event.data.size,
                        blobType: event.data.type || this.audioChunkMimeType,
                        backupBlobCount: this.backupAudioChunkBlobs.length,
                    });
                }
                else {
                    this.logTrace('audio_chunks:backup_blob_empty');
                }
            };
            backupRecorder.onstop = () => {
                this.logTrace('audio_chunks:backup_stopped', {
                    backupBlobCount: this.backupAudioChunkBlobs.length,
                });
                this.resolveBackupAudioChunkStop?.();
                this.resolveBackupAudioChunkStop = null;
            };
            backupRecorder.onerror = (event) => {
                const message = event.message || 'Backup audio recorder error';
                console.warn('[ScreenRecorder] Backup audio recorder error:', message);
            };
            this.backupAudioChunkStopPromise = new Promise((resolve) => {
                this.resolveBackupAudioChunkStop = resolve;
            });
            backupRecorder.start();
            this.backupAudioChunkRecorder = backupRecorder;
            this.logTrace('audio_full:recorder_started');
        }
        catch (error) {
            this.logTraceError('audio_full:start_failed', error);
            this.backupTranscriptionAudioStream?.getTracks().forEach((track) => track.stop());
            this.backupTranscriptionAudioStream = null;
        }
    }
    stopAudioChunkRecorder() {
        if (this.audioChunkStopRequested) {
            return;
        }
        if (!this.backupAudioChunkRecorder) {
            return;
        }
        this.logTrace('audio_full:stop_requested', {
            hasBackupRecorder: Boolean(this.backupAudioChunkRecorder),
        });
        this.audioChunkStopRequested = true;
        if (this.backupAudioChunkRecorder && this.backupAudioChunkRecorder.state !== 'inactive') {
            try {
                this.backupAudioChunkRecorder.requestData();
            }
            catch {
                // no-op
            }
            this.backupAudioChunkRecorder.stop();
            this.logTrace('audio_full:stop_signal_sent');
        }
        else {
            this.resolveBackupAudioChunkStop?.();
            this.resolveBackupAudioChunkStop = null;
        }
    }
    async stopAndCollectAudioChunks() {
        this.logTrace('audio_full:collect_start', {
            hasUploadContext: Boolean(this.audioChunkUploadContext),
            hasBackupRecorder: Boolean(this.backupAudioChunkRecorder),
            backupBlobCount: this.backupAudioChunkBlobs.length,
        });
        this.stopAudioChunkRecorder();
        try {
            if (this.backupAudioChunkStopPromise) {
                const backupTimeoutPromise = new Promise((resolve) => {
                    setTimeout(resolve, 15000);
                });
                await Promise.race([this.backupAudioChunkStopPromise, backupTimeoutPromise]);
                this.logTrace('audio_full:stop_wait_done', {
                    backupBlobCount: this.backupAudioChunkBlobs.length,
                });
            }
            if (!this.audioChunkUploadContext) {
                this.logTrace('audio_full:no_upload_context');
                return [];
            }
            if (this.backupAudioChunkBlobs.length === 0) {
                this.logTrace('audio_full:no_audio_blob');
                return [];
            }
            const fullAudioBlob = new Blob(this.backupAudioChunkBlobs, {
                type: this.backupAudioChunkBlobs[0]?.type || this.audioChunkMimeType || DEFAULT_AUDIO_CHUNK_MIME_TYPE,
            });
            if (fullAudioBlob.size <= 0) {
                this.logTrace('audio_full:empty_audio_blob');
                return [];
            }
            this.logTrace('audio_full:blob_ready', {
                audioBytes: fullAudioBlob.size,
                audioMimeType: fullAudioBlob.type,
                audioBitsPerSecond: FULL_AUDIO_BITS_PER_SECOND,
            });
            if (fullAudioBlob.size > OPENAI_TRANSCRIPTION_MAX_BYTES) {
                throw new Error(`Audio track is too large for transcription (${Math.ceil(fullAudioBlob.size / (1024 * 1024))}MB > 25MB). Record a shorter session.`);
            }
            const { recordingId, apiBaseUrl } = this.audioChunkUploadContext;
            this.logTrace('audio_full:upload_start', {
                audioBytes: fullAudioBlob.size,
            });
            const uploadResult = await upload(`recording_${recordingId}_audio_full.webm`, fullAudioBlob, {
                access: 'public',
                handleUploadUrl: `${apiBaseUrl}/api/blob/upload`,
                clientPayload: JSON.stringify({
                    recordingId,
                    asset: 'audio-backup',
                }),
                headers: this.buildAuthHeaders(),
                contentType: fullAudioBlob.type || this.audioChunkMimeType || DEFAULT_AUDIO_CHUNK_MIME_TYPE,
            });
            this.preferredBackupAudioUrl = uploadResult.url;
            this.logTrace('audio_full:upload_success', {
                url: uploadResult.url,
            });
            return [uploadResult.url];
        }
        finally {
            this.resetAudioChunkRecorderState();
        }
    }
    resetAudioChunkRecorderState() {
        this.logTrace('audio_full:reset_state', {
            backupBlobCount: this.backupAudioChunkBlobs.length,
            hasPreferredBackupAudioUrl: Boolean(this.preferredBackupAudioUrl),
        });
        this.backupAudioChunkRecorder = null;
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.backupAudioChunkBlobs = [];
        this.preferredBackupAudioUrl = null;
        this.audioChunkStopRequested = false;
        this.audioChunkUploadContext = null;
        this.backupTranscriptionAudioStream?.getTracks().forEach((track) => track.stop());
        this.backupTranscriptionAudioStream = null;
        this.transcriptionAudioStream = null;
    }
    getApiBaseUrl() {
        if (this.options.apiBaseUrl) {
            return this.options.apiBaseUrl;
        }
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }
        throw new Error('apiBaseUrl is required when window is unavailable');
    }
    buildAuthHeaders(options = {}) {
        const headers = {};
        if (options.withJsonContentType) {
            headers['Content-Type'] = 'application/json';
        }
        if (this.options.apiKey) {
            headers['X-Screen-Recorder-Key'] = this.options.apiKey;
        }
        return headers;
    }
    updateState(nextState) {
        this.state = nextState;
        this.options.onLifecycleUpdate?.(nextState);
    }
    handleError(error) {
        this.logTrace('error:emitted', error);
        this.state = 'error';
        this.options.onError?.(error);
    }
    mountOverlayUI() {
        const root = document.createElement('div');
        root.id = 'screen-recorder-runtime-overlay';
        root.style.cssText = [
            'position: fixed',
            'inset: 0',
            'z-index: 2147483646',
            'pointer-events: none',
        ].join(';');
        const controls = document.createElement('div');
        controls.style.cssText = [
            'position: fixed',
            'left: 50%',
            'bottom: 24px',
            'transform: translateX(-50%)',
            'display: flex',
            'align-items: center',
            'gap: 12px',
            'padding: 10px 14px',
            'border-radius: 999px',
            'background: rgba(15, 23, 42, 0.78)',
            'box-shadow: 0 10px 35px rgba(0, 0, 0, 0.35)',
            'backdrop-filter: blur(8px)',
            'pointer-events: auto',
        ].join(';');
        const timer = document.createElement('span');
        timer.style.cssText = [
            'font: 600 14px system-ui, -apple-system, Segoe UI, sans-serif',
            'color: #f8fafc',
            'min-width: 52px',
            'text-align: center',
        ].join(';');
        timer.textContent = '00:00';
        const stopButton = document.createElement('button');
        stopButton.type = 'button';
        stopButton.textContent = 'Stop Recording';
        stopButton.style.cssText = [
            'border: 0',
            'border-radius: 999px',
            'padding: 10px 14px',
            'font: 600 13px system-ui, -apple-system, Segoe UI, sans-serif',
            'color: #fff',
            'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            'cursor: pointer',
        ].join(';');
        stopButton.addEventListener('click', () => this.stop());
        controls.appendChild(timer);
        controls.appendChild(stopButton);
        root.appendChild(controls);
        if (this.webcamStream && this.compositor) {
            const pip = this.compositor.getPIPPosition();
            const bubble = document.createElement('div');
            bubble.style.cssText = [
                'position: fixed',
                `width: ${Math.round(pip.width)}px`,
                `height: ${Math.round(pip.height)}px`,
                'left: 0',
                'top: 0',
                'border-radius: 12px',
                'overflow: hidden',
                'box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45)',
                'border: 2px solid rgba(255, 255, 255, 0.9)',
                'box-sizing: border-box',
                'cursor: move',
                'pointer-events: auto',
                'user-select: none',
            ].join(';');
            const video = document.createElement('video');
            video.srcObject = this.webcamStream;
            video.muted = true;
            video.playsInline = true;
            video.autoplay = true;
            video.style.cssText = [
                'width: 100%',
                'height: 100%',
                'object-fit: cover',
            ].join(';');
            bubble.appendChild(video);
            root.appendChild(bubble);
            this.attachBubbleDragHandlers(bubble);
            this.webcamBubble = bubble;
            this.syncBubbleToCompositor();
            this.syncCompositorPipToBubble();
            this.handleWindowResize = () => {
                this.syncBubbleToCompositor();
            };
            window.addEventListener('resize', this.handleWindowResize);
        }
        document.body.appendChild(root);
        this.overlayRoot = root;
        this.timerLabel = timer;
    }
    attachBubbleDragHandlers(element) {
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;
        const onMouseMove = (event) => {
            if (!dragging) {
                return;
            }
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            const nextLeft = Math.min(Math.max(0, event.clientX - offsetX), window.innerWidth - width);
            const nextTop = Math.min(Math.max(0, event.clientY - offsetY), window.innerHeight - height);
            element.style.left = `${nextLeft}px`;
            element.style.top = `${nextTop}px`;
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
        if (!this.compositor || !this.webcamBubble) {
            return;
        }
        const bubbleRect = this.webcamBubble.getBoundingClientRect();
        const canvas = this.compositor.getCanvasSize();
        const x = (bubbleRect.left / Math.max(window.innerWidth, 1)) * canvas.width;
        const y = (bubbleRect.top / Math.max(window.innerHeight, 1)) * canvas.height;
        const width = (bubbleRect.width / Math.max(window.innerWidth, 1)) * canvas.width;
        const height = (bubbleRect.height / Math.max(window.innerHeight, 1)) * canvas.height;
        this.compositor.setPIPRect(x, y, width, height);
    }
    syncBubbleToCompositor() {
        if (!this.compositor || !this.webcamBubble) {
            return;
        }
        const pip = this.compositor.getPIPPosition();
        const canvas = this.compositor.getCanvasSize();
        const widthRatio = window.innerWidth / Math.max(canvas.width, 1);
        const heightRatio = window.innerHeight / Math.max(canvas.height, 1);
        this.webcamBubble.style.left = `${Math.round(pip.x * widthRatio)}px`;
        this.webcamBubble.style.top = `${Math.round(pip.y * heightRatio)}px`;
        this.webcamBubble.style.width = `${Math.round(pip.width * widthRatio)}px`;
        this.webcamBubble.style.height = `${Math.round(pip.height * heightRatio)}px`;
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
        if (!this.timerLabel) {
            return;
        }
        const mins = Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        this.timerLabel.textContent = `${mins}:${secs}`;
    }
    stopAllTracks() {
        const stopTracks = (stream) => {
            stream?.getTracks().forEach((track) => track.stop());
        };
        stopTracks(this.screenStream);
        stopTracks(this.webcamStream);
        stopTracks(this.audioStream);
        stopTracks(this.transcriptionAudioStream);
        stopTracks(this.backupTranscriptionAudioStream);
        stopTracks(this.compositeStream);
        this.screenStream = null;
        this.webcamStream = null;
        this.audioStream = null;
        this.transcriptionAudioStream = null;
        this.backupTranscriptionAudioStream = null;
        this.compositeStream = null;
    }
}
// Export types and classesexport { CanvasCompositor } from './compositor';
export { MediaRecorderManager } from './recorder';
export { UploadManager } from './uploader';
