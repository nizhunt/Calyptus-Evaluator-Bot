/**
 * Handles Vercel Blob client upload with retry and progress callbacks.
 */
import { upload } from "@vercel/blob/client";

export class UploadManager {
  constructor(recordingId, handleUploadUrl, headers) {
    this.recordingId = recordingId;
    this.handleUploadUrl = handleUploadUrl;
    this.headers = headers;
    this.abortController = null;
    this.onProgress = null;
    this.onError = null;
  }

  async upload(blob, mimeType) {
    this.abortController = new AbortController();
    const filename = `recording_${this.recordingId}_${Date.now()}.webm`;

    try {
      const result = await upload(filename, blob, {
        access: "public",
        handleUploadUrl: this.handleUploadUrl,
        clientPayload: JSON.stringify({
          recordingId: this.recordingId,
        }),
        headers: this.headers,
        contentType: mimeType,
        abortSignal: this.abortController.signal,
        onUploadProgress: (progress) => {
          if (this.onProgress) {
            this.onProgress({
              percent: progress.percentage,
              bytesUploaded: progress.loaded,
              bytesTotal: progress.total,
            });
          }
        },
      });

      return {
        url: result.url,
        pathname: result.pathname,
      };
    } catch (error) {
      const err = error;
      if (this.onError) {
        this.onError({
          recordingId: this.recordingId,
          stage: "upload",
          code: "UPLOAD_FAILED",
          message: err.message,
        });
      }
      throw error;
    }
  }

  async uploadWithRetry(blob, mimeType, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.upload(blob, mimeType);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = 2 ** (attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Upload failed after all retries");
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
