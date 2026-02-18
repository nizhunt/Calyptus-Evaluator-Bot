/**
 * Upload Manager for Vercel Blob uploads
 * Handles buffering chunks and uploading final blob with progress tracking and retry
 */
import { upload } from '@vercel/blob/client';
export class UploadManager {
    constructor(recordingId, handleUploadUrl, headers) {
        this.abortController = null;
        this.recordingId = recordingId;
        this.handleUploadUrl = handleUploadUrl;
        this.headers = headers;
    }
    /**
     * Upload the final video blob to Vercel Blob
     * @param blob - The complete video blob
     * @param mimeType - MIME type for content-type header
     */
    async upload(blob, mimeType) {
        var _a;
        this.abortController = new AbortController();
        const filename = `recording_${this.recordingId}.webm`;
        try {
            const result = await upload(filename, blob, {
                access: 'public',
                handleUploadUrl: this.handleUploadUrl,
                clientPayload: JSON.stringify({
                    recordingId: this.recordingId,
                }),
                headers: this.headers,
                contentType: mimeType,
                abortSignal: this.abortController.signal,
                onUploadProgress: (progress) => {
                    var _a;
                    const percent = progress.percentage;
                    (_a = this.onProgress) === null || _a === void 0 ? void 0 : _a.call(this, {
                        percent,
                        bytesUploaded: progress.loaded,
                        bytesTotal: progress.total,
                    });
                },
            });
            return {
                url: result.url,
                pathname: result.pathname,
            };
        }
        catch (error) {
            const err = error;
            console.error('[UploadManager] Upload failed:', err);
            (_a = this.onError) === null || _a === void 0 ? void 0 : _a.call(this, {
                recordingId: this.recordingId,
                stage: 'upload',
                code: 'UPLOAD_FAILED',
                message: err.message,
            });
            throw error;
        }
    }
    /**
     * Upload with retry logic
     */
    async uploadWithRetry(blob, mimeType, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.upload(blob, mimeType);
            }
            catch (error) {
                lastError = error;
                console.warn(`[UploadManager] Attempt ${attempt} failed:`, lastError.message);
                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error('Upload failed after all retries');
    }
    /**
     * Cancel ongoing upload
     */
    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
}
