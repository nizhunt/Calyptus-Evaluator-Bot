"use client";

import {
  VeltRecorderTool,
  VeltRecorderControlPanel,
  VeltRecorderPlayer,
  useRecorderUtils,
  useRecorderEventCallback,
} from "@veltdev/react";
import { useEffect, useState } from "react";

export default function VeltRecorder() {
  const recorderUtils = useRecorderUtils();
  const [isRecorderReady, setIsRecorderReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Event callbacks to track recording state
  const recordingStarted = useRecorderEventCallback("recordingStarted");
  const recordingStopped = useRecorderEventCallback("recordingStopped");

  useEffect(() => {
    if (recordingStarted) {
      setIsRecording(true);
    }
  }, [recordingStarted]);

  useEffect(() => {
    if (recordingStopped) {
      setIsRecording(false);
    }
  }, [recordingStopped]);

  useEffect(() => {
    if (recorderUtils) {
      recorderUtils.disableRecordingMic(); // Screen-only recording
      // Set a delay to match the actual recorder initialization time
      const timer = setTimeout(() => {
        setIsRecorderReady(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [recorderUtils]);

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
        {!isRecorderReady ? (
          <LoadingButton />
        ) : (
          <VeltRecorderTool type="screen" buttonLabel="Start Recording Now" />
        )}
        {/* Always show control panel - it will only be visible when recording */}
        <VeltRecorderControlPanel mode="floating" />
      </div>
      {/* Recording status indicator */}
      {isRecording && (
        <div className="mt-2 text-sm text-red-600 font-medium flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          Recording in progress...
        </div>
      )}
    </div>
  );
}
