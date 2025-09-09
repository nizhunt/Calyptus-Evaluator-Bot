import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import {
  useRecorderUtils,
  useRecorderEventCallback,
} from "@veltdev/react";
import VeltRecorder from "../components/VeltRecorder";

export default function Home() {
  const [assessmentQuestion, setAssessmentQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [recordingLink, setRecordingLink] = useState("");
  const [transcriptionLink, setTranscriptionLink] = useState("");
  const [screenshots, setScreenshots] = useState([null, null, null]);
  const [outputFile, setOutputFile] = useState(null);
  const [conversationFile, setConversationFile] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [isChatUnlocked, setIsChatUnlocked] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const loomButtonRef = useRef(null);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  const submitFormRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const local = window.location.hostname === "localhost";
    setIsLocal(local);
    setIsChatUnlocked(local);
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  const [hasCompletedRecording, setHasCompletedRecording] = useState(false);
  
  // Velt Recorder integration
  const recorderUtils = useRecorderUtils();
  const recordingStopped = useRecorderEventCallback("recordingStopped");
  const recordingDone = useRecorderEventCallback("recordingDone");
  
  useEffect(() => {
    if (recorderUtils) {
      recorderUtils.disableRecordingMic(); // Screen-only recording
    }
  }, [recorderUtils]);
  
  useEffect(() => {
    if (recordingStopped) {
      setIsChatUnlocked(true);
      setIsRecording(true);
      setHasStartedRecording(true);
    }
  }, [recordingStopped]);
  
  useEffect(() => {
    if (recordingDone) {
      setIsRecording(false);
      setHasCompletedRecording(true);
      // TODO: Implement retrieval of sharedUrl and transcript from Velt
      // Example: setRecordingUrl(`https://app.velt.dev/recorder/${recordingDone.recorderId}`);
      // Fetch transcript accordingly
    }
  }, [recordingDone]);

  const handleSend = async () => {
    if (!input.trim() || !isChatUnlocked) return;
    const newMessages = [...messages, { sender: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentQuestion, message: input }),
      });
      const data = await res.json();
      setMessages([...newMessages, { sender: "bot", content: data.response }]);
    } catch (error) {
      setMessages([
        ...newMessages,
        { sender: "bot", content: "Error: " + error.message },
      ]);
    }
    setIsTyping(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowModal(false);

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
    formData.append('assessmentQuestion', assessmentQuestion);
    formData.append('conversationContent', conversationContent);
    formData.append('transcript', transcript);
    formData.append('recordingUrl', recordingUrl);
    screenshots.filter(s => s).forEach((screenshot, index) => {
      formData.append(`screenshots`, screenshot);
    });
    if (outputFile) {
      formData.append('outputFile', outputFile);
    }

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      const saveRes = await fetch("/api/save-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { evaluation: data.evaluation, metadata: data.metadata } }),
      });
      const saveData = await saveRes.json();

      router.push(`/evaluation/${saveData.id}`);
    } catch (error) {
      alert("Error: " + error.message);
    }
    setLoading(false);
  };

  // Removed handleDownload function

  return (
    <div className="container mx-auto min-h-screen flex flex-col p-6 bg-white text-gray-800">
      <div className="logo-container mb-6">
        <img
          src="/calyptus_new_logo.avif"
          alt="Calyptus Logo"
          className="h-16 mx-auto"
        />
      </div>
      <div className="flex flex-col md:flex-row gap-6 flex-1">
        <div className="question-section flex flex-col bg-white p-6 rounded-lg shadow-md border border-gray-200 md:w-1/3">
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
            onChange={(e) => setAssessmentQuestion(e.target.value)}
            className="w-full flex-1 p-4 border-2 border-gray-300 rounded-md focus:border-blue-500 mb-4"
            placeholder="(Auto-populates in Prod) Enter your assessment task or question here..."
          />
          <VeltRecorder />
        </div>
        <div className={`chat-section flex-1 h-[500px] bg-white rounded-lg shadow-md border border-gray-200 flex flex-col mt-6 md:mt-0 relative ${!hasStartedRecording ? 'pointer-events-none opacity-50 blur-sm' : ''}`}>
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
                className={`message flex ${
                  msg.sender === "user" ? "flex-row-reverse" : ""
                } gap-3`}
              >
                <div
                  className={`message-avatar w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-500 to-purple-500"
                      : "bg-gray-400"
                  }`}
                >
                  {msg.sender[0].toUpperCase()}
                </div>
                <div
                  className={`message-content max-w-[70%] p-4 rounded-2xl shadow-md ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  {msg.content}
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
                className="flex-1 p-4 border-2 border-gray-300 rounded-full focus:border-blue-500 resize-none min-h-[48px] max-h-[120px] bg-white text-gray-800 placeholder-gray-500"
                placeholder="Ask a question about the project..."
                rows={1}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                className="send-button w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center hover:from-blue-600 hover:to-purple-600"
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
            Stop Recording and Insert Video to Submit Test
          </h2>
          <div className={`${!hasCompletedRecording ? 'pointer-events-none opacity-50 blur-sm' : ''}`}>
            <p className="text-sm text-gray-600 mb-6">
              Please provide the required information for your test submission
            </p>
            {recordingUrl && (
              <div className="form-group mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recorded Video Preview
                </label>
                <div className="relative max-w-md md:max-w-[33.6rem] mx-auto pb-[56.25%] h-0 overflow-hidden rounded-lg shadow-md">
                  <iframe
                    src={recordingUrl.replace("/share/", "/embed/")}
                    frameBorder="0"
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full"
                  ></iframe>
                </div>
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className={`grid grid-cols-1 gap-4 space-y-0 ${isLocal ? "md:grid-cols-2" : ""}`}
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
                  <div className="form-group mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 required">
                      Recording Link
                    </label>
                    <input
                      type="url"
                      value={recordingLink}
                      onChange={(e) => setRecordingLink(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-gray-800 placeholder-gray-500 shadow-sm hover:shadow-md transition-shadow duration-200"
                      placeholder="https://example.com/recording"
                    />
                  </div>
                  <div className="form-group mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 required">
                      Transcription Link
                    </label>
                    <input
                      type="url"
                      value={transcriptionLink}
                      onChange={(e) => setTranscriptionLink(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-gray-800 placeholder-gray-500 shadow-sm hover:shadow-md transition-shadow duration-200"
                      placeholder="https://example.com/transcription"
                    />
                  </div>
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
                  className="btn-primary px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 w-full mx-4"
                >
                  Save Submission
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
