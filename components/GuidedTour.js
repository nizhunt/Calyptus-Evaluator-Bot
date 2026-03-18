import { useState, useEffect, useRef } from "react";

const tourSteps = [
  {
    id: "welcome",
    title: "Welcome to Your Assessment!",
    content:
      "This is a technical assessment that evaluates your problem-solving and communication skills.\n\nLet me guide you through the process step by step.",
    highlightElement: null,
    position: "center",
  },
  {
    id: "read-record",
    title: "Step 2: Read & Start Recording",
    content:
      'Read the assessment task carefully and click "Start Recording Now".\n\nMake sure you understand the requirements before you begin.',
    highlightElement: ".assessment-container",
    position: "right",
  },
  {
    id: "ai-assistant",
    title: "Step 3: AI Assistant Usage",
    content:
      "You can use the AI assistant (me!) at any time during the assessment.\n\nRemember: I will only provide guidance for specific questions and never give away the solution.\n\nJust like in a real-world interview, asking good questions adds to your score!",
    highlightElement: ".chat-section",
    position: "left",
    unblurTarget: true,
  },
  {
    id: "screen-requirements",
    title: "Step 4: Screen Share Requirements",
    content:
      "You must share your entire screen, video and audio for the duration of the assessment, so make sure to select all of these when you start to record.\n\nFeel free to:\n• Open new tabs and windows\n• Use AI tools like ChatGPT, Claude, etc.\n• Access any applications you need\n\nEverything will be captured for review.",
    highlightElement: null,
    position: "center",
  },
  {
    id: "think-out-loud",
    title: "Step 5: Think Out Loud",
    content:
      "You must communicate your thoughts out loud throughout the assessment.\n\nExplain what you're doing and why you're doing it.\n\nThis is crucial for evaluation and significantly impacts your score.",
    highlightElement: null,
    position: "center",
  },
  {
    id: "submit-work",
    title: "Step 6: Submit Your Work",
    content:
      "When you're finished:\n\n1. Review your recording\n2. Add at least one project output (screenshot, PDF, MD, JSON, etc.)\n3. Press Submit\n\nThat's it! You've officially crossed the finish line.",
    highlightElement: ".submit-form-section",
    position: "top",
    unblurTarget: true,
  },
  {
    id: "candidate-info",
    title: "Final Step: Your Information",
    content:
      "Please provide your name and email for evaluation tracking. This information is required to proceed.",
    highlightElement: null,
    position: "center",
    collectInfo: true,
  },
];

