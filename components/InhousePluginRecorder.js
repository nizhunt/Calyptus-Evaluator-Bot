"use client";

import { useEffect, useRef, useState } from "react";
import { ScreenRecorder } from "../lib/screen-recorder-sdk";

export default function InhousePluginRecorder({
  onLifecycleUpdate,
  onVideoReady,
  onTranscriptReady,
  onError,
}) {
  const recorderRef = useRef(null);
  const callbacksRef = useRef({
    onLifecycleUpdate,
    onVideoReady,
    onTranscriptReady,
    onError,
  });
  const [state, setState] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [runtimeError, setRuntimeError] = useState("");

  const apiBaseUrl = process.env.NEXT_PUBLIC_RECORDER_API_BASE_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_SCREEN_RECORDER_API_KEY || "";

  useEffect(() => {
    callbacksRef.current = {
      onLifecycleUpdate,
      onVideoReady,
      onTranscriptReady,
      onError,
    };
  }, [onLifecycleUpdate, onVideoReady, onTranscriptReady, onError]);

  useEffect(() => {
    if (!apiBaseUrl) {
      setRuntimeError(
        "Missing NEXT_PUBLIC_RECORDER_API_BASE_URL. Add it in your app env and restart."
      );
      return undefined;
    }

    const recorder = new ScreenRecorder({
      apiBaseUrl,
      apiKey: apiKey || undefined,
      maxDuration: 7200,
      autoStopEnabled: true,
      onLifecycleUpdate: (nextState) => {
        setState(nextState);
        callbacksRef.current.onLifecycleUpdate?.(nextState);
      },
      onUploadProgress: (progress) => {
        setUploadProgress(progress);
      },
      onVideoReady: (payload) => {
        setUploadProgress(null);
        callbacksRef.current.onVideoReady?.(payload);
      },
      onTranscriptReady: (payload) => {
        callbacksRef.current.onTranscriptReady?.(payload);
      },
      onError: (error) => {
        setRuntimeError(error.message || "Recorder failed.");
        callbacksRef.current.onError?.(error);
      },
      onClose: () => {},
    });

    recorderRef.current = recorder;
    setRuntimeError("");

    return () => {
      recorder.destroy();
      recorderRef.current = null;
    };
  }, [apiBaseUrl, apiKey]);

  const isRecording = state === "recording";
  const isBusy = ["selecting_sources", "stopping", "uploading", "transcribing"].includes(state);
  const canStart = Boolean(recorderRef.current) && !isRecording && !isBusy;

  const handleStart = () => {
    if (!recorderRef.current) {
      return;
    }
    setRuntimeError("");
    setUploadProgress(null);
    recorderRef.current.open();
  };

  const handleStop = () => {
    recorderRef.current?.stop();
  };

  const LoadingButton = () => (
    <button
      disabled
      className="inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-gray-400 text-white text-xs sm:text-sm font-medium rounded-lg border border-gray-500 cursor-not-allowed opacity-75 min-h-[36px] sm:min-h-[40px] w-full sm:w-auto"
      style={{
        backgroundColor: "#9CA3AF",
        borderColor: "#6B7280",
        color: "#FFFFFF",
      }}
    >
      <svg
        className="animate-spin h-3 w-3 sm:h-4 sm:w-4 text-white flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span className="truncate">Preparing Recorder</span>
    </button>
  );

  return (
    <div className="recorder-container">
      <div className="toolbar">
        {!apiBaseUrl ? (
          <LoadingButton />
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!canStart}
              onClick={handleStart}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border min-h-[40px] ${
                canStart
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white border-blue-500 hover:from-blue-600 hover:to-purple-600"
                  : "bg-gray-300 text-gray-600 border-gray-400 cursor-not-allowed"
              }`}
            >
              Start Recording Now
            </button>
            {isRecording && (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-red-600 text-white bg-red-600 hover:bg-red-700"
              >
                Stop Recording
              </button>
            )}
          </div>
        )}
      </div>
      {isRecording && (
        <div className="mt-2 text-sm text-red-600 font-medium flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Recording in progress...
        </div>
      )}
      {state === "uploading" && uploadProgress && (
        <div className="mt-2 text-sm text-gray-700">
          Uploading: {Math.round(uploadProgress.percent)}%
        </div>
      )}
      {state === "transcribing" && (
        <div className="mt-2 text-sm text-gray-700">Generating transcript...</div>
      )}
      {runtimeError && (
        <div className="mt-2 text-sm text-red-600 font-medium">{runtimeError}</div>
      )}
    </div>
  );
}
