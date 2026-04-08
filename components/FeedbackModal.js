import { useId } from "react";

import { Button } from "@/components/ui/button";
import StarRatingButton from "@/components/StarRatingButton";

export default function FeedbackModal({
  open,
  onClose,
  candidateEmail,
  setCandidateEmail,
  rating,
  setRating,
  comment,
  setComment,
  onSubmit,
  isSubmitting,
  validationError,
  setValidationError,
  feedbackSent,
}) {
  const formTitleId = useId();
  const emailId = useId();
  const commentId = useId();
  const ratingGroupId = useId();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={formTitleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] bg-white p-[30px] shadow-[0px_4px_10px_0px_rgba(16,24,40,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        {!feedbackSent ? (
          <form
            className="flex flex-col gap-[22px]"
            onSubmit={onSubmit}
            aria-labelledby={formTitleId}
            aria-busy={isSubmitting}
          >
            <div className="text-center">
              <h2
                id={formTitleId}
                className="text-[20px] font-bold leading-normal text-calyptus-strong"
              >
                Leave Feedback or Report{" "}
                <span className="block sm:inline">Any Issues:</span>
              </h2>
            </div>

            <div className="h-px w-full bg-calyptus-border-field" />

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5">
                <label
                  htmlFor={emailId}
                  className="text-xs font-normal leading-snug text-calyptus-body"
                >
                  <span
                    className="font-bold text-calyptus-primary-green"
                    aria-hidden
                  >
                    *
                  </span>{" "}
                  <span className="sr-only">required, </span>
                  Email
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-invalid={!!validationError}
                  value={candidateEmail}
                  onChange={(e) => {
                    setCandidateEmail(e.target.value);
                    if (validationError) setValidationError("");
                  }}
                  className="h-12 w-full rounded-md border border-solid border-calyptus-border-field bg-white px-3 text-sm text-calyptus-strong outline-none placeholder:text-calyptus-muted focus:border-calyptus-blue-deep focus:ring-1 focus:ring-calyptus-blue-deep/20 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-500/20"
                  placeholder="Enter your email"
                />
                {validationError && (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    {validationError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend
                    id={ratingGroupId}
                    className="mb-2.5 block w-full text-left text-xs font-normal leading-snug text-calyptus-body"
                  >
                    How do you rate this assessment?
                  </legend>
                  <div
                    className="flex items-center gap-1.5"
                    role="group"
                    aria-labelledby={ratingGroupId}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarRatingButton
                        key={star}
                        filled={star <= rating}
                        onClick={() => setRating(star)}
                        label={`Rate ${star} out of 5 stars`}
                      />
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-col gap-2.5">
                  <label
                    htmlFor={commentId}
                    className="text-xs font-normal leading-snug text-calyptus-body"
                  >
                    Additional comments (optional)
                  </label>
                  <textarea
                    id={commentId}
                    name="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[90px] w-full resize-y rounded-md border border-solid border-calyptus-border-field bg-white px-3 py-3 text-sm text-calyptus-strong outline-none placeholder:text-calyptus-muted focus:border-calyptus-blue-deep focus:ring-1 focus:ring-calyptus-blue-deep/20"
                    rows={3}
                    placeholder="Provide any context here"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-calyptus-border-field" />

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Button
                type="button"
                variant="modalDismiss"
                size="modal"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Dismiss
              </Button>
              <Button
                type="submit"
                variant="modalPrimary"
                size="modal"
                disabled={isSubmitting || !candidateEmail.trim()}
              >
                {isSubmitting ? "Sending…" : "Send Feedback"}
              </Button>
            </div>
          </form>
        ) : (
          <div
            className="flex flex-col items-center gap-4 py-2 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-calyptus-tint">
              <svg
                className="size-7 text-calyptus-primary-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-calyptus-body">
              Thanks for your feedback!
            </p>
            <Button
              type="button"
              variant="modalPrimaryQuiet"
              size="modal"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