export default function GuidedTour({ onComplete, initialCandidate }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const savedStyles = useRef(new Map());

  // Candidate info state
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [isFormValid, setIsFormValid] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  // Draggable state - MUST be declared before any useEffect hooks
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const [hasBeenDragged, setHasBeenDragged] = useState(false);

  // Validation logic
  useEffect(() => {
    const nameValid = candidateName.trim().length >= 2;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail);

    setIsFormValid(nameValid && emailValid);

    // Set error messages
    if (candidateName && candidateName.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
    } else {
      setNameError("");
    }

    if (candidateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  }, [candidateName, candidateEmail]);

  // Prefill candidate info when restarting the tour (no persistence across reloads)
  useEffect(() => {
    if (initialCandidate) {
      if (typeof initialCandidate.name === "string") {
        setCandidateName(initialCandidate.name);
      }
      if (typeof initialCandidate.email === "string") {
        setCandidateEmail(initialCandidate.email);
      }
    }
  }, [initialCandidate]);

  // Set initial position on client side after mount
  useEffect(() => {
    // Only run on client side after component mounts
    if (typeof window !== "undefined") {
      setModalPosition({
        x: window.innerWidth / 2,
        y: Math.max(0, (window.innerHeight - 200) / 2),
      });
    }
  }, []); // Empty dependency array - only runs once on mount

  // Separate animation effect that only runs once when tour starts
  useEffect(() => {
    if (isActive && isAnimating && typeof window !== "undefined") {
      // Set initial position (bottom-mid) and trigger animation
      setModalPosition({
        x: window.innerWidth / 2, // Center horizontally (will be adjusted by transform)
        y: window.innerHeight + 100, // Start from below the screen
      });

      // Trigger bounce animation after a short delay
      setTimeout(() => {
        setModalPosition({
          x: window.innerWidth / 2, // Center horizontally
          y: Math.max(0, (window.innerHeight - 200) / 2), // Center vertically
        });
        setIsAnimating(false); // Animation complete
      }, 50);
    }
  }, [isActive]); // Only depend on isActive, not isAnimating

  useEffect(() => {
    if (isActive && typeof window !== "undefined") {
      // Add tour-active class to body to override pointer-events and blur
      document.body.classList.add("tour-active");

      // Add small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        // First, remove any existing highlights
        const existingHighlights = document.querySelectorAll(".tour-highlight");
        existingHighlights.forEach((el) => {
          el.classList.remove("tour-highlight");
        });

        if (tourSteps[currentStep].highlightElement) {
          const element = document.querySelector(
            tourSteps[currentStep].highlightElement
          );
          if (element) {
            setHighlightedElement(element);
            element.classList.add("tour-highlight");

            // Handle unblur functionality
            if (tourSteps[currentStep].unblurTarget) {
              // Save and override element styles
              savedStyles.current.set(element, {
                filter: element.style.filter,
                pointerEvents: element.style.pointerEvents,
              });
              element.style.filter = "none";
              element.style.pointerEvents = "auto";

              // Find and unblur child elements that might be blurred
              const blurredElements = element.querySelectorAll(
                ".pointer-events-none.opacity-50.blur-sm"
              );
              blurredElements.forEach((child) => {
                if (
                  tourSteps[currentStep].id !== "submit-work" &&
                  child.closest(".submit-form-section")
                ) {
                  return;
                }
                savedStyles.current.set(child, {
                  filter: child.style.filter,
                  pointerEvents: child.style.pointerEvents,
                  opacity: child.style.opacity,
                });
                child.style.filter = "none";
                child.style.pointerEvents = "auto";
                child.style.opacity = "1";
              });
            }

            // Scroll element into view
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }, 100); // 100ms delay

      return () => {
        clearTimeout(timer);

        // Remove tour-active class from body
        document.body.classList.remove("tour-active");

        // Remove all tour highlights
        const existingHighlights = document.querySelectorAll(".tour-highlight");
        existingHighlights.forEach((el) => {
          el.classList.remove("tour-highlight");
        });

        // Restore all saved inline styles
        for (const [el, styles] of savedStyles.current.entries()) {
          for (const [prop, value] of Object.entries(styles)) {
            el.style[prop] = value;
          }
        }
        savedStyles.current.clear();
      };
    }
  }, [currentStep, isActive, highlightedElement]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Only reset position if modal hasn't been dragged by user
      if (!hasBeenDragged) {
        // Reset to center position
        if (typeof window !== "undefined") {
          setModalPosition({
            x: window.innerWidth / 2,
            y: Math.max(0, (window.innerHeight - 200) / 2),
          });
        }
      }
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    // Remove tour-active class from body
    document.body.classList.remove("tour-active");

    // Remove all tour highlights
    const existingHighlights = document.querySelectorAll(".tour-highlight");
    existingHighlights.forEach((el) => {
      el.classList.remove("tour-highlight");
    });

    // Restore all saved inline styles
    for (const [el, styles] of savedStyles.current.entries()) {
      for (const [prop, value] of Object.entries(styles)) {
        el.style[prop] = value;
      }
    }
    savedStyles.current.clear();

    onComplete({ name: candidateName, email: candidateEmail });
  };

  // Drag functionality - MUST be declared before any useEffect hooks
  const handleMouseDown = (e) => {
    const modal = e.currentTarget.closest(".tour-modal");
    if (!modal) return;

    // Get the actual position including transform
    const rect = modal.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);

    // Set the modal position to the actual pixel position (removing transform)
    setModalPosition({
      x: rect.left,
      y: rect.top,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || typeof window === "undefined") return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep modal within viewport bounds
    const maxX = window.innerWidth - 400; // modal width
    const maxY = window.innerHeight - 200; // modal height

    setModalPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setHasBeenDragged(true); // Mark that the modal has been dragged
  };

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!isActive) return null;

  const currentTourStep = tourSteps[currentStep];

  return (
    <div className="tour-overlay fixed inset-0">
      {/* Dark overlay with spotlight effect - reduced to 15% opacity */}
      <div className="absolute inset-0 bg-black bg-opacity-15" />

      {/* Tour Modal */}
      <div className="tour-modal-wrapper fixed inset-0 pointer-events-none">
        <div
          className={`tour-modal bg-white rounded-lg shadow-lg p-6 max-w-sm border border-gray-200 pointer-events-auto ${
            isDragging ? "shadow-2xl scale-105" : ""
          } ${isAnimating ? "bounce-in" : ""}`}
          style={{
            position: "fixed",
            left: `${modalPosition.x}px`,
            top: `${modalPosition.y}px`,
            cursor: isDragging ? "grabbing" : "grab",
            transition: isDragging
              ? "none"
              : isAnimating
              ? "none"
              : "all 0.2s ease",
            transform: isDragging
              ? "none"
              : hasBeenDragged
              ? "none"
              : "translate(-50%, 0)",
          }}
          onMouseDown={handleMouseDown}
          role="dialog"
          aria-modal="true"
          aria-label={currentTourStep.title}
        >
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {currentTourStep.title}
            </h2>
            <p className="text-gray-600 whitespace-pre-line leading-relaxed">
              {currentTourStep.content}
            </p>
          </div>

          {/* Candidate Info Collection */}
          {currentTourStep.collectInfo && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    nameError ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your full name"
                  required
                />
                {nameError && (
                  <p className="text-red-500 text-sm mt-1">{nameError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    emailError ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your email address"
                  required
                />
                {emailError && (
                  <p className="text-red-500 text-sm mt-1">{emailError}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Step {currentStep + 1} of {tourSteps.length}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleNext}
                disabled={currentTourStep.collectInfo && !isFormValid}
                className={`px-4 py-2 rounded-md transition-colors ${
                  currentTourStep.collectInfo && !isFormValid
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {currentStep === tourSteps.length - 1
                  ? "Start Assessment"
                  : "Next"}
              </button>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mt-4 flex gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded ${
                  index <= currentStep ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
