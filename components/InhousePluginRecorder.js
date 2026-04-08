"use client";

import { useEffect, useRef, useState } from "react";
import { ScreenRecorder } from "../lib/screen-recorder-sdk";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";

const START_RECORDING_TOOLTIP = (
  <>
    <p className="leading-[1.4]">
      Read the task carefully and understand the requirements before starting.
    </p>
    <br />
    <p className="leading-[1.4]">
      Use the AI Assistant for guidance if needed, and submit your work when
      ready.
    </p>
  </>
);

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
  const isBusy = [
    "selecting_sources",
    "stopping",
    "uploading",
    "transcribing",
  ].includes(state);
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

  const startLabel = hasPreviousRecording ? "Re-record" : "Start Recording";

  return (
    <div className="recorder-container flex min-h-0 w-full flex-1 flex-col">
      {/* Black preview area — placeholder until screen capture / recording is active */}
      <div
        className={cn(
          "relative min-h-[min(400px,50vh)] flex-1 rounded-calyptus bg-calyptus-strong",
          isRecording && "ring-2 ring-white/10 ring-inset",
        )}
      >
        {isRecording && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <div className="size-2 animate-pulse rounded-full bg-red-500" />
              Recording in progress…
            </div>
          </div>
        )}
        {(state === "uploading" || state === "transcribing") && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-center text-sm font-medium text-white/80">
              {state === "uploading"
                ? uploadProgress
                  ? `Uploading… ${Math.round(uploadProgress.percent)}%`
                  : "Uploading…"
                : "Generating transcript…"}
            </p>
          </div>
        )}
        {state === "selecting_sources" && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-center text-sm font-medium text-white/80">
              Choose what to share…
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar — centered primary action (Figma: white strip under preview) */}
      <div className="flex w-full shrink-0 justify-center border-t border-calyptus-border-input bg-white px-3 py-3">
        <div className="flex w-full max-w-[167px] flex-col items-center gap-2">
          {state === "uploading" || state === "transcribing" ? (
            <p className="text-center text-sm font-medium text-calyptus-body">
              Please wait…
            </p>
          ) : isRecording ? (
            <Button
              type="button"
              variant="destructiveSolid"
              size="recorder"
              className="w-full justify-center"
              onClick={handleStop}
            >
              Stop recording
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex w-full max-w-[167px] justify-center">
                  <Button
                    type="button"
                    variant="primary"
                    size="recorder"
                    className="w-full justify-center text-lg font-bold"
                    disabled={!canStart}
                    onClick={handleStart}
                  >
                    {startLabel}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={10}
                className={cn(
                  "z-[100] max-w-[min(100vw-2rem,347px)] flex-col items-stretch gap-3 rounded-calyptus border border-calyptus-border-input bg-white px-[22px] py-[22px] text-left text-sm font-normal leading-[1.4] text-calyptus-strong shadow-none drop-shadow-[0_4px_10px_rgba(16,24,40,0.15)]",
                  "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-95",
                )}
                arrowClassName="fill-white stroke-calyptus-border-input [stroke-width:1px]"
              >
                {START_RECORDING_TOOLTIP}
              </TooltipContent>
            </Tooltip>
          )}
          {runtimeError && (
            <p className="text-center text-xs font-medium text-red-600">
              {runtimeError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
