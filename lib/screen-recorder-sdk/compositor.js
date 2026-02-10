/**
 * Canvas compositor that bakes webcam PIP into screen recording frames.
 */
export class CanvasCompositor {
  constructor(screenStream, webcamStream) {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D canvas context");
    }
    this.ctx = ctx;

    this.screenVideo = document.createElement("video");
    this.screenVideo.srcObject = screenStream;
    this.screenVideo.muted = true;
    this.screenVideo.playsInline = true;

    this.webcamVideo = null;
    if (webcamStream) {
      this.webcamVideo = document.createElement("video");
      this.webcamVideo.srcObject = webcamStream;
      this.webcamVideo.muted = true;
      this.webcamVideo.playsInline = true;
    }

    this.animationId = null;
    this.isRunning = false;
    this.pipPosition = {
      x: 20,
      y: 20,
      width: 200,
      height: 150,
    };
    this.onPIPMove = null;
  }

  async init() {
    await this.screenVideo.play();

    const { videoWidth, videoHeight } = this.screenVideo;
    this.canvas.width = videoWidth || 1920;
    this.canvas.height = videoHeight || 1080;

    this.pipPosition = {
      x: this.canvas.width - 220,
      y: this.canvas.height - 170,
      width: 200,
      height: 150,
    };

    if (this.webcamVideo) {
      await this.webcamVideo.play();
      const webcamRatio = this.webcamVideo.videoWidth / this.webcamVideo.videoHeight;
      this.pipPosition.height = Math.round(this.pipPosition.width / webcamRatio);
      this.pipPosition.y = this.canvas.height - this.pipPosition.height - 20;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.drawFrame();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  drawFrame = () => {
    if (!this.isRunning) return;

    this.ctx.drawImage(this.screenVideo, 0, 0, this.canvas.width, this.canvas.height);

    if (this.webcamVideo) {
      const { x, y, width, height } = this.pipPosition;

      this.ctx.save();
      this.ctx.beginPath();
      this.roundRect(x - 4, y - 4, width + 8, height + 8, 12);
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      this.ctx.fill();

      this.ctx.beginPath();
      this.roundRect(x, y, width, height, 8);
      this.ctx.clip();
      this.ctx.drawImage(this.webcamVideo, x, y, width, height);
      this.ctx.restore();
    }

    this.animationId = requestAnimationFrame(this.drawFrame);
  };

  roundRect(x, y, w, h, r) {
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  setPIPPosition(x, y) {
    const maxX = this.canvas.width - this.pipPosition.width - 10;
    const maxY = this.canvas.height - this.pipPosition.height - 10;

    this.pipPosition.x = Math.max(10, Math.min(x, maxX));
    this.pipPosition.y = Math.max(10, Math.min(y, maxY));

    if (this.onPIPMove) {
      this.onPIPMove(this.pipPosition);
    }
  }

  getPIPPosition() {
    return { ...this.pipPosition };
  }

  getCanvasSize() {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  getStream(fps = 30) {
    return this.canvas.captureStream(fps);
  }

  getCanvas() {
    return this.canvas;
  }

  destroy() {
    this.stop();
    this.screenVideo.srcObject = null;
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
    }
  }
}
