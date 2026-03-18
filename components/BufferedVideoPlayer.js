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
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setBufferedEnd(0);
    setDuration(Math.max(0, Number(knownDurationSeconds) || 0));
  }, [src, knownDurationSeconds]);

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
    const onLoaded = () => {
      setIsLoaded(true);
      setHasError(false);
      syncDurationAndBuffer();
    };
    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    video.addEventListener("loadedmetadata", syncDurationAndBuffer);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("canplay", onLoaded);
    video.addEventListener("durationchange", syncDurationAndBuffer);
    video.addEventListener("progress", syncDurationAndBuffer);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    syncDurationAndBuffer();
    if (video.readyState >= 2) {
      setIsLoaded(true);
    }

    return () => {
      video.removeEventListener("loadedmetadata", syncDurationAndBuffer);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      video.removeEventListener("durationchange", syncDurationAndBuffer);
      video.removeEventListener("progress", syncDurationAndBuffer);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
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
    if (!video || hasError) return;

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
    if (!video || duration <= 0) return;

    const nextTime = Number(event.target.value || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const isPlayDisabled = hasError || !src;
  const isSeekDisabled = hasError || duration <= 0;
  const timeLabel = hasError
    ? "Unable to load video"
    : duration > 0
      ? `${formatTime(currentTime)} / ${formatTime(duration)}`
      : isLoaded
        ? `${formatTime(currentTime)} / --:--`
        : "Loading...";

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
            disabled={isSeekDisabled}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={isPlayDisabled}
            className={`px-2 py-1 rounded border border-gray-300 ${isPlayDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"}`}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span>{timeLabel}</span>
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
