import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import InhousePluginRecorder from "../components/InhousePluginRecorder";
import BufferedVideoPlayer from "../components/BufferedVideoPlayer";
import GuidedTour from "../components/GuidedTour";
import SubmitFilesModal from "../components/SubmitFilesModal";
import { Button } from "../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import { useFeedback } from "../contexts/FeedbackContext";
import { cn } from "@/lib/utils";
import { calyptus } from "@/lib/calyptus-ui";

/** Set true to show the bottom submit card (files + Save Submission). Submission is driven by SubmitFilesModal while false. */
const SHOW_LEGACY_SUBMIT_SECTION = false;

const markdownComponents = {
  p: ({ node, ...props }) => (
    <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />
  ),
  li: ({ node, ...props }) => <li className="pl-1" {...props} />,
  strong: ({ node, ...props }) => <span className="font-bold" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="underline hover:text-blue-200 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
};

export default function Home() {
  const { openFeedback } = useFeedback();
  const [assessmentQuestion, setAssessmentQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [screenshots, setScreenshots] = useState([null, null, null]);
  const [outputFiles, setOutputFiles] = useState([]);
  const [conversationFile, setConversationFile] = useState(null);
  const [submitFilesModalOpen, setSubmitFilesModalOpen] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [isChatUnlocked, setIsChatUnlocked] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  const submitFormRef = useRef(null);
  const autoOpenedSubmitModalForUrlRef = useRef(null);
  const hasSentOpeningMessage = useRef(false);
  const activeFetchControllers = useRef(new Set());
  const router = useRouter();

  const submissionFileCount =
    screenshots.filter(Boolean).length + outputFiles.length;

  // JWT Token handling states
  const [employerName, setEmployerName] = useState("");
  const [isCustomTest, setIsCustomTest] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current?.scrollHeight;
    }
  }, [messages, isTyping]);

  // Abort any in-flight fetch requests on unmount
  useEffect(() => {
    return () => {
      activeFetchControllers.current.forEach((c) => c.abort());
      activeFetchControllers.current.clear();
    };
  }, []);

  useEffect(() => {
    const local = window.location.hostname === "localhost";
    setIsLocal(local);
    setIsChatUnlocked(local);
  }, []);

  // JWT Token handling effect
  useEffect(() => {
    const controller = new AbortController();

    const handleJWTToken = async () => {
      const { token } = router.query;

      if (token) {
        try {
          // Validate and decode JWT token
          const response = await fetch("/api/validate-token", {
            _method: "POST",
            get method() {
              return this._method;
            },
            set method(value) {
              this._method = value;
            },
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json();
            setTokenData(data);
            setEmployerName(data.employerName);
            setAssessmentQuestion(data.question);
            setCustomInstructions(data.customInstructions || "");
            setIsCustomTest(true);
            if (data.emailId) {
              setCandidateData((prev) => ({
                ...prev,
                email: data.emailId,
              }));
            }
            // Make the assessment question read-only for custom tests
          } else {
            console.error("Invalid token");
            // Optionally redirect to error page or show error message
          }
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("Error validating token:", error);
          }
        }
      }
    };

    if (router.isReady) {
      handleJWTToken();
    }

    return () => controller.abort();
  }, [router.isReady, router.query]);

  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  const [hasCompletedRecording, setHasCompletedRecording] = useState(false);
  const [recorderId, setRecorderId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTour, setShowTour] = useState(true);
  const [candidateData, setCandidateData] = useState({ name: "", email: "" });

  const chatDisabled = !isChatUnlocked || !hasStartedRecording;

  const handleRecorderLifecycleUpdate = (nextState) => {
    if (nextState === "recording") {
      setIsChatUnlocked(true);
      setHasStartedRecording(true);
      setHasCompletedRecording(false);
      setIsLoading(false);
      setRecordingUrl("");
      setRecordingDurationSeconds(0);
      setTranscript("");
      setRecorderId(null);
      if (!hasSentOpeningMessage.current) {
        hasSentOpeningMessage.current = true;
        fetchOpeningMessage();
      }
      return;
    }

    if (["stopping", "uploading", "transcribing"].includes(nextState)) {
      setHasCompletedRecording(true);
      setIsLoading(true);
      return;
    }

    if (nextState === "video_ready") {
      setHasCompletedRecording(true);
      setIsLoading(false);
      return;
    }

    if (nextState === "error") {
      setIsLoading(false);
    }
  };

  const handleRecorderVideoReady = ({
    recordingId,
    playbackUrl,
    durationSeconds,
  }) => {
    setRecorderId(recordingId || null);
    setRecordingUrl(playbackUrl || "");
    setRecordingDurationSeconds(Math.max(0, Number(durationSeconds) || 0));
    setHasCompletedRecording(true);
    setIsLoading(false);
  };

  const handleRecorderTranscriptReady = ({ transcriptText }) => {
    setTranscript(transcriptText || "");
  };

  const handleRecorderError = (error) => {
    console.error("Recorder error:", error);
    setIsLoading(false);
  };

  const fetchOpeningMessage = async () => {
    const controller = new AbortController();
    activeFetchControllers.current.add(controller);
    setIsTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentQuestion,
          message:
            "The candidate has just started the assessment. Introduce yourself briefly in character as the stakeholder and let them know they can ask you clarifying questions about the requirements. Keep it to 1-2 sentences.",
          history: [],
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok && data.response) {
        setMessages([{ sender: "bot", content: data.response }]);
      }
    } catch {
      // Silent fail — not critical
    }
    activeFetchControllers.current.delete(controller);
    setIsTyping(false);
  };

  const runEvaluationSubmit = async (overrides = {}) => {
    const shot = overrides.screenshots ?? screenshots;
    const outs = overrides.outputFiles ?? outputFiles;

    setLoading(true);

    let conversationContent = messages
      .map((msg) => `**${msg.sender.toUpperCase()}:** ${msg.content}`)
      .join("\n\n");

    if (conversationFile) {
      const reader = new FileReader();
      reader.readAsText(conversationFile);
      conversationContent = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
      });
    }

    const formData = new FormData();
    formData.append("assessmentQuestion", assessmentQuestion);
    formData.append("conversationContent", conversationContent);
    formData.append("inhouseTranscript", transcript || "");
    formData.append("recordingUrl", recordingUrl);
    formData.append(
      "recordingDurationSeconds",
      String(Math.max(0, Number(recordingDurationSeconds) || 0)),
    );
    formData.append("recorderId", recorderId || "");
    formData.append("customInstructions", customInstructions || "");

    if (candidateData.name && candidateData.email) {
      formData.append("candidateName", candidateData.name);
      formData.append("candidateEmail", candidateData.email);
    }

    shot
      .filter((s) => s)
      .forEach((screenshot) => {
        formData.append(`screenshots`, screenshot);
      });
    outs.forEach((file) => {
      formData.append("outputFile", file);
    });

    const controller = new AbortController();
    activeFetchControllers.current.add(controller);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Evaluation failed. Please try again.");
      }

      const saveRes = await fetch("/api/save-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            evaluation: data.evaluation,
            metadata: {
              ...(data.metadata || {}),
              sourceTestId: tokenData?.id || "",
              is_test: !!tokenData?.is_test,
              companyName: tokenData?.employerName || "",
              testCreator: {
                name: tokenData?.employerName || "",
                email: tokenData?.emailId || "",
              },
              candidate: {
                name: candidateData.name || "",
                email: candidateData.email || "",
              },
              assessmentQuestion,
              customInstructions: customInstructions || "",
            },
          },
        }),
        signal: controller.signal,
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save evaluation.");
      }

      try {
        window.sessionStorage.setItem(
          "thankYouContext",
          JSON.stringify({
            candidateName: candidateData.name || "",
            candidateEmail: candidateData.email || "",
            creatorName: tokenData?.employerName || "",
            creatorEmail: tokenData?.emailId || "",
            sourceTestId: tokenData?.id || "",
            isTest: !!tokenData?.is_test,
            evaluationId: saveData.id || "",
            hasEmployer: !!(tokenData?.employerName || tokenData?.emailId),
          }),
        );
      } catch (storageError) {
        console.error("Unable to persist thank-you context:", storageError);
      }

      router.push("/thank-you");
    } catch (error) {
      if (error.name !== "AbortError") {
        alert("Error: " + error.message);
      }
    }
    activeFetchControllers.current.delete(controller);
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || chatDisabled || isTyping) {
      return;
    }
    const newMessages = [...messages, { sender: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    const controller = new AbortController();
    activeFetchControllers.current.add(controller);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentQuestion,
          message: input,
          history: newMessages.slice(-20),
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      setMessages([...newMessages, { sender: "bot", content: data.response }]);
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessages([
          ...newMessages,
          {
            sender: "bot",
            content: "Sorry, I couldn't process that. Please try again.",
          },
        ]);
      }
    }
    activeFetchControllers.current.delete(controller);
    setIsTyping(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runEvaluationSubmit();
  };

  useEffect(() => {
    if (SHOW_LEGACY_SUBMIT_SECTION) return;
    if (!recordingUrl || !hasCompletedRecording || isLoading || loading) {
      return;
    }
    if (autoOpenedSubmitModalForUrlRef.current === recordingUrl) return;
    autoOpenedSubmitModalForUrlRef.current = recordingUrl;
    setSubmitFilesModalOpen(true);
  }, [recordingUrl, hasCompletedRecording, isLoading, loading]);

  const handleTourComplete = (candidateData = {}) => {
    setShowTour(false);
    // Store candidate data for submission
    if (candidateData.name && candidateData.email) {
      setCandidateData(candidateData);
    }
  };

  const handleSubmitWorkStepEnter = useCallback(() => {
    setSubmitFilesModalOpen(true);
  }, []);

  const handleSubmitWorkStepLeave = useCallback(() => {
    setSubmitFilesModalOpen(false);
  }, []);

  const restartTour = () => {
    setShowTour(true);
  };

  return (
    <div className="bg-calyptus-tint">
      <div className="container mx-auto min-h-screen flex flex-col pt-10 p-6 text-gray-800">
        {showTour && (
          <GuidedTour
            onComplete={handleTourComplete}
            initialCandidate={candidateData}
            onSubmitWorkStepEnter={handleSubmitWorkStepEnter}
            onSubmitWorkStepLeave={handleSubmitWorkStepLeave}
          />
        )}
        <div className="logo-container mb-6 relative ">
          <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between md:gap-3">
            <Button
              type="button"
              variant="text"
              size="lg"
              onClick={restartTour}
              title="Restart Tour"
            >
              Restart Tour
            </Button>
            <img
              src="/calyptus_new_logo.avif"
              alt="Calyptus"
              className="h-[26px] w-auto md:h-8"
            />
            {/* temp removed */}
            <div />
            {/* <Button
              type="button"
              onClick={() => openFeedback()}
              variant="ghost"
              size="lg"
            >
              Leave Feedback
            </Button> */}
          </div>
          {/* {isCustomTest && employerName && (
            <div className="text-center mt-4 md:mt-3 pt-3 border-t border-gray-200/80">
              <p className="text-sm text-gray-600">
                Assessment from:{" "}
                <span className="font-semibold text-blue-600">
                  {employerName}
                </span>
              </p>
            </div>
          )} */}
        </div>

        <div
          className={cn(
            "question-section mb-[22px] w-full rounded-calyptus border border-calyptus-border-input bg-white p-3 shadow-sm",
          )}
        >
          {isCustomTest ? (
            <>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-2.5">
                <h2 className="shrink-0 text-lg font-semibold leading-[1.4] text-calyptus-strong">
                  Assessment Task:
                </h2>
                <p className="min-w-0 flex-1 text-lg font-semibold leading-[1.4] text-calyptus-purple">
                  {assessmentQuestion?.trim()
                    ? assessmentQuestion
                    : "Assessment question loaded from custom link"}
                </p>
              </div>
              {customInstructions?.trim() ? (
                <div className="mt-3 border-t border-calyptus-border-field pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-calyptus-muted">
                    Instructions
                  </p>
                  <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-calyptus-body">
                    {customInstructions}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3">
              <h2 className="shrink-0 text-lg font-semibold leading-[1.4] text-calyptus-strong">
                Assessment Task:
              </h2>
              <div className="min-w-0 flex-1">
                <textarea
                  value={assessmentQuestion}
                  onChange={(e) => setAssessmentQuestion(e.target.value)}
                  className={cn(
                    "w-full min-h-[80px] max-h-[200px] resize-y rounded-calyptus border border-solid border-calyptus-border-input bg-calyptus-surface-input px-4 py-3 text-xs font-medium leading-snug text-calyptus-strong outline-none transition-shadow placeholder:text-calyptus-muted focus:border-calyptus-purple focus-visible:ring-2 focus-visible:ring-calyptus-purple/25",
                  )}
                  placeholder="(Auto-populates in Prod) Enter your assessment task or question here..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Main row: recorder (flex) + AI sidebar */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-8">
          <div
            className={cn(
              "assessment-container flex min-h-[min(673px,70vh)] max-h-[85vh] w-full flex-1 flex-col overflow-hidden rounded-calyptus border border-calyptus-border-card bg-white p-3 shadow-sm lg:min-h-[673px] lg:max-h-[85vh]",
            )}
          >
            <InhousePluginRecorder
              onLifecycleUpdate={handleRecorderLifecycleUpdate}
              onVideoReady={handleRecorderVideoReady}
              onTranscriptReady={handleRecorderTranscriptReady}
              onError={handleRecorderError}
              hasPreviousRecording={hasStartedRecording}
            />
          </div>
          <div
            className={cn(
              "chat-section relative flex h-[min(673px,70vh)] max-h-[85vh] w-full min-h-0 flex-col overflow-hidden rounded-calyptus border border-calyptus-border-card bg-white shadow-sm lg:h-[min(673px,85vh)] lg:max-h-[85vh] lg:min-h-0 lg:w-[480px] lg:max-w-[480px] lg:shrink-0",
            )}
          >
            <div className="chat-header shrink-0 bg-calyptus-chat-header px-3 pb-3 pt-[22px] text-center text-white">
              <h2 className="text-lg font-semibold leading-[1.4]">
                AI Assistant
              </h2>
              <p className="mt-2.5 max-w-md mx-auto text-sm font-medium leading-[1.4] text-calyptus-subtle">
                Ask questions about your assessment task and get helpful
                guidance
              </p>
            </div>
            <div
              ref={chatMessagesRef}
              className="chat-messages flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-2.5 touch-pan-y"
            >
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center text-calyptus-muted">
                  <h3 className="text-lg font-semibold leading-[1.4] text-calyptus-strong">
                    Ready to help!
                  </h3>
                  <p className="mt-2.5 text-sm font-medium leading-[1.4] text-calyptus-body">
                    Ask me anything
                  </p>
                </div>
              )}
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message flex ${
                    msg.sender === "user" ? "flex-row-reverse" : ""
                  } gap-3`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      msg.sender === "user"
                        ? "bg-gradient-to-br from-calyptus-purple to-calyptus-blue-deep"
                        : "bg-calyptus-body"
                    }`}
                    aria-hidden
                  >
                    {msg.sender[0].toUpperCase()}
                  </div>
                  <div
                    className={
                      msg.sender === "user"
                        ? "max-w-[min(440px,92%)] bg-calyptus-tint rounded-tl-[30px] rounded-tr-[30px] rounded-bl-[30px] rounded-br-none px-[22px] py-[22px] text-[12px] font-medium leading-snug text-calyptus-strong"
                        : "max-w-full min-w-0 flex-1 py-3 text-[12px] font-medium leading-snug text-calyptus-body"
                    }
                  >
                    <ReactMarkdown
                      components={{
                        ...markdownComponents,
                        p: ({ node, ...props }) => (
                          <p
                            className="mb-2 last:mb-0 leading-snug text-[12px]"
                            {...props}
                          />
                        ),
                        a: ({ node, ...props }) => (
                          <a
                            className={`underline transition-colors ${
                              msg.sender === "user"
                                ? "text-calyptus-blue-deep hover:text-calyptus-purple"
                                : "text-calyptus-purple hover:text-calyptus-purple-muted"
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex w-full justify-start">
                  <div className="typing-indicator inline-flex items-center gap-2 rounded-2xl bg-calyptus-surface-input border border-calyptus-border-input px-4 py-3">
                    <div className="typing-dots flex gap-1">
                      <div className="typing-dot size-2 rounded-full bg-calyptus-purple animate-bounce" />
                      <div className="typing-dot size-2 rounded-full bg-calyptus-purple animate-bounce [animation-delay:-0.16s]" />
                      <div className="typing-dot size-2 rounded-full bg-calyptus-purple animate-bounce [animation-delay:-0.32s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="chat-input-container flex shrink-0 flex-col gap-[22px] rounded-b-calyptus bg-white px-3 pb-[22px] pt-1">
              {!hasStartedRecording ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex w-full justify-center">
                      <div
                        className={cn(
                          "chat-input flex w-full max-w-full gap-2 items-center",
                          "cursor-not-allowed",
                        )}
                      >
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          disabled={chatDisabled}
                          className={cn(
                            "min-h-[48px] font-normal max-h-[120px] flex-1 resize-none rounded-calyptus border border-solid px-4 py-2.5 text-base leading-[1.4] text-calyptus-strong outline-none transition-shadow placeholder:text-calyptus-muted focus-visible:ring-2 focus-visible:ring-calyptus-purple/30",
                            chatDisabled
                              ? "cursor-not-allowed border-calyptus-border-input bg-calyptus-surface-input opacity-80"
                              : "border-calyptus-border-input bg-calyptus-surface-input focus:border-calyptus-purple",
                          )}
                          placeholder={
                            chatDisabled
                              ? "Start recording to unlock chat..."
                              : "Type question here"
                          }
                          rows={1}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSend}
                          disabled={chatDisabled || isTyping}
                          className={`send-button size-10 shrink-0 rounded-full text-white flex items-center justify-center transition-opacity ${
                            chatDisabled || isTyping
                              ? "bg-calyptus-subtle cursor-not-allowed"
                              : "bg-calyptus-purple hover:bg-calyptus-purple-hover active:scale-[0.98]"
                          }`}
                          aria-label="Send message"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="max-w-[260px]"
                  >
                    Start recording to ask the AI assistant questions about your
                    task.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex w-full justify-center">
                  <div className="chat-input flex w-full max-w-full gap-2 items-center">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={chatDisabled}
                      className={cn(
                        "min-h-[48px] max-h-[120px] flex-1 resize-none rounded-calyptus border border-solid px-4 py-2.5 text-base leading-[1.4] text-calyptus-strong outline-none font-normal transition-shadow placeholder:text-calyptus-muted focus-visible:ring-2 focus-visible:ring-calyptus-purple/30",
                        chatDisabled
                          ? "cursor-not-allowed border-calyptus-border-input bg-calyptus-surface-input opacity-80"
                          : "border-calyptus-border-input bg-calyptus-surface-input focus:border-calyptus-purple",
                      )}
                      placeholder={
                        chatDisabled
                          ? "Start recording to unlock chat..."
                          : "Type question here"
                      }
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={chatDisabled || isTyping}
                      className={`send-button size-10 shrink-0 rounded-full text-white flex items-center justify-center transition-opacity ${
                        chatDisabled || isTyping
                          ? "bg-calyptus-subtle cursor-not-allowed"
                          : "bg-calyptus-purple hover:bg-calyptus-purple-hover active:scale-[0.98]"
                      }`}
                      aria-label="Send message"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="flex w-full max-w-full flex-col items-center gap-[22px] self-center border-t border-calyptus-border-field pt-[22px]">
                <p className="text-center text-sm font-semibold leading-[1.4] text-calyptus-purple px-2">
                  Remember to communicate out loud your thinking process!
                </p>
              </div>
            </div>
          </div>
        </div>
        {SHOW_LEGACY_SUBMIT_SECTION ? (
          <div
            ref={submitFormRef}
            className={cn(
              "submit-form-section relative mt-6 p-6 md:p-8",
              calyptus.cardSurface,
            )}
          >
            <div>
              <h2 className={calyptus.sectionTitleSubmit}>
                {!hasCompletedRecording
                  ? "Stop Recording and Insert Video to Submit Test"
                  : "Please provide the required information for your test submission"}
              </h2>
              <div
                className={`${
                  !hasCompletedRecording
                    ? "pointer-events-none opacity-50 blur-sm"
                    : ""
                }`}
              >
                {isLoading && (
                  <div className={calyptus.processingPanel}>
                    <h3 className="mb-3 text-base font-semibold text-calyptus-strong">
                      Processing recording...
                    </h3>
                    <div className="flex items-center justify-center py-4">
                      <div className={calyptus.spinnerSm} aria-hidden />
                    </div>
                  </div>
                )}
                {!isLoading && recordingUrl && hasCompletedRecording && (
                  <div className={calyptus.videoPanel}>
                    <BufferedVideoPlayer
                      src={recordingUrl}
                      knownDurationSeconds={recordingDurationSeconds}
                      className="w-full"
                    />
                  </div>
                )}
                <form
                  onSubmit={handleSubmit}
                  className={`grid grid-cols-1 gap-4 space-y-0 ${
                    isLocal ? "md:grid-cols-2" : ""
                  }`}
                >
                  <div
                    className={`space-y-4 ${isLocal ? "md:col-span-1" : ""}`}
                  >
                    <div className="form-group">
                      <label className={calyptus.labelFormRequired}>
                        Submission files
                      </label>
                      <p className="mb-3 text-xs leading-snug text-calyptus-body">
                        Up to 3 screenshots and 1 optional output file (images,
                        PDF, or markdown).
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setSubmitFilesModalOpen(true)}
                      >
                        {submissionFileCount > 0
                          ? `Edit files (${submissionFileCount})`
                          : "Insert files to submit"}
                      </Button>
                      {submissionFileCount > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-calyptus-muted">
                          {screenshots.map(
                            (f, i) =>
                              f && (
                                <li key={`ss-${i}`} className="truncate">
                                  {f.name}
                                </li>
                              ),
                          )}
                          {outputFiles.map((f, i) => (
                            <li key={`out-${i}-${f.name}`} className="truncate">
                              {f.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {isLocal && (
                    <div className="form-group md:col-span-1">
                      <h3 className="mb-4 text-lg font-semibold text-calyptus-strong">
                        Only for Testing
                      </h3>
                      <div className="form-group">
                        <label className={calyptus.labelForm}>
                          Conversation Markdown File (Optional)
                        </label>
                        <input
                          type="file"
                          onChange={(e) =>
                            setConversationFile(e.target.files[0])
                          }
                          className={calyptus.fileInput}
                          accept=".md,text/markdown"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex w-full justify-end md:col-span-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="submit"
                      disabled={loading || !recordingUrl}
                      className="max-w-md"
                    >
                      {loading
                        ? "Evaluating..."
                        : !recordingUrl
                          ? "Recording required to submit"
                          : "Save Submission"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={submitFormRef}
            className="submit-form-section mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            {hasCompletedRecording &&
              recordingUrl &&
              !isLoading &&
              !loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubmitFilesModalOpen(true)}
                >
                  {submissionFileCount > 0
                    ? `Edit files & submit (${submissionFileCount})`
                    : "Open submission"}
                </Button>
              )}
          </div>
        )}
        <SubmitFilesModal
          open={submitFilesModalOpen}
          onClose={() => !loading && setSubmitFilesModalOpen(false)}
          screenshots={screenshots}
          outputFiles={outputFiles}
          recordingUrl={recordingUrl}
          isSubmitting={loading}
          onApply={
            SHOW_LEGACY_SUBMIT_SECTION
              ? (s, outs) => {
                  setScreenshots(s);
                  setOutputFiles(outs);
                }
              : undefined
          }
          onSubmitEvaluation={
            SHOW_LEGACY_SUBMIT_SECTION
              ? undefined
              : async (s, outs) => {
                  setScreenshots(s);
                  setOutputFiles(outs);
                  await runEvaluationSubmit({
                    screenshots: s,
                    outputFiles: outs,
                  });
                }
          }
        />
      </div>
    </div>
  );
}
