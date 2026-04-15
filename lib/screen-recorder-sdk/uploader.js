/**
 * Upload Manager for Vercel Blob uploads
 * Handles uploading final blob with progress tracking and retry
 */
import { upload } from '@vercel/blob/client';
import { buildAudioChunkFilename } from './audio-chunks';

export class UploadManager {
    constructor(recordingId, handleUploadUrl) {
        this.abortController = null;
        this.recordingId = recordingId;
        this.handleUploadUrl = handleUploadUrl;
    }

    async upload(blob, mimeType) {
        this.abortController = new AbortController();
        const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm';
        const filename = `recording_${this.recordingId}.${ext}`;

        try {
            const result = await upload(filename, blob, {
                access: 'public',
                handleUploadUrl: this.handleUploadUrl,
                clientPayload: JSON.stringify({ recordingId: this.recordingId }),
                contentType: mimeType,
                abortSignal: this.abortController.signal,
                onUploadProgress: (progress) => {
                    this.onProgress?.({
                        percent: progress.percentage,
                        bytesUploaded: progress.loaded,
                        bytesTotal: progress.total,
                    });
                },
            });

            return { url: result.url, pathname: result.pathname };
        } catch (error) {
            console.error('[UploadManager] Upload failed:', error);
            this.onError?.({
                recordingId: this.recordingId,
                stage: 'upload',
                code: 'UPLOAD_FAILED',
                message: error.message,
            });
            throw error;
        }
    }

    async uploadWithRetry(blob, mimeType, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.upload(blob, mimeType);
            } catch (error) {
                lastError = error;
                console.warn(`[UploadManager] Attempt ${attempt} failed:`, lastError.message);
                if (attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                }
            }
        }
        throw lastError || new Error('Upload failed after all retries');
    }

    /**
     * Upload a single audio chunk to blob storage.
     * Returns the URL on success, null on failure (does not throw).
     */
    async uploadAudioChunk(blob, recordingId, chunkIndex) {
        const filename = buildAudioChunkFilename(recordingId, chunkIndex, blob.type);
        const maxRetries = 2;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await upload(filename, blob, {
                    access: 'public',
                    handleUploadUrl: this.handleUploadUrl,
                    clientPayload: JSON.stringify({ recordingId, asset: 'audio-chunk', chunkIndex }),
                    contentType: blob.type || 'audio/mp4',
                });
                return result.url;
            } catch (error) {
                lastError = error;
                console.warn(`[UploadManager] Audio chunk ${chunkIndex} upload attempt ${attempt} failed:`, error.message);
                if (attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
                }
            }
        }

        console.warn(`[UploadManager] Audio chunk ${chunkIndex} upload failed after ${maxRetries} retries:`, lastError?.message);
        return null;
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
}
