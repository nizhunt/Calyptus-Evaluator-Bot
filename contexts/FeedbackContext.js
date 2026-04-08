import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
} from "react";
import FeedbackModal from "../components/FeedbackModal";

const FeedbackContext = createContext();

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
}

export function FeedbackProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const extraContextRef = useRef({});

  const openFeedback = useCallback((opts = {}) => {
    const normalized = typeof opts === "string" ? { email: opts } : opts;
    extraContextRef.current = {
      candidateName: normalized.candidateName || "",
      email: normalized.email || "",
      creatorName: normalized.creatorName || "",
      creatorEmail: normalized.creatorEmail || "",
      evaluationId: normalized.evaluationId || "",
    };
    setCandidateEmail(extraContextRef.current.email);
    setRating(0);
    setComment("");
    setFeedbackSent(false);
    setValidationError("");
    setIsOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setRating(0);
      setComment("");
      setFeedbackSent(false);
      setValidationError("");
      extraContextRef.current = {};
    }, 300);
  }, []);

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setValidationError("");

    if (!candidateEmail.trim()) {
      setValidationError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateEmail.trim())) {
      setValidationError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      const ctx = extraContextRef.current;

      const evaluationUrl = ctx.evaluationId
        ? `${window.location.origin}/evaluation/${ctx.evaluationId}`
        : window.location.href;

      const payload = {
        evaluationUrl,
        evaluationData: {},
        metadata: {},
        testCreator: {
          name: ctx.creatorName,
          email: ctx.creatorEmail,
        },
        candidate: {
          name: ctx.candidateName,
          email: candidateEmail.trim(),
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

      if (ctx.evaluationId) {
        requests.push(
          fetch("/api/save-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evaluationId: ctx.evaluationId,
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

  return (
    <FeedbackContext.Provider value={{ openFeedback, closeFeedback }}>
      {children}
      <FeedbackModal
        open={isOpen}
        onClose={closeFeedback}
        candidateEmail={candidateEmail}
        setCandidateEmail={setCandidateEmail}
        rating={rating}
        setRating={setRating}
        comment={comment}
        setComment={setComment}
        onSubmit={handleFeedbackSubmit}
        isSubmitting={isSubmitting}
        validationError={validationError}
        setValidationError={setValidationError}
        feedbackSent={feedbackSent}
      />
    </FeedbackContext.Provider>
  );
}
