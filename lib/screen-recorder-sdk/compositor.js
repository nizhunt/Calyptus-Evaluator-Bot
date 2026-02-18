/**
 * Canvas Compositor for baking webcam PIP into screen recording
 * Uses requestAnimationFrame to composite screen + webcam onto canvas each frame
 */
export class CanvasCompositor {
    constructor(screenStream, webcamStream) {
        this.webcamVideo = null;
        this.animationId = null;
        this.isRunning = false;
        // PIP positioning
        this.pipPosition = {
            x: 20,
            y: 20,
            width: 200,
            height: 150,
        };
        /**
         * Draw one frame to the canvas
         */
        this.drawFrame = () => {
            if (!this.isRunning)
                return;
            // Draw screen capture
            this.ctx.drawImage(this.screenVideo, 0, 0, this.canvas.width, this.canvas.height);
            // Draw webcam PIP overlay if available
            if (this.webcamVideo) {
                const { x, y, width, height } = this.pipPosition;
                // Draw rounded rectangle background
                this.ctx.save();
                this.ctx.beginPath();
                this.roundRect(x - 4, y - 4, width + 8, height + 8, 12);
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fill();
                // Clip to rounded rectangle for webcam
                this.ctx.beginPath();
                this.roundRect(x, y, width, height, 8);
                this.ctx.clip();
                // Draw webcam video
                this.ctx.drawImage(this.webcamVideo, x, y, width, height);
                this.ctx.restore();
            }
            // Request next frame
            this.animationId = requestAnimationFrame(this.drawFrame);
        };
        // Create canvas element
        this.canvas = document.createElement('canvas');
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D canvas context');
        }
        this.ctx = ctx;
        // Create screen video element
        this.screenVideo = document.createElement('video');
        this.screenVideo.srcObject = screenStream;
        this.screenVideo.muted = true;
        this.screenVideo.playsInline = true;
        // Create webcam video element if stream provided
        if (webcamStream) {
            this.webcamVideo = document.createElement('video');
            this.webcamVideo.srcObject = webcamStream;
            this.webcamVideo.muted = true;
            this.webcamVideo.playsInline = true;
        }
    }
    /**
     * Initialize the compositor (play videos and set canvas size)
     */
    async init() {
        await this.screenVideo.play();
        // Set canvas size to match screen video
        const { videoWidth, videoHeight } = this.screenVideo;
        this.canvas.width = videoWidth || 1920;
        this.canvas.height = videoHeight || 1080;
        // Position PIP in bottom-right corner initially
        this.pipPosition = {
            x: this.canvas.width - 220,
            y: this.canvas.height - 170,
            width: 200,
            height: 150,
        };
        if (this.webcamVideo) {
            await this.webcamVideo.play();
            // Adjust PIP aspect ratio based on webcam
            const webcamRatio = this.webcamVideo.videoWidth / this.webcamVideo.videoHeight;
            this.pipPosition.height = Math.round(this.pipPosition.width / webcamRatio);
            this.pipPosition.y = this.canvas.height - this.pipPosition.height - 20;
        }
    }
    /**
     * Start compositing frames
     */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.drawFrame();
    }
    /**
     * Stop compositing
     */
    stop() {
        this.isRunning = false;
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    /**
     * Helper to draw rounded rectangles
     */
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
    /**
     * Update PIP position (called when user drags the overlay)
     */
    setPIPPosition(x, y) {
        this.setPIPRect(x, y, this.pipPosition.width, this.pipPosition.height);
    }
    /**
     * Update PIP position and size together to keep overlay geometry in sync.
     */
    setPIPRect(x, y, width, height) {
        var _a;
        const minSize = 64;
        const maxWidth = Math.max(minSize, this.canvas.width - 20);
        const maxHeight = Math.max(minSize, this.canvas.height - 20);
        const nextWidth = Math.max(minSize, Math.min(width, maxWidth));
        const nextHeight = Math.max(minSize, Math.min(height, maxHeight));
        // Clamp to canvas bounds
        const maxX = this.canvas.width - nextWidth - 10;
        const maxY = this.canvas.height - nextHeight - 10;
        this.pipPosition.width = nextWidth;
        this.pipPosition.height = nextHeight;
        this.pipPosition.x = Math.max(10, Math.min(x, maxX));
        this.pipPosition.y = Math.max(10, Math.min(y, maxY));
        (_a = this.onPIPMove) === null || _a === void 0 ? void 0 : _a.call(this, this.pipPosition);
    }
    /**
     * Get current PIP position
     */
    getPIPPosition() {
        return Object.assign({}, this.pipPosition);
    }
    /**
     * Get canvas dimensions
     */
    getCanvasSize() {
        return { width: this.canvas.width, height: this.canvas.height };
    }
    /**
     * Get the composite stream for recording
     */
    getStream(fps = 30) {
        return this.canvas.captureStream(fps);
    }
    /**
     * Get the canvas element (for display)
     */
    getCanvas() {
        return this.canvas;
    }
    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        this.screenVideo.srcObject = null;
        if (this.webcamVideo) {
            this.webcamVideo.srcObject = null;
        }
    }
}
