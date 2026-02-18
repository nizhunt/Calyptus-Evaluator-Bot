/**
 * MediaRecorder Manager
 * Handles recording configuration, MIME type selection, and chunk generation
 */
export class MediaRecorderManager {
    constructor() {
        this.mediaRecorder = null;
        this.chunks = [];
        this.mimeType = '';
        this.startTime = 0;
    }
    /**
     * Probe for best supported MIME type
     */
    static getBestMimeType() {
        const candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4;codecs=h264,aac',
            'video/mp4',
        ];
        for (const mimeType of candidates) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                console.log('[MediaRecorderManager] Using MIME type:', mimeType);
                return mimeType;
            }
        }
        // Return empty string to let browser choose default
        console.warn('[MediaRecorderManager] No preferred MIME type supported, using browser default');
        return '';
    }
    /**
     * Initialize recorder with the given stream
     */
    init(stream) {
        this.mimeType = MediaRecorderManager.getBestMimeType();
        const options = {
            videoBitsPerSecond: 2500000, // 2.5 Mbps
        };
        if (this.mimeType) {
            options.mimeType = this.mimeType;
        }
        this.mediaRecorder = new MediaRecorder(stream, options);
        // Handle data available events (chunks)
        this.mediaRecorder.ondataavailable = (event) => {
            var _a;
            if (event.data.size > 0) {
                const chunk = {
                    blob: event.data,
                    timestamp: Date.now(),
                };
                this.chunks.push(chunk);
                (_a = this.onChunk) === null || _a === void 0 ? void 0 : _a.call(this, chunk);
            }
        };
        // Handle stop
        this.mediaRecorder.onstop = () => {
            var _a;
            (_a = this.onStop) === null || _a === void 0 ? void 0 : _a.call(this, this.chunks);
        };
        // Handle errors
        this.mediaRecorder.onerror = (event) => {
            var _a;
            const error = new Error(event.message || 'MediaRecorder error');
            (_a = this.onError) === null || _a === void 0 ? void 0 : _a.call(this, error);
        };
    }
    /**
     * Start recording with timeslice for chunk generation
     * @param timesliceMs - Interval in ms for dataavailable events (default: 5000ms)
     */
    start(timesliceMs = 5000) {
        if (!this.mediaRecorder) {
            throw new Error('MediaRecorder not initialized');
        }
        this.chunks = [];
        this.startTime = Date.now();
        this.mediaRecorder.start(timesliceMs);
        console.log('[MediaRecorderManager] Recording started with timeslice:', timesliceMs);
    }
    /**
     * Stop recording - final chunk will be emitted via ondataavailable then onstop
     */
    stop() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            console.log('[MediaRecorderManager] Recording stopped');
        }
    }
    /**
     * Get current recording state
     */
    getState() {
        var _a;
        return ((_a = this.mediaRecorder) === null || _a === void 0 ? void 0 : _a.state) || 'inactive';
    }
    /**
     * Get elapsed time in seconds
     */
    getElapsedTime() {
        if (this.startTime === 0)
            return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
    /**
     * Get the MIME type being used
     */
    getMimeType() {
        var _a;
        return this.mimeType || ((_a = this.mediaRecorder) === null || _a === void 0 ? void 0 : _a.mimeType) || 'video/webm';
    }
    /**
     * Get all recorded chunks
     */
    getChunks() {
        return [...this.chunks];
    }
    /**
     * Create final blob from all chunks
     */
    createFinalBlob() {
        const blobs = this.chunks.map((c) => c.blob);
        return new Blob(blobs, { type: this.getMimeType() });
    }
    /**
     * Clean up
     */
    destroy() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;
        this.chunks = [];
    }
}
