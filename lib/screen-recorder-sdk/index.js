/**
 * Screen Recorder SDK Entry Point
 * Embeddable SDK for host websites to integrate screen recording
 */
import { CanvasCompositor } from './compositor';
import { MediaRecorderManager } from './recorder';
import { UploadManager } from './uploader';
import { upload } from '@vercel/blob/client';
import { AUDIO_CHUNK_TIMESLICE_MS, DEFAULT_AUDIO_CHUNK_MIME_TYPE, MAX_AUDIO_CHUNK_BYTES, OPENAI_TRANSCRIPTION_MAX_BYTES, buildAudioChunkFilename, getSupportedAudioChunkMimeType, } from './audio-chunks';
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
        this.audioChunkRecorder = null;
        this.backupAudioChunkRecorder = null;
        this.audioChunkMimeType = DEFAULT_AUDIO_CHUNK_MIME_TYPE;
        this.audioChunkStopPromise = null;
        this.resolveAudioChunkStop = null;
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.backupAudioChunkBlobs = [];
        this.preferredBackupAudioUrl = null;
        this.audioChunkStopRequested = false;
        this.audioChunkUploadContext = null;
        this.audioChunkUploadQueue = [];
        this.audioChunkUploadedUrls = [];
        this.audioChunkUploadInFlight = false;
        this.audioChunkUploadError = null;
        this.audioChunkUploadDrainPromise = null;
        this.resolveAudioChunkUploadDrain = null;
        this.nextAudioChunkIndex = 0;
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
        this.options = Object.assign(Object.assign({ maxDuration: 7200, autoStopEnabled: true }, options), { apiBaseUrl: resolvedApiBaseUrl });
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
        var _a;
        if (this.state !== 'recording') {
            return;
        }
        this.ignoreRecorderStop = false;
        this.updateState('stopping');
        this.stopTimer();
        (_a = this.recorder) === null || _a === void 0 ? void 0 : _a.stop();
    }
    /**
     * Close recorder and clean up resources
     */
    close() {
        var _a, _b, _c, _d, _e;
        this.ignoreRecorderStop = true;
        (_a = this.uploader) === null || _a === void 0 ? void 0 : _a.abort();
        this.stopAudioChunkRecorder();
        this.stopTimer();
        this.stopAllTracks();
        this.removeOverlayUI();
        (_b = this.compositor) === null || _b === void 0 ? void 0 : _b.destroy();
        this.compositor = null;
        (_c = this.recorder) === null || _c === void 0 ? void 0 : _c.destroy();
        this.recorder = null;
        this.resetAudioChunkRecorderState();
        this.uploader = null;
        this.isSessionOpen = false;
        if (this.state !== 'idle' && this.state !== 'error') {
            this.updateState('idle');
        }
        (_e = (_d = this.options).onClose) === null || _e === void 0 ? void 0 : _e.call(_d);
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
        console.log('[ScreenRecorder:TRACE]', Object.assign({ event, recordingId: this.recordingId, state: this.state }, details));
    }
    logTraceError(event, error, details = {}) {
        console.error('[ScreenRecorder:TRACE]', Object.assign(Object.assign({ event, recordingId: this.recordingId, state: this.state }, details), { error: this.serializeError(error) }));
    }
    async startCaptureFlow() {
        var _a, _b, _c, _d;
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
                audioTrackSettings: (_b = (_a = this.audioStream.getAudioTracks()[0]) === null || _a === void 0 ? void 0 : _a.getSettings()) !== null && _b !== void 0 ? _b : null,
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
            this.compositor = new CanvasCompositor(this.screenStream, (_c = this.webcamStream) !== null && _c !== void 0 ? _c : undefined);
            await this.compositor.init();
            this.compositor.start();
            this.mountOverlayUI();
            const videoTracks = this.compositor.getStream(30).getVideoTracks();
            const audioTracks = this.audioStream.getAudioTracks();
            this.compositeStream = new MediaStream([...videoTracks, ...audioTracks]);
            this.recorder = new MediaRecorderManager();
            this.recorder.init(this.compositeStream);
            this.recorder.onError = (error) => {
                var _a;
                this.handleError({
                    recordingId: (_a = this.recordingId) !== null && _a !== void 0 ? _a : undefined,
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
                recordingId: (_d = this.recordingId) !== null && _d !== void 0 ? _d : undefined,
                stage: 'permission',
                code: 'START_FAILED',
                message: error instanceof Error ? error.message : 'Failed to start recording',
            });
            this.close();
        }
    }
    async handleRecordingStopped(apiBaseUrl) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
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
            (_a = this.compositor) === null || _a === void 0 ? void 0 : _a.destroy();
            this.compositor = null;
            this.updateState('uploading');
            this.uploader = new UploadManager(currentRecordingId, `${apiBaseUrl}/api/blob/upload`, this.buildAuthHeaders());
            this.uploader.onProgress = (progress) => {
                var _a, _b;
                (_b = (_a = this.options).onUploadProgress) === null || _b === void 0 ? void 0 : _b.call(_a, progress);
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
            this.logTrace('transcription:preflight', {
                videoBytes: blob.size,
                directLimitBytes: OPENAI_TRANSCRIPTION_MAX_BYTES,
                exceedsDirectLimit,
                audioChunkUrlsCount: audioChunkUrls.length,
                shouldBlockForMissingAudioChunks: exceedsDirectLimit && audioChunkUrls.length === 0,
            });
            if (blob.size > OPENAI_TRANSCRIPTION_MAX_BYTES && audioChunkUrls.length === 0) {
                throw new Error('No uploaded audio chunks were available for this large recording. Please retry and keep microphone access enabled.');
            }
            this.updateState('transcribing');
            this.logTrace('transcription:request_start', {
                blobUrl: uploadResult.url,
                audioChunkUrlsCount: audioChunkUrls.length,
            });
            const transcriptionRes = await fetch(`${apiBaseUrl}/api/recordings/${currentRecordingId}/transcription`, {
                method: 'POST',
                headers: this.buildAuthHeaders({ withJsonContentType: true }),
                body: JSON.stringify({
                    blobUrl: uploadResult.url,
                    audioChunkUrls,
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
            (_c = (_b = this.options).onTranscriptReady) === null || _c === void 0 ? void 0 : _c.call(_b, {
                recordingId: currentRecordingId,
                transcriptText,
            });
            this.updateState('video_ready');
            (_e = (_d = this.options).onVideoReady) === null || _e === void 0 ? void 0 : _e.call(_d, {
                recordingId: currentRecordingId,
                playbackUrl: resolvedPlaybackUrl,
            });
            (_f = this.recorder) === null || _f === void 0 ? void 0 : _f.destroy();
            this.recorder = null;
            this.uploader = null;
            this.isSessionOpen = false;
            (_h = (_g = this.options).onClose) === null || _h === void 0 ? void 0 : _h.call(_g);
            this.logTrace('recording:flow_complete');
        }
        catch (error) {
            this.logTraceError('recording:flow_failed', error, { currentRecordingId });
            this.handleError({
                recordingId: currentRecordingId !== null && currentRecordingId !== void 0 ? currentRecordingId : undefined,
                stage: this.state === 'transcribing' ? 'transcription' : 'upload',
                code: this.state === 'transcribing' ? 'TRANSCRIPTION_FAILED' : 'UPLOAD_FAILED',
                message: error instanceof Error ? error.message : 'Failed while processing recording',
            });
            this.close();
        }
    }
    async startAudioChunkRecorder(audioStream, context) {
        var _a;
        const recordRtcModule = await import('recordrtc');
        const RecordRTC = recordRtcModule.default;
        const { MediaStreamRecorder } = recordRtcModule;
        const chunkMimeType = getSupportedAudioChunkMimeType() || DEFAULT_AUDIO_CHUNK_MIME_TYPE;
        this.logTrace('audio_chunks:start', {
            chunkMimeType,
            timesliceMs: AUDIO_CHUNK_TIMESLICE_MS,
            audioTrackCount: audioStream.getAudioTracks().length,
        });
        const clonedTracks = audioStream.getAudioTracks().map((track) => track.clone());
        this.transcriptionAudioStream = new MediaStream(clonedTracks);
        this.audioChunkUploadContext = context;
        this.audioChunkUploadQueue = [];
        this.audioChunkUploadedUrls = [];
        this.audioChunkUploadInFlight = false;
        this.audioChunkUploadError = null;
        this.audioChunkUploadDrainPromise = null;
        this.resolveAudioChunkUploadDrain = null;
        this.nextAudioChunkIndex = 0;
        this.audioChunkStopRequested = false;
        this.audioChunkMimeType = chunkMimeType;
        this.backupAudioChunkRecorder = null;
        this.backupAudioChunkBlobs = [];
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.preferredBackupAudioUrl = null;
        this.audioChunkRecorder = RecordRTC(this.transcriptionAudioStream, {
            type: 'audio',
            recorderType: MediaStreamRecorder,
            mimeType: chunkMimeType,
            disableLogs: true,
            numberOfAudioChannels: 1,
            audioBitsPerSecond: 64000,
            timeSlice: AUDIO_CHUNK_TIMESLICE_MS,
            ondataavailable: (blob) => {
                if (blob.size > 0) {
                    this.logTrace('audio_chunks:recordrtc_blob', {
                        blobBytes: blob.size,
                        blobType: blob.type || this.audioChunkMimeType,
                    });
                    this.enqueueAudioChunkUpload(blob);
                }
                else {
                    this.logTrace('audio_chunks:recordrtc_blob_empty');
                }
            },
        });
        this.audioChunkStopPromise = new Promise((resolve) => {
            this.resolveAudioChunkStop = resolve;
        });
        this.audioChunkRecorder.startRecording();
        this.logTrace('audio_chunks:recordrtc_started');
        const backupTracks = audioStream.getAudioTracks().map((track) => track.clone());
        this.backupTranscriptionAudioStream = new MediaStream(backupTracks);
        try {
            const mediaRecorderOptions = {
                audioBitsPerSecond: 16000,
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
                var _a;
                this.logTrace('audio_chunks:backup_stopped', {
                    backupBlobCount: this.backupAudioChunkBlobs.length,
                });
                (_a = this.resolveBackupAudioChunkStop) === null || _a === void 0 ? void 0 : _a.call(this);
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
            this.logTrace('audio_chunks:backup_started');
        }
        catch (error) {
            this.logTraceError('audio_chunks:backup_start_failed', error);
            (_a = this.backupTranscriptionAudioStream) === null || _a === void 0 ? void 0 : _a.getTracks().forEach((track) => track.stop());
            this.backupTranscriptionAudioStream = null;
        }
    }
    stopAudioChunkRecorder() {
        var _a, _b;
        if (this.audioChunkStopRequested) {
            return;
        }
        if (!this.audioChunkRecorder && !this.backupAudioChunkRecorder) {
            return;
        }
        this.logTrace('audio_chunks:stop_requested', {
            nextChunkIndex: this.nextAudioChunkIndex,
            queuedUploads: this.audioChunkUploadQueue.length,
            hasRecordRtc: Boolean(this.audioChunkRecorder),
            hasBackupRecorder: Boolean(this.backupAudioChunkRecorder),
        });
        const currentRecorder = this.audioChunkRecorder;
        this.audioChunkStopRequested = true;
        if (this.audioChunkRecorder) {
            this.audioChunkRecorder.stopRecording(() => {
                var _a;
                const finalBlob = this.getRecordRTCBlob(currentRecorder);
                if (finalBlob && finalBlob.size > 0 && this.nextAudioChunkIndex === 0) {
                    this.logTrace('audio_chunks:recordrtc_final_blob_fallback', {
                        finalBlobBytes: finalBlob.size,
                        finalBlobType: finalBlob.type || this.audioChunkMimeType,
                    });
                    this.enqueueAudioChunkUpload(finalBlob);
                }
                (_a = this.resolveAudioChunkStop) === null || _a === void 0 ? void 0 : _a.call(this);
                this.resolveAudioChunkStop = null;
            });
        }
        else {
            (_a = this.resolveAudioChunkStop) === null || _a === void 0 ? void 0 : _a.call(this);
            this.resolveAudioChunkStop = null;
        }
        if (this.backupAudioChunkRecorder && this.backupAudioChunkRecorder.state !== 'inactive') {
            try {
                this.backupAudioChunkRecorder.requestData();
            }
            catch (_c) {
                // no-op
            }
            this.backupAudioChunkRecorder.stop();
            this.logTrace('audio_chunks:backup_stop_requested');
        }
        else {
            (_b = this.resolveBackupAudioChunkStop) === null || _b === void 0 ? void 0 : _b.call(this);
            this.resolveBackupAudioChunkStop = null;
        }
    }
    async stopAndCollectAudioChunks() {
        var _a;
        this.logTrace('audio_chunks:collect_start', {
            nextChunkIndex: this.nextAudioChunkIndex,
            queuedUploads: this.audioChunkUploadQueue.length,
            uploadInFlight: this.audioChunkUploadInFlight,
        });
        this.stopAudioChunkRecorder();
        if (this.audioChunkStopPromise) {
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(resolve, 15000);
            });
            await Promise.race([this.audioChunkStopPromise, timeoutPromise]);
            this.logTrace('audio_chunks:recordrtc_stop_wait_done');
        }
        if (this.backupAudioChunkStopPromise) {
            const backupTimeoutPromise = new Promise((resolve) => {
                setTimeout(resolve, 15000);
            });
            await Promise.race([this.backupAudioChunkStopPromise, backupTimeoutPromise]);
            this.logTrace('audio_chunks:backup_stop_wait_done', {
                backupBlobCount: this.backupAudioChunkBlobs.length,
            });
        }
        if (this.backupAudioChunkBlobs.length > 0 && this.audioChunkUploadContext) {
            const backupBlob = new Blob(this.backupAudioChunkBlobs, {
                type: ((_a = this.backupAudioChunkBlobs[0]) === null || _a === void 0 ? void 0 : _a.type) || this.audioChunkMimeType,
            });
            if (backupBlob.size > 0) {
                this.logTrace('audio_chunks:backup_aggregate_blob_ready', {
                    backupBlobBytes: backupBlob.size,
                });
                if (backupBlob.size <= MAX_AUDIO_CHUNK_BYTES) {
                    const { recordingId, apiBaseUrl } = this.audioChunkUploadContext;
                    try {
                        this.logTrace('audio_chunks:backup_primary_upload_start', {
                            backupBlobBytes: backupBlob.size,
                        });
                        const backupUpload = await upload(`recording_${recordingId}_audio_full.webm`, backupBlob, {
                            access: 'public',
                            handleUploadUrl: `${apiBaseUrl}/api/blob/upload`,
                            clientPayload: JSON.stringify({
                                recordingId,
                                asset: 'audio-backup',
                            }),
                            headers: this.buildAuthHeaders(),
                            contentType: backupBlob.type || this.audioChunkMimeType || DEFAULT_AUDIO_CHUNK_MIME_TYPE,
                        });
                        this.preferredBackupAudioUrl = backupUpload.url;
                        this.logTrace('audio_chunks:backup_primary_upload_success', {
                            url: backupUpload.url,
                        });
                    }
                    catch (error) {
                        this.logTraceError('audio_chunks:backup_primary_upload_failed', error, {
                            backupBlobBytes: backupBlob.size,
                        });
                    }
                }
                else if (this.nextAudioChunkIndex === 0) {
                    // If timeslice chunks were unavailable, fallback to queued upload of backup blob.
                    this.logTrace('audio_chunks:backup_aggregate_fallback', {
                        backupBlobBytes: backupBlob.size,
                    });
                    this.enqueueAudioChunkUpload(backupBlob);
                }
                else {
                    this.logTrace('audio_chunks:backup_primary_too_large', {
                        backupBlobBytes: backupBlob.size,
                        maxChunkBytes: MAX_AUDIO_CHUNK_BYTES,
                    });
                }
            }
        }
        try {
            await this.waitForAudioChunkUploads();
        }
        catch (error) {
            if (this.preferredBackupAudioUrl) {
                this.logTraceError('audio_chunks:wait_failed_using_backup', error);
            }
            else {
                throw error;
            }
        }
        if (this.audioChunkUploadError) {
            if (this.preferredBackupAudioUrl) {
                this.logTraceError('audio_chunks:chunk_upload_failed_using_backup', this.audioChunkUploadError);
                this.audioChunkUploadError = null;
                this.audioChunkUploadQueue = [];
                this.audioChunkUploadInFlight = false;
            }
            else {
                throw this.audioChunkUploadError;
            }
        }
        let chunkUrls = [];
        try {
            chunkUrls = this.getOrderedUploadedAudioChunkUrls();
        }
        catch (error) {
            if (this.preferredBackupAudioUrl) {
                this.logTraceError('audio_chunks:chunk_urls_invalid_using_backup', error);
                chunkUrls = [];
            }
            else {
                throw error;
            }
        }
        let uploadedUrls = chunkUrls;
        if (chunkUrls.length === 0 && this.preferredBackupAudioUrl) {
            this.logTrace('audio_chunks:backup_fallback_selected', {
                url: this.preferredBackupAudioUrl,
            });
            uploadedUrls = [this.preferredBackupAudioUrl];
        }
        else if (chunkUrls.length > 0 && this.preferredBackupAudioUrl) {
            this.logTrace('audio_chunks:backup_reserved_not_selected', {
                chunkCount: chunkUrls.length,
                backupUrl: this.preferredBackupAudioUrl,
            });
        }
        this.logTrace('audio_chunks:collect_complete', {
            uploadedCount: uploadedUrls.length,
        });
        this.resetAudioChunkRecorderState();
        return uploadedUrls;
    }
    resetAudioChunkRecorderState() {
        var _a;
        this.logTrace('audio_chunks:reset_state', {
            queuedUploads: this.audioChunkUploadQueue.length,
            uploadedUrlCount: this.audioChunkUploadedUrls.filter(Boolean).length,
            nextChunkIndex: this.nextAudioChunkIndex,
            backupBlobCount: this.backupAudioChunkBlobs.length,
            hasPreferredBackupAudioUrl: Boolean(this.preferredBackupAudioUrl),
        });
        this.audioChunkRecorder = null;
        this.backupAudioChunkRecorder = null;
        this.audioChunkStopPromise = null;
        this.resolveAudioChunkStop = null;
        this.backupAudioChunkStopPromise = null;
        this.resolveBackupAudioChunkStop = null;
        this.backupAudioChunkBlobs = [];
        this.preferredBackupAudioUrl = null;
        this.audioChunkStopRequested = false;
        this.audioChunkUploadContext = null;
        this.audioChunkUploadQueue = [];
        this.audioChunkUploadedUrls = [];
        this.audioChunkUploadInFlight = false;
        this.audioChunkUploadError = null;
        this.audioChunkUploadDrainPromise = null;
        this.resolveAudioChunkUploadDrain = null;
        this.nextAudioChunkIndex = 0;
        (_a = this.backupTranscriptionAudioStream) === null || _a === void 0 ? void 0 : _a.getTracks().forEach((track) => track.stop());
        this.backupTranscriptionAudioStream = null;
    }
    enqueueAudioChunkUpload(blob) {
        if (!this.audioChunkUploadContext) {
            this.logTrace('audio_chunks:enqueue_skipped_no_context', {
                blobBytes: blob.size,
            });
            return;
        }
        const index = this.nextAudioChunkIndex;
        this.nextAudioChunkIndex += 1;
        this.audioChunkUploadQueue.push({ index, blob });
        this.logTrace('audio_chunks:enqueue', {
            chunkIndex: index,
            chunkBytes: blob.size,
            queueLength: this.audioChunkUploadQueue.length,
        });
        void this.processAudioChunkUploadQueue();
    }
    async processAudioChunkUploadQueue() {
        if (this.audioChunkUploadInFlight) {
            return;
        }
        const context = this.audioChunkUploadContext;
        if (!context) {
            return;
        }
        this.audioChunkUploadInFlight = true;
        this.logTrace('audio_chunks:upload_queue_start', {
            queueLength: this.audioChunkUploadQueue.length,
        });
        try {
            while (this.audioChunkUploadQueue.length > 0) {
                if (this.audioChunkUploadError) {
                    break;
                }
                const item = this.audioChunkUploadQueue[0];
                if (!item) {
                    break;
                }
                if (item.blob.size > MAX_AUDIO_CHUNK_BYTES) {
                    throw new Error(`Audio chunk ${item.index + 1} exceeds upload limit (${MAX_AUDIO_CHUNK_BYTES} bytes).`);
                }
                const filename = buildAudioChunkFilename(context.recordingId, item.index);
                this.logTrace('audio_chunks:upload_start', {
                    chunkIndex: item.index,
                    chunkBytes: item.blob.size,
                    filename,
                });
                const result = await upload(filename, item.blob, {
                    access: 'public',
                    handleUploadUrl: `${context.apiBaseUrl}/api/blob/upload`,
                    clientPayload: JSON.stringify({
                        recordingId: context.recordingId,
                        asset: 'audio-chunk',
                        chunkIndex: item.index,
                    }),
                    headers: this.buildAuthHeaders(),
                    contentType: item.blob.type || this.audioChunkMimeType || DEFAULT_AUDIO_CHUNK_MIME_TYPE,
                });
                this.audioChunkUploadedUrls[item.index] = result.url;
                this.audioChunkUploadQueue.shift();
                this.logTrace('audio_chunks:upload_success', {
                    chunkIndex: item.index,
                    url: result.url,
                    remainingQueue: this.audioChunkUploadQueue.length,
                });
            }
        }
        catch (error) {
            this.audioChunkUploadError = error;
            this.audioChunkUploadQueue = [];
            this.logTraceError('audio_chunks:upload_failed', error);
        }
        finally {
            this.audioChunkUploadInFlight = false;
            this.logTrace('audio_chunks:upload_queue_end', {
                queueLength: this.audioChunkUploadQueue.length,
                hasUploadError: Boolean(this.audioChunkUploadError),
            });
            this.resolveAudioChunkUploadDrainIfIdle();
        }
    }
    async waitForAudioChunkUploads() {
        if (this.audioChunkUploadError) {
            throw this.audioChunkUploadError;
        }
        if (!this.audioChunkUploadInFlight && this.audioChunkUploadQueue.length === 0) {
            return;
        }
        this.logTrace('audio_chunks:wait_for_uploads', {
            uploadInFlight: this.audioChunkUploadInFlight,
            queueLength: this.audioChunkUploadQueue.length,
        });
        if (!this.audioChunkUploadDrainPromise) {
            this.audioChunkUploadDrainPromise = new Promise((resolve) => {
                this.resolveAudioChunkUploadDrain = resolve;
            });
        }
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(resolve, 30000);
        });
        await Promise.race([this.audioChunkUploadDrainPromise, timeoutPromise]);
        if (this.audioChunkUploadError) {
            throw this.audioChunkUploadError;
        }
        if (this.audioChunkUploadInFlight || this.audioChunkUploadQueue.length > 0) {
            this.logTrace('audio_chunks:wait_timeout', {
                uploadInFlight: this.audioChunkUploadInFlight,
                queueLength: this.audioChunkUploadQueue.length,
            });
            throw new Error('Timed out while uploading audio chunks.');
        }
    }
    resolveAudioChunkUploadDrainIfIdle() {
        if (this.audioChunkUploadInFlight || this.audioChunkUploadQueue.length > 0) {
            return;
        }
        if (!this.resolveAudioChunkUploadDrain) {
            return;
        }
        const resolve = this.resolveAudioChunkUploadDrain;
        this.resolveAudioChunkUploadDrain = null;
        this.audioChunkUploadDrainPromise = null;
        resolve();
    }
    getRecordRTCBlob(recorder) {
        if (!recorder) {
            return null;
        }
        try {
            return recorder.getBlob();
        }
        catch (_a) {
            return null;
        }
    }
    getOrderedUploadedAudioChunkUrls() {
        if (this.nextAudioChunkIndex === 0) {
            return [];
        }
        const urls = [];
        for (let index = 0; index < this.nextAudioChunkIndex; index += 1) {
            const url = this.audioChunkUploadedUrls[index];
            if (!url) {
                throw new Error(`Missing uploaded audio chunk URL for chunk ${index + 1}.`);
            }
            urls.push(url);
        }
        return urls;
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
        var _a, _b;
        this.state = nextState;
        (_b = (_a = this.options).onLifecycleUpdate) === null || _b === void 0 ? void 0 : _b.call(_a, nextState);
    }
    handleError(error) {
        var _a, _b;
        this.logTrace('error:emitted', error);
        this.state = 'error';
        (_b = (_a = this.options).onError) === null || _b === void 0 ? void 0 : _b.call(_a, error);
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
            var _a, _b;
            this.elapsedSeconds += 1;
            this.updateTimerLabel(this.elapsedSeconds);
            const maxDuration = (_a = this.options.maxDuration) !== null && _a !== void 0 ? _a : 7200;
            const autoStop = (_b = this.options.autoStopEnabled) !== null && _b !== void 0 ? _b : true;
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
            stream === null || stream === void 0 ? void 0 : stream.getTracks().forEach((track) => track.stop());
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
