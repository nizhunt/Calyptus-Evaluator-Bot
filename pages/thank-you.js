import { useRouter } from "next/router";
import { useEffect, useState, useId } from "react";
import { cn } from "@/lib/utils";
import { calyptus } from "@/lib/calyptus-ui";
import StarRatingButton from "../components/StarRatingButton";
import { Button } from "@/components/ui/button";

export default function ThankYou() {
  const router = useRouter();
  const ratingGroupId = useId();
  const commentId = useId();
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [evaluationId, setEvaluationId] = useState("");
  const [hasEmployer, setHasEmployer] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setValidationError("");
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      setValidationError(
        "Rating is required — please choose a score from 1 to 5 stars.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const evaluationUrl = evaluationId
        ? `${window.location.origin}/evaluation/${evaluationId}`
        : "";

      const payload = {
        evaluationUrl,
        evaluationData: {},
        metadata: {},
        testCreator: {
          name: creatorName,
          email: creatorEmail || "",
        },
        candidate: {
          name: candidateName,
          email: candidateEmail || "",
        },
        rating,
        comment: comment.trim(),
        timestamp: new Date().toISOString(),
      };

      const requests = [];

      if (process.env.NEXT_PUBLIC_FEEDBACK_API_URL) {
        requests.push(
          fetch(process.env.NEXT_PUBLIC_FEEDBACK_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        );
      }

      if (evaluationId) {
        requests.push(
          fetch("/api/save-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evaluationId,
              rating,
              comment: comment.trim(),
            }),
          }),
        );
      }

      const results = await Promise.allSettled(requests);

      const hasFailure = results.some(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value && !result.value.ok),
      );

      if (hasFailure) {
        setValidationError("Failed to send feedback. Please try again.");
        return;
      }

      setFeedbackSent(true);
    } catch (error) {
      console.error("Feedback submission error:", error);
      setValidationError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    let hasStoredData = false;

    try {
      const raw = window.sessionStorage.getItem("thankYouContext");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.candidateName) setCandidateName(parsed.candidateName);
        if (parsed?.candidateEmail) setCandidateEmail(parsed.candidateEmail);
        if (parsed?.creatorName) setCreatorName(parsed.creatorName);
        if (parsed?.creatorEmail) setCreatorEmail(parsed.creatorEmail);
        if (parsed?.evaluationId) setEvaluationId(parsed.evaluationId);
        if (parsed?.hasEmployer !== undefined)
          setHasEmployer(parsed.hasEmployer);
        hasStoredData = true;
      }
    } catch (error) {
      console.error("Unable to read thank-you context:", error);
    }

    if (!hasStoredData) {
      const {
        name,
        email,
        creator,
        creatorEmail: creatorEmailFromQuery,
        evaluation,
      } = router.query;

      if (typeof name === "string") setCandidateName(decodeURIComponent(name));
      if (typeof email === "string")
        setCandidateEmail(decodeURIComponent(email));
      if (typeof creator === "string")
        setCreatorName(decodeURIComponent(creator));
      if (typeof creatorEmailFromQuery === "string") {
        setCreatorEmail(decodeURIComponent(creatorEmailFromQuery));
      }
      if (typeof evaluation === "string")
        setEvaluationId(decodeURIComponent(evaluation));
    }
  }, [router.isReady, router.query]);

  return (
    <div className="flex min-h-screen items-center justify-center flex-col bg-calyptus-tint">
      <header className="shrink-0 px-4 pt-10 pb-2 md:px-16">
        <a
          href="https://calyptus.co"
          className="inline-block opacity-90 transition-opacity hover:opacity-100"
          aria-label="Go to Calyptus homepage"
        >
          <img
            src="/calyptus_new_logo.avif"
            alt="Calyptus"
            className="h-[26px] w-auto md:h-8"
          />
        </a>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-6 md:px-8">
        <div
          className={cn(
            "flex w-full max-w-[640px] flex-col items-center gap-8 rounded-[30px] bg-white px-[30px] py-12 shadow-calyptus-elevated md:py-[50px]",
          )}
        >
          <div className="flex w-full flex-col gap-4 text-center">
            <h1 className="text-[32px] font-bold leading-[1.4] text-calyptus-strong md:text-[40px]">
              Thank You!
            </h1>
            <p className="text-base font-medium leading-[1.4] text-calyptus-strong">
              {candidateName ? `Thanks ${candidateName},` : "Thanks!"} Your test
              has been forwarded to {creatorName || "the test creator"}.
            </p>
          </div>

          <div
            className={cn(
              "w-full max-w-[510px] rounded-calyptus border border-calyptus-border-card bg-calyptus-tint/60 px-5 py-4",
            )}
          >
            <p className="text-center text-base font-medium leading-[1.4] text-calyptus-strong">
              Your assessment has been submitted successfully. The evaluation
              team will review your submission and contact you if needed.
            </p>
          </div>

          {!hasEmployer && evaluationId && (
            <div
              className={cn(
                "w-full max-w-[510px] rounded-calyptus border border-calyptus-border-card bg-calyptus-tint/60 px-5 py-4",
              )}
            >
              <p className="mb-2 text-center text-base font-semibold leading-[1.4] text-calyptus-strong">
                Your evaluation results are ready
              </p>
              <a
                href={`/evaluation/${evaluationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-base font-medium text-calyptus-blue-deep underline decoration-calyptus-blue-deep/30 underline-offset-2 transition-colors hover:text-calyptus-purple"
              >
                View your evaluation report
              </a>
            </div>
          )}

          <div className="w-full max-w-[510px]">
            {!feedbackSent ? (
              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col gap-8"
                aria-busy={isSubmitting}
              >
                {validationError && (
                  <div
                    className="rounded-calyptus border border-red-200 bg-red-50 p-3 text-center"
                    role="alert"
                  >
                    <p className="text-sm text-red-600">{validationError}</p>
                  </div>
                )}

                <div className="flex w-full flex-col gap-4">
                  <div className="flex w-full flex-col gap-4">
                    <fieldset
                      className="m-0 min-w-0 border-0 p-0"
                      aria-required="true"
                    >
                      <legend
                        id={ratingGroupId}
                        className={cn(
                          calyptus.legendForm,
                          "mb-3 text-center text-base font-medium text-calyptus-strong",
                        )}
                      >
                        How do you rate this assessment?{" "}
                        <span
                          className="text-calyptus-primary-green"
                          aria-hidden
                        >
                          *
                        </span>
                      </legend>
                      <div
                        className="flex items-center justify-center gap-1.5"
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

                    <div className="flex w-full flex-col gap-2.5">
                      <label
                        htmlFor={commentId}
                        className={cn(
                          calyptus.labelModal,
                          "text-center text-base font-medium text-calyptus-strong",
                        )}
                      >
                        Additional comments (optional)
                      </label>
                      <textarea
                        id={commentId}
                        name="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className={calyptus.fieldTextarea}
                        rows={3}
                        placeholder="Provide any context here"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div className={cn(calyptus.divider, "max-w-full")} />

                <div className="flex w-full flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="modalDismiss"
                    size="modal"
                    className="rounded-xl px-4 py-2 text-base font-bold"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    Dismiss
                  </Button>
                  <Button
                    type="submit"
                    variant="modalPrimary"
                    size="modal"
                    className="rounded-xl px-4 py-2 text-lg font-bold shadow-none"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending…" : "Send Feedback"}
                  </Button>
                </div>
              </form>
            ) : (
              <div
                className="flex flex-col items-center gap-8 py-2 text-center"
                role="status"
                aria-live="polite"
              >
                <p className="text-lg font-semibold leading-[1.4] text-calyptus-strong">
                  Thanks for your feedback!
                </p>
                <Button variant="primary" size="lg">
                  <a
                    href="https://app.calyptus.co/profile"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    My Profile
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
