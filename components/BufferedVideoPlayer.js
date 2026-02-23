import { useEffect, useRef, useState } from "react";

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getEffectiveDuration(video) {
  if (!video) return 0;

  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  const { seekable } = video;
  if (seekable && seekable.length > 0) {
    try {
      const end = seekable.end(seekable.length - 1);
      if (Number.isFinite(end) && end > 0) {
        return end;
      }
    } catch (_) {
      return 0;
    }
  }

  return 0;
}

function getBufferedEnd(video, effectiveDuration) {
  if (!video || !video.buffered || video.buffered.length === 0) {
    return 0;
  }

  try {
    const end = video.buffered.end(video.buffered.length - 1);
    if (!Number.isFinite(end) || end < 0) return 0;
    if (effectiveDuration > 0) return Math.min(end, effectiveDuration);
    return end;
  } catch (_) {
    return 0;
  }
}

export default function BufferedVideoPlayer({
  src,
  knownDurationSeconds = 0,
  className = "",
  videoClassName = "",
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(Math.max(0, Number(knownDurationSeconds) || 0));
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const syncDurationAndBuffer = () => {
      const mediaDuration = getEffectiveDuration(video);
      const nextDuration = Math.max(mediaDuration, Number(knownDurationSeconds) || 0);
      setDuration(nextDuration);
      setBufferedEnd(getBufferedEnd(video, nextDuration));
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
      const mediaDuration = getEffectiveDuration(video);
      const nextDuration = Math.max(mediaDuration, Number(knownDurationSeconds) || 0);
      setDuration(nextDuration);
      setBufferedEnd(getBufferedEnd(video, nextDuration));
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", syncDurationAndBuffer);
    video.addEventListener("durationchange", syncDurationAndBuffer);
    video.addEventListener("progress", syncDurationAndBuffer);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    syncDurationAndBuffer();

    return () => {
      video.removeEventListener("loadedmetadata", syncDurationAndBuffer);
      video.removeEventListener("durationchange", syncDurationAndBuffer);
      video.removeEventListener("progress", syncDurationAndBuffer);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [src, knownDurationSeconds]);

  useEffect(() => {
    const nextKnownDuration = Math.max(0, Number(knownDurationSeconds) || 0);
    if (nextKnownDuration > duration) {
      setDuration(nextKnownDuration);
    }
  }, [knownDurationSeconds, duration]);

  const playedPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  const handleTogglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch (_) {
        setIsPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  const handleSeek = (event) => {
    const video = videoRef.current;
    if (!video) return;

    const nextTime = Number(event.target.value || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className={`w-full max-w-4xl mx-auto rounded-lg border border-gray-200 bg-black overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        className={`w-full h-auto bg-black ${videoClassName}`}
      />
      <div className="bg-white px-3 py-3">
        <div className="relative h-5 flex items-center">
          <div className="absolute left-0 right-0 h-1.5 rounded-full bg-gray-200" />
          <div
            className="absolute left-0 h-1.5 rounded-full bg-gray-400"
            style={{ width: `${Math.max(bufferedPercent, playedPercent)}%` }}
          />
          <div
            className="absolute left-0 h-1.5 rounded-full bg-blue-500"
            style={{ width: `${playedPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="any"
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="video-seek absolute inset-0 w-full h-5 cursor-pointer appearance-none bg-transparent"
            aria-label="Seek video"
            disabled={duration <= 0}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      <style jsx>{`
        .video-seek::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
          margin-top: 0;
        }

        .video-seek::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #2563eb;
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
