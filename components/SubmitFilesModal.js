"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { calyptus } from "@/lib/calyptus-ui";
import { cn } from "@/lib/utils";

const MAX_FILES = 4;
const ACCEPT =
  "image/*,.pdf,.md,.markdown,application/pdf,text/markdown,text/plain";

/** Stable id for GuidedTour spotlight / `tour-highlight` (see `applyStepDomEffects`). */
export const SUBMIT_FILES_MODAL_PANEL_ID = "submit-files-modal-panel";

function assignFilesToState(files) {
  const screenshots = [null, null, null];
  const outputFiles = [];
  let si = 0;
  for (const f of files) {
    if (si < 3 && f.type.startsWith("image/")) {
      screenshots[si++] = f;
    } else {
      outputFiles.push(f);
    }
  }
  return { screenshots, outputFiles };
}

function filesFromScreenshotsAndOutput(screenshots, outputFiles) {
  const list = [];
  screenshots.forEach((s) => {
    if (s) list.push(s);
  });
  (outputFiles || []).forEach((o) => {
    if (o) list.push(o);
  });
  return list.slice(0, MAX_FILES);
}

function UploadCloudIcon({ className }) {
  return (
    <svg
      className={className}
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 18a4 4 0 1 1 .5-7.97A5.5 5.5 0 0 1 17.5 9a4 4 0 0 1 .5 8H7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 11v6m0 0-2.5-2m2.5 2 2.5-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilePreviewCard({ file, onRemove }) {
  const isImage = file.type.startsWith("image/");
  const url = isImage ? URL.createObjectURL(file) : null;

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <div className="relative flex w-[72px] flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1 -top-1 z-[1] flex size-4 items-center justify-center rounded-full bg-calyptus-blue-deep text-white shadow-sm ring-2 ring-white hover:bg-calyptus-purple"
        aria-label={`Remove ${file.name}`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="flex h-[52px] w-full items-center justify-center overflow-hidden rounded-md border border-calyptus-border-field bg-calyptus-surface-input shadow-sm">
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl" aria-hidden>
            📄
          </span>
        )}
      </div>
      <div className="w-full max-w-[72px] truncate rounded border border-calyptus-border-field bg-calyptus-surface-input px-1 py-0.5 text-center text-[9px] font-medium leading-tight text-calyptus-strong">
        {file.name}
      </div>
    </div>
  );
}

export default function SubmitFilesModal({
  open,
  onClose,
  screenshots,
  outputFiles,
  /** Legacy: only update parent file state and close. */
  onApply,
  /** Primary flow: run full evaluation submit (same as page handleSubmit). */
  onSubmitEvaluation,
  recordingUrl = "",
  isSubmitting = false,
}) {
  const titleId = useId();
  const evaluatingTitleId = useId();
  const inputId = useId();
  const [mounted, setMounted] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setFiles(filesFromScreenshotsAndOutput(screenshots, outputFiles));
    }
  }, [open, screenshots, outputFiles]);

  const addFiles = useCallback((incoming) => {
    if (!incoming?.length) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        if (next.length >= MAX_FILES) break;
        next.push(f);
      }
      return next;
    });
  }, []);

  const onInputChange = (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const onDrop = (e) => {
    if (isSubmitting) return;
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const removeAt = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitMode = typeof onSubmitEvaluation === "function";

  const handlePrimary = async () => {
    const { screenshots: s, outputFiles: outs } = assignFilesToState(files);
    if (submitMode) {
      await onSubmitEvaluation(s, outs);
      return;
    }
    if (onApply) {
      onApply(s, outs);
      onClose();
    }
  };

  const canSubmitEvaluation = Boolean(recordingUrl?.trim());
  const primaryDisabled =
    isSubmitting || (submitMode && !canSubmitEvaluation);

  if (!mounted || !open) return null;

  const content = (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        id={SUBMIT_FILES_MODAL_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-busy={isSubmitting}
        aria-labelledby={isSubmitting ? evaluatingTitleId : titleId}
        className={cn(
          "submit-files-modal-panel relative flex w-full max-w-[480px] flex-col gap-[22px] rounded-calyptus bg-white p-[22px] shadow-calyptus-elevated",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-center text-xl font-semibold leading-[1.4] text-calyptus-strong"
        >
          Insert Files to Submit Test
        </h2>

        <div
          className={cn(
            "flex min-h-[199px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-calyptus-border-field bg-calyptus-surface-input px-8 py-7 transition-colors",
            dragOver && !isSubmitting && "border-calyptus-purple bg-calyptus-tint/80",
            files.length >= MAX_FILES && "pointer-events-none opacity-40",
            isSubmitting && "pointer-events-none opacity-50",
          )}
          onDragEnter={(e) => {
            if (isSubmitting) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (isSubmitting) return;
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
          }}
          onDragOver={(e) => {
            if (isSubmitting) return;
            e.preventDefault();
          }}
          onDrop={onDrop}
          onClick={() =>
            !isSubmitting && files.length < MAX_FILES && inputRef.current?.click()
          }
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            multiple
            accept={ACCEPT}
            onChange={onInputChange}
          />
          <UploadCloudIcon className="shrink-0 text-calyptus-body" />
          <div className="flex flex-col items-center gap-2.5 text-center">
            <p className="flex flex-wrap items-center justify-center gap-0.5 text-base font-medium text-calyptus-strong">
              <span className="font-bold text-calyptus-primary-green" aria-hidden>
                *
              </span>
              <span>Upload Output Files or drag & drop it here.</span>
            </p>
            <p className="text-sm text-calyptus-muted">
              screenshots/md/pdf (max. 4 uploads)
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap items-start justify-center gap-5",
              isSubmitting && "pointer-events-none opacity-50",
            )}
          >
            {files.map((file, index) => (
              <FilePreviewCard
                key={`${file.name}-${file.size}-${index}`}
                file={file}
                onRemove={() => removeAt(index)}
              />
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <Button
            type="button"
            variant="primary"
            className="min-w-[120px] rounded-xl px-4 py-2 text-sm font-bold"
            disabled={primaryDisabled}
            onClick={handlePrimary}
          >
            {isSubmitting
              ? "Evaluating…"
              : submitMode
                ? "Submit"
                : "Done"}
          </Button>
        </div>

        {isSubmitting && (
          <div
            className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-5 rounded-calyptus bg-white/95 p-8 text-center"
            role="status"
            aria-live="polite"
          >
            <div className={calyptus.spinnerMd} aria-hidden />
            <div>
              <h2
                id={evaluatingTitleId}
                className="text-xl font-bold text-calyptus-strong"
              >
                Evaluating…
              </h2>
              <p className="mt-2 text-sm leading-snug text-calyptus-body">
                Please wait while we process your submission. This may take a
                moment.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
