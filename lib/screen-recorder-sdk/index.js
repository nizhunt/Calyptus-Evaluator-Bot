import { CanvasCompositor } from "./compositor";
import { MediaRecorderManager } from "./recorder";
import { UploadManager } from "./uploader";

export class ScreenRecorder {
  constructor(options) {
    const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const resolvedApiBaseUrl = options.apiBaseUrl || runtimeOrigin;

    this.options = {
      maxDuration: 7200,
      autoStopEnabled: true,
      ...options,
      apiBaseUrl: resolvedApiBaseUrl,
    };

    this.state = "idle";
    this.recordingId = null;

    this.compositor = null;
    this.recorder = null;
    this.uploader = null;

    this.screenStream = null;
    this.webcamStream = null;
    this.audioStream = null;
    this.compositeStream = null;

    this.overlayRoot = null;
    this.timerLabel = null;
    this.webcamBubble = null;

    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.isSessionOpen = false;
    this.ignoreRecorderStop = false;
  }

  open() {
    if (this.isSessionOpen) {
      return;
    }

    this.isSessionOpen = true;
    void this.startCaptureFlow();
  }

  stop() {
    if (this.state !== "recording") {
      return;
    }

    this.ignoreRecorderStop = false;
    this.updateState("stopping");
    this.stopTimer();
    this.recorder?.stop();
  }

  close() {
    this.ignoreRecorderStop = true;
    this.uploader?.abort();
    this.stopTimer();
    this.stopAllTracks();
    this.removeOverlayUI();

    this.compositor?.destroy();
    this.compositor = null;

    this.recorder?.destroy();
    this.recorder = null;

    this.uploader = null;
    this.isSessionOpen = false;

    if (this.state !== "idle" && this.state !== "error") {
      this.updateState("idle");
    }

    this.options.onClose?.();
  }

  getState() {
    return this.state;
  }

  getRecordingId() {
    return this.recordingId;
  }

  setCallbacks(callbacks) {
    Object.assign(this.options, callbacks);
  }

  destroy() {
    this.close();
  }

