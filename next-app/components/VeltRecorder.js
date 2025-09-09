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
  const [recorderId, setRecorderId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const recordingStopped = useRecorderEventCallback("recordingStopped");
  const recordingDone = useRecorderEventCallback("recordingDone");

  useEffect(() => {
    if (recordingDone) {
      if (recordingDone.recorderId) {
        setRecorderId(recordingDone.recorderId);
      }
      setIsLoading(false);
    }
  }, [recordingDone]);

  useEffect(() => {
    if (recordingStopped) {
      setIsLoading(true);
    }
  }, [recordingStopped]);

  useEffect(() => {
    if (recorderUtils) {
      recorderUtils.disableRecordingMic(); // Screen-only recording
    }
  }, [recorderUtils]);

  return (
    <div className="recorder-container">
      <div className="toolbar">
        <VeltRecorderTool type="screen" buttonLabel="Start Recording Now" />
        <VeltRecorderControlPanel mode="floating" />
      </div>
      <div className="video-player mt-6">
        {isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <h3 className="text-lg font-medium mb-2">Processing Recording...</h3>
            <div className="flex items-center justify-center p-6">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </div>
        )}
        {!isLoading && recorderId && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <h3 className="text-lg font-medium mb-2">Latest Recording</h3>
            <VeltRecorderPlayer
              key={recorderId}
              recorderId={recorderId}
              summary={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}