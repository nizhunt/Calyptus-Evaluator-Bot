import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import InhousePluginRecorder from "../components/InhousePluginRecorder";
import BufferedVideoPlayer from "../components/BufferedVideoPlayer";
import GuidedTour from "../components/GuidedTour";
import ReactMarkdown from "react-markdown";

const markdownComponents = {
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
  li: ({ node, ...props }) => <li className="pl-1" {...props} />,
  strong: ({ node, ...props }) => <span className="font-bold" {...props} />,
  a: ({ node, ...props }) => <a className="underline hover:text-blue-200 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
};

export default function Home() {
  const [assessmentQuestion, setAssessmentQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [screenshots, setScreenshots] = useState([null, null, null]);
  const [outputFile, setOutputFile] = useState(null);
  const [conversationFile, setConversationFile] = useState(null);
  const [isLocal, setIsLocal] = useState(false);
  const [isChatUnlocked, setIsChatUnlocked] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  const submitFormRef = useRef(null);
  const hasSentOpeningMessage = useRef(false);
  const activeFetchControllers = useRef(new Set());
  const router = useRouter();

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
            method: "POST",
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
  const [candidateData, setCandidateData] = useState({ name: '', email: '' });

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

  const handleRecorderVideoReady = ({ recordingId, playbackUrl, durationSeconds }) => {
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
          message: "The candidate has just started the assessment. Introduce yourself briefly in character as the stakeholder and let them know they can ask you clarifying questions about the requirements. Keep it to 1-2 sentences.",
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

  const handleSend = async () => {
    if (!input.trim() || !isChatUnlocked || isTyping) return;
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
          { sender: "bot", content: "Sorry, I couldn't process that. Please try again." },
        ]);
      }
    }
    activeFetchControllers.current.delete(controller);
    setIsTyping(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      String(Math.max(0, Number(recordingDurationSeconds) || 0))
    );
    formData.append("recorderId", recorderId || "");
    formData.append("customInstructions", customInstructions || "");

    // Add candidate data
    if (candidateData.name && candidateData.email) {
      formData.append("candidateName", candidateData.name);
      formData.append("candidateEmail", candidateData.email);
    }

    screenshots
      .filter((s) => s)
      .forEach((screenshot) => {
        formData.append(`screenshots`, screenshot);
      });
    if (outputFile) {
      formData.append("outputFile", outputFile);
    }

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

      // Keep sensitive data out of URL and pass it via session storage instead.
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
          })
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

  const handleTourComplete = (candidateData = {}) => {
    setShowTour(false);
    // Store candidate data for submission
    if (candidateData.name && candidateData.email) {
      setCandidateData(candidateData);
    }
  };

  const restartTour = () => {
    setShowTour(true);
  };

  return (
    <div className="container mx-auto min-h-screen flex flex-col p-6 bg-white text-gray-800">
      {showTour && <GuidedTour onComplete={handleTourComplete} initialCandidate={candidateData} />}
      <div className="logo-container mb-6 relative">
        <img
          src="/calyptus_new_logo.avif"
          alt="Calyptus Logo"
          className="h-16 mx-auto"
        />
        {isCustomTest && employerName && (
          <div className="text-center mt-2">
            <p className="text-sm text-gray-600">
              Assessment from:{" "}
              <span className="font-semibold text-blue-600">
                {employerName}
              </span>
            </p>
          </div>
        )}
        <button
          onClick={restartTour}
          className="absolute top-0 right-0 flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-colors duration-200 px-3 py-2 rounded-md hover:bg-gray-100 text-sm font-medium"
          title="Restart Tour"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Restart Tour
        </button>
      </div>
      <div className="flex flex-col md:flex-row gap-6 flex-1">
        <div className="question-section assessment-container flex flex-col bg-white p-6 rounded-lg shadow-md border border-gray-200 md:w-1/3">
          <label className="block text-lg font-semibold text-gray-700 mb-3">
            Assessment Task
          </label>
          <ul className="mb-3 list-disc pl-5 text-gray-600">
            <li>
              Read the task carefully and understand the requirements before
              starting.
            </li>
            <li>
              Use the AI Assistant for guidance if needed, and submit your work
              when ready.
            </li>
          </ul>
          <textarea
            value={assessmentQuestion}
            onChange={(e) =>
              !isCustomTest && setAssessmentQuestion(e.target.value)
            }
            className={`w-full flex-1 p-4 border-2 rounded-md mb-4 ${isCustomTest
              ? "border-blue-300 bg-blue-50 cursor-not-allowed"
              : "border-gray-300 focus:border-blue-500"
              }`}
            placeholder={
              isCustomTest
                ? "Assessment question loaded from custom link"
                : "(Auto-populates in Prod) Enter your assessment task or question here..."
            }
            readOnly={isCustomTest}
          />
          {isCustomTest && (
            <div className="text-xs text-blue-600 mb-4">
              ✓ This assessment question was provided by {employerName}
            </div>
          )}
          <InhousePluginRecorder
            onLifecycleUpdate={handleRecorderLifecycleUpdate}
            onVideoReady={handleRecorderVideoReady}
            onTranscriptReady={handleRecorderTranscriptReady}
            onError={handleRecorderError}
            hasPreviousRecording={hasStartedRecording}
          />
        </div>
        <div
          className={`chat-section flex-1 h-[500px] bg-white rounded-lg shadow-md border border-gray-200 flex flex-col mt-6 md:mt-0 relative ${!hasStartedRecording ? "pointer-events-none opacity-50 blur-sm" : ""
            }`}
        >
          <div className="chat-header p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg">
            <h2 className="text-xl font-semibold">AI Assistant</h2>
            <p className="text-sm">
              Ask questions about your assessment task and get helpful guidance
            </p>
          </div>
          <div
            ref={chatMessagesRef}
            className="chat-messages flex-1 min-h-0 p-6 overflow-y-auto flex flex-col gap-4"
          >
            {messages.length === 0 && !isTyping && (
              <div className="text-center p-12 text-purple-300">
                <div className="text-5xl mb-4 opacity-50">💬</div>
                <h3 className="text-lg font-semibold">Ready to help!</h3>
                <p>Ask me anything about your assessment task.</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message flex ${msg.sender === "user" ? "flex-row-reverse" : ""
                  } gap-3`}
              >
                <div
                  className={`message-avatar w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${msg.sender === "user"
                    ? "bg-gradient-to-r from-blue-500 to-purple-500"
                    : "bg-gray-400"
                    }`}
                >
                  {msg.sender[0].toUpperCase()}
                </div>

                <div
                  className={`message-content max-w-[70%] p-4 rounded-2xl shadow-md ${msg.sender === "user"
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                    : "bg-gray-50 text-gray-700 border border-gray-200"
                    } overflow-hidden`}
                >
                  <ReactMarkdown
                    components={{
                      ...markdownComponents,
                      // Adjust link color based on sender if needed, but white/gray text contrast handles most
                      a: ({ node, ...props }) => (
                        <a
                          className={`underline transition-colors ${msg.sender === "user" ? "hover:text-blue-100" : "text-blue-600 hover:text-blue-800"}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="typing-indicator flex items-center gap-2 p-4 bg-gray-100 rounded-2xl max-w-[120px]">
                <div className="typing-dots flex gap-1">
                  <div className="typing-dot w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce"></div>
                  <div className="typing-dot w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce [animation-delay:-0.16s]"></div>
                  <div className="typing-dot w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce [animation-delay:-0.32s]"></div>
                </div>
              </div>
            )}
          </div>
          <div className="chat-input-container p-6 border-t border-gray-200 bg-white rounded-b-lg">
            <div className="chat-input flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!isChatUnlocked}
                className={`flex-1 p-4 border-2 rounded-full resize-none min-h-[48px] max-h-[120px] text-gray-800 placeholder-gray-500 ${!isChatUnlocked
                  ? "border-gray-200 bg-gray-100 cursor-not-allowed"
                  : "border-gray-300 bg-white focus:border-blue-500"
                  }`}
                placeholder={
                  !isChatUnlocked
                    ? "Start recording to unlock chat..."
                    : "Ask a question about the project..."
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
                onClick={handleSend}
                disabled={!isChatUnlocked || isTyping}
                className={`send-button w-12 h-12 rounded-full text-white flex items-center justify-center ${!isChatUnlocked || isTyping
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  }`}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={submitFormRef}
        className={`submit-form-section p-8 bg-white rounded-lg shadow-md border border-gray-200 mt-6 relative`}
      >
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            {!hasCompletedRecording
              ? "Stop Recording and Insert Video to Submit Test"
              : "Please provide the required information for your test submission"}
          </h2>
          <div
            className={`${!hasCompletedRecording
              ? "pointer-events-none opacity-50 blur-sm"
              : ""
              }`}
          >
            {isLoading && (
              <div className="bg-white rounded-lg p-4 shadow-md mb-6">
                <h3 className="text-lg font-medium mb-2">
                  Processing Recording...
                </h3>
                <div className="flex items-center justify-center p-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              </div>
            )}
            {!isLoading && recordingUrl && hasCompletedRecording && (
              <div className="bg-white rounded-lg p-4 shadow-md mb-6">
                <BufferedVideoPlayer
                  src={recordingUrl}
                  knownDurationSeconds={recordingDurationSeconds}
                  className="w-full"
                />
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className={`grid grid-cols-1 gap-4 space-y-0 ${isLocal ? "md:grid-cols-2" : ""
                }`}
            >
              <div className={`space-y-4 ${isLocal ? "md:col-span-1" : ""}`}>
                <div className="form-group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 required">
                    Screenshots (Max 3)
                  </label>
                  <div className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <input
                        key={i}
                        type="file"
                        onChange={(e) => {
                          const newScreenshots = [...screenshots];
                          newScreenshots[i] = e.target.files[0];
                          setScreenshots(newScreenshots);
                        }}
                        className="w-full p-2 border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-pointer hover:border-blue-500 hover:shadow-md transition-all duration-200"
                        accept="image/*"
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Output File (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setOutputFile(e.target.files[0])}
                    className="w-full p-2 border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-pointer hover:border-blue-500 hover:shadow-md transition-all duration-200"
                  />
                </div>
              </div>
              {isLocal && (
                <div className="form-group md:col-span-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Only for Testing
                  </h3>
                  <div className="form-group">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Conversation Markdown File (Optional)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setConversationFile(e.target.files[0])}
                      className="w-full p-2 border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-pointer hover:border-blue-500 hover:shadow-md transition-all duration-200"
                      accept=".md,text/markdown"
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={loading || !recordingUrl}
                  className={`btn-primary px-6 py-3 text-white rounded-lg w-full mx-4 ${
                    loading || !recordingUrl
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  }`}
                >
                  {loading ? "Evaluating..." : !recordingUrl ? "Recording required to submit" : "Save Submission"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-white text-xl">Evaluating...</div>
        </div>
      )}
    </div>
  );
}