  async startCaptureFlow() {
    try {
      const apiBaseUrl = this.getApiBaseUrl();
      this.updateState("selecting_sources");

      const initRes = await fetch(`${apiBaseUrl}/api/recordings/init`, {
        method: "POST",
        headers: this.buildAuthHeaders(),
      });

      if (!initRes.ok) {
        throw new Error(`Failed to initialize recording (${initRes.status})`);
      }

      const initJson = await initRes.json();
      if (!initJson.recordingId) {
        throw new Error("Recording initialization did not return a recording ID");
      }
      this.recordingId = initJson.recordingId;

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error("No screen video track available");
      }

      screenTrack.onended = () => {
        this.stop();
      };

      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      try {
        this.webcamStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      } catch (webcamError) {
        console.warn("[ScreenRecorder] Webcam unavailable, continuing without webcam", webcamError);
        this.webcamStream = null;
      }

      this.compositor = new CanvasCompositor(this.screenStream, this.webcamStream || undefined);
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
          recordingId: this.recordingId || undefined,
          stage: "recording",
          code: "RECORDING_FAILED",
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
      this.updateState("recording");
    } catch (error) {
      this.handleError({
        recordingId: this.recordingId || undefined,
        stage: "permission",
        code: "START_FAILED",
        message: error instanceof Error ? error.message : "Failed to start recording",
      });
      this.close();
    }
  }

  async handleRecordingStopped(apiBaseUrl) {
    const currentRecordingId = this.recordingId;

    try {
      if (!this.recorder) {
        throw new Error("Recorder not initialized");
      }
      if (!currentRecordingId) {
        throw new Error("Missing recording ID");
      }

      const blob = this.recorder.createFinalBlob();
      const mimeType = this.recorder.getMimeType();

      this.stopAllTracks();
      this.removeOverlayUI();
      this.compositor?.destroy();
      this.compositor = null;

      this.updateState("uploading");
      this.uploader = new UploadManager(
        currentRecordingId,
        `${apiBaseUrl}/api/blob/upload`,
        this.buildAuthHeaders()
      );
      this.uploader.onProgress = (progress) => {
        this.options.onUploadProgress?.(progress);
      };

      const uploadResult = await this.uploader.uploadWithRetry(blob, mimeType);

      this.updateState("transcribing");
      const transcriptionRes = await fetch(
        `${apiBaseUrl}/api/recordings/${currentRecordingId}/transcription`,
        {
          method: "POST",
          headers: this.buildAuthHeaders({ withJsonContentType: true }),
          body: JSON.stringify({ blobUrl: uploadResult.url }),
        }
      );

      if (!transcriptionRes.ok) {
        throw new Error(`Failed to start transcription (${transcriptionRes.status})`);
      }

      const pollStartedAt = Date.now();
      const maxPollMs = 15 * 60 * 1000;
      let transcriptText = "";
      let resolvedPlaybackUrl = uploadResult.url;
      let transcriptResolved = false;

      while (Date.now() - pollStartedAt < maxPollMs) {
        const statusRes = await fetch(`${apiBaseUrl}/api/recordings/${currentRecordingId}`, {
          headers: this.buildAuthHeaders(),
          cache: "no-store",
        });

        if (!statusRes.ok) {
          throw new Error(`Failed to fetch recording status (${statusRes.status})`);
        }

        const statusData = await statusRes.json();

        if (statusData.status === "transcript_ready") {
          transcriptText = statusData.transcriptText || "";
          resolvedPlaybackUrl = statusData.blobUrl || uploadResult.url;
          transcriptResolved = true;
          break;
        }

        if (statusData.status === "error") {
          throw new Error(statusData.errorMessage || "Transcription failed");
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!transcriptResolved) {
        throw new Error("Transcription timed out");
      }

      this.options.onTranscriptReady?.({
        recordingId: currentRecordingId,
        transcriptText,
      });

      this.updateState("video_ready");
      this.options.onVideoReady?.({
        recordingId: currentRecordingId,
        playbackUrl: resolvedPlaybackUrl,
      });

      this.recorder?.destroy();
      this.recorder = null;
      this.uploader = null;
      this.isSessionOpen = false;
      this.options.onClose?.();
    } catch (error) {
      this.handleError({
        recordingId: currentRecordingId || undefined,
        stage: this.state === "transcribing" ? "transcription" : "upload",
        code: this.state === "transcribing" ? "TRANSCRIPTION_FAILED" : "UPLOAD_FAILED",
        message: error instanceof Error ? error.message : "Failed while processing recording",
      });
      this.close();
    }
  }

  getApiBaseUrl() {
    if (this.options.apiBaseUrl) {
      return this.options.apiBaseUrl;
    }

    if (typeof window !== "undefined") {
      return window.location.origin;
    }

    throw new Error("apiBaseUrl is required when window is unavailable");
  }

  buildAuthHeaders(options = {}) {
    const headers = {};

    if (options.withJsonContentType) {
      headers["Content-Type"] = "application/json";
    }

    if (this.options.apiKey) {
      headers["X-Screen-Recorder-Key"] = this.options.apiKey;
    }

    return headers;
  }

  updateState(nextState) {
    this.state = nextState;
    this.options.onLifecycleUpdate?.(nextState);
  }

  handleError(error) {
    this.state = "error";
    this.options.onError?.(error);
  }

  mountOverlayUI() {
    const root = document.createElement("div");
    root.id = "screen-recorder-runtime-overlay";
    root.style.cssText = [
      "position: fixed",
      "inset: 0",
      "z-index: 2147483646",
      "pointer-events: none",
    ].join(";");

    const controls = document.createElement("div");
    controls.style.cssText = [
      "position: fixed",
      "left: 50%",
      "bottom: 24px",
      "transform: translateX(-50%)",
      "display: flex",
      "align-items: center",
      "gap: 12px",
      "padding: 10px 14px",
      "border-radius: 999px",
      "background: rgba(15, 23, 42, 0.78)",
      "box-shadow: 0 10px 35px rgba(0, 0, 0, 0.35)",
      "backdrop-filter: blur(8px)",
      "pointer-events: auto",
    ].join(";");

    const timer = document.createElement("span");
    timer.style.cssText = [
      "font: 600 14px system-ui, -apple-system, Segoe UI, sans-serif",
      "color: #f8fafc",
      "min-width: 52px",
      "text-align: center",
    ].join(";");
    timer.textContent = "00:00";

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.textContent = "Stop Recording";
    stopButton.style.cssText = [
      "border: 0",
      "border-radius: 999px",
      "padding: 10px 14px",
      "font: 600 13px system-ui, -apple-system, Segoe UI, sans-serif",
      "color: #fff",
      "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      "cursor: pointer",
    ].join(";");
    stopButton.addEventListener("click", () => this.stop());

    controls.appendChild(timer);
    controls.appendChild(stopButton);
    root.appendChild(controls);

    if (this.webcamStream && this.compositor) {
      const pip = this.compositor.getPIPPosition();
      const bubble = document.createElement("div");
      bubble.style.cssText = [
        "position: fixed",
        `width: ${Math.round(pip.width)}px`,
        `height: ${Math.round(pip.height)}px`,
        "left: calc(100vw - 240px)",
        "top: calc(100vh - 200px)",
        "border-radius: 12px",
        "overflow: hidden",
        "box-shadow: 0 10px 35px rgba(0, 0, 0, 0.45)",
        "border: 2px solid rgba(255, 255, 255, 0.9)",
        "cursor: move",
        "pointer-events: auto",
        "user-select: none",
      ].join(";");

      const video = document.createElement("video");
      video.srcObject = this.webcamStream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.style.cssText = ["width: 100%", "height: 100%", "object-fit: cover"].join(";");

      bubble.appendChild(video);
      root.appendChild(bubble);

      this.attachBubbleDragHandlers(bubble);
      this.webcamBubble = bubble;
      this.syncCompositorPipToBubble();
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
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };

    element.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      dragging = true;
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      window.addEventListener("mousemove", onMouseMove, true);
      window.addEventListener("mouseup", onMouseUp, true);
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
    this.compositor.setPIPPosition(x, y);
  }

  removeOverlayUI() {
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
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    this.timerLabel.textContent = `${mins}:${secs}`;
  }

  stopAllTracks() {
    const stopTracks = (stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    stopTracks(this.screenStream);
    stopTracks(this.webcamStream);
    stopTracks(this.audioStream);
    stopTracks(this.compositeStream);

    this.screenStream = null;
    this.webcamStream = null;
    this.audioStream = null;
    this.compositeStream = null;
  }
}

export { CanvasCompositor, MediaRecorderManager, UploadManager };
