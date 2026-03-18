"use client";

import { useEffect, useRef, useState } from "react";
import { ScreenRecorder } from "../lib/screen-recorder-sdk";

export default function InhousePluginRecorder({
  onLifecycleUpdate,
  onVideoReady,
  onTranscriptReady,
  onError,
  hasPreviousRecording = false,
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

  useEffect(() => {
    callbacksRef.current = {
      onLifecycleUpdate,
      onVideoReady,
      onTranscriptReady,
      onError,
    };
  }, [onLifecycleUpdate, onVideoReady, onTranscriptReady, onError]);

  useEffect(() => {
    const recorder = new ScreenRecorder({
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
  }, []);

  const isRecording = state === "recording";
  const isBusy = ["selecting_sources", "stopping", "uploading", "transcribing"].includes(state);
  const canStart = Boolean(recorderRef.current) && !isRecording && !isBusy;

  const handleStart = () => {
    if (!recorderRef.current) return;
    setRuntimeError("");
    setUploadProgress(null);
    recorderRef.current.open();
  };

  const handleStop = () => {
    recorderRef.current?.stop();
  };

  return (
    <div className="recorder-container">
      <div className="toolbar">
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
            {hasPreviousRecording ? "Re-record" : "Start Recording Now"}
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
