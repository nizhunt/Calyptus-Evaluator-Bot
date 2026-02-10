/**
 * MediaRecorder wrapper for chunking and final blob creation.
 */
export class MediaRecorderManager {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.mimeType = "";
    this.startTime = 0;
    this.onChunk = null;
    this.onStop = null;
    this.onError = null;
  }

  static getBestMimeType() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ];

    for (const mimeType of candidates) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return "";
  }

  init(stream) {
    this.mimeType = MediaRecorderManager.getBestMimeType();

    const options = {
      videoBitsPerSecond: 2500000,
    };
    if (this.mimeType) {
      options.mimeType = this.mimeType;
    }

    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size <= 0) {
        return;
      }

      const chunk = {
        blob: event.data,
        timestamp: Date.now(),
      };
      this.chunks.push(chunk);

      if (this.onChunk) {
        this.onChunk(chunk);
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.onStop) {
        this.onStop(this.chunks);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      const error = new Error(event?.message || "MediaRecorder error");
      if (this.onError) {
        this.onError(error);
      }
    };
  }

  start(timesliceMs = 5000) {
    if (!this.mediaRecorder) {
      throw new Error("MediaRecorder not initialized");
    }

    this.chunks = [];
    this.startTime = Date.now();
    this.mediaRecorder.start(timesliceMs);
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  getState() {
    return this.mediaRecorder?.state || "inactive";
  }

  getElapsedTime() {
    if (this.startTime === 0) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getMimeType() {
    return this.mimeType || this.mediaRecorder?.mimeType || "video/webm";
  }

  getChunks() {
    return [...this.chunks];
  }

  createFinalBlob() {
    const blobs = this.chunks.map((c) => c.blob);
    return new Blob(blobs, { type: this.getMimeType() });
  }

  destroy() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
