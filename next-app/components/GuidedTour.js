import { useState, useEffect } from 'react';

const tourSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Your Assessment!',
    content: 'This is a technical assessment that evaluates your problem-solving and communication skills.\n\nLet me guide you through the process step by step.',
    highlightElement: null,
    position: 'center'
  },
  {
    id: 'read-record',
    title: 'Step 2: Read & Start Recording',
    content: 'Read the assessment task carefully and click "Start Recording Now".\n\nMake sure you understand the requirements before you begin.',
    highlightElement: '.assessment-container',
    position: 'right'
  },
  {
    id: 'ai-assistant',
    title: 'Step 3: AI Assistant Usage',
    content: 'You can use the AI assistant (me!) at any time during the assessment.\n\nRemember: I will only provide guidance for specific questions and never give away the solution.\n\nJust like in a real-world interview, asking good questions adds to your score!',
    highlightElement: '.chat-section',
    position: 'left',
    unblurTarget: true
  },
  {
    id: 'screen-requirements',
    title: 'Step 4: Screen Requirements',
    content: 'You must share your entire screen for the duration of the assessment.\n\nFeel free to:\n• Open new tabs and windows\n• Use AI tools like ChatGPT, Claude, etc.\n• Access any applications you need\n\nEverything will be captured for review.',
    highlightElement: null,
    position: 'center'
  },
  {
    id: 'think-out-loud',
    title: 'Step 5: Think Out Loud',
    content: 'You must communicate your thoughts out loud throughout the assessment.\n\nExplain what you\'re doing and why you\'re doing it.\n\nThis is crucial for evaluation and significantly impacts your score.',
    highlightElement: null,
    position: 'center'
  },
  {
    id: 'submit-work',
    title: 'Step 6: Submit Your Work',
    content: 'When you\'re finished:\n\n1. Review your recording\n2. Add at least one project output (screenshot, PDF, MD, JSON, etc.)\n3. Press Submit\n\nThat\'s it! You\'ve officially crossed the finish line.',
    highlightElement: '.submit-form-section',
    position: 'top',
    unblurTarget: true
  }
];

export default function GuidedTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [highlightedElement, setHighlightedElement] = useState(null);
  
  // Draggable state - MUST be declared before any useEffect hooks
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(true);
  const [hasBeenDragged, setHasBeenDragged] = useState(false);
  
  // Set initial position on client side after mount
  useEffect(() => {
    // Only run on client side after component mounts
    if (typeof window !== 'undefined') {
      setModalPosition({
        x: window.innerWidth / 2, 
        y: Math.max(0, (window.innerHeight - 200) / 2) 
      });
    }
  }, []); // Empty dependency array - only runs once on mount

  // Separate animation effect that only runs once when tour starts
  useEffect(() => {
    if (isActive && isAnimating && typeof window !== 'undefined') {
      // Set initial position (bottom-mid) and trigger animation
      setModalPosition({
        x: window.innerWidth / 2, // Center horizontally (will be adjusted by transform)
        y: window.innerHeight + 100 // Start from below the screen
      });
      
      // Trigger bounce animation after a short delay
      setTimeout(() => {
        setModalPosition({
          x: window.innerWidth / 2, // Center horizontally
          y: Math.max(0, (window.innerHeight - 200) / 2) // Center vertically
        });
        setIsAnimating(false); // Animation complete
      }, 50);
    }
  }, [isActive]); // Only depend on isActive, not isAnimating

  useEffect(() => {
    if (isActive && typeof window !== 'undefined') {
      // Add tour-active class to body to override pointer-events and blur
      document.body.classList.add('tour-active');
      
      // Add small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        // First, remove any existing highlights
        const existingHighlights = document.querySelectorAll('.tour-highlight');
        existingHighlights.forEach(el => {
          el.classList.remove('tour-highlight');
        });
        
        if (tourSteps[currentStep].highlightElement) {
          const element = document.querySelector(tourSteps[currentStep].highlightElement);
          if (element) {
            setHighlightedElement(element);
            element.classList.add('tour-highlight');
            
            // Handle unblur functionality
            if (tourSteps[currentStep].unblurTarget) {
              // Remove blur from the target element
              element.style.filter = 'none';
              element.style.pointerEvents = 'auto';
              
              // Find and unblur child elements that might be blurred
              const blurredElements = element.querySelectorAll('.pointer-events-none.opacity-50.blur-sm');
              blurredElements.forEach(child => {
                // For step 6 (submit-work), unblur everything including submission form
                // For other steps, skip submission form elements to keep them disabled
                if (tourSteps[currentStep].id !== 'submit-work' && child.closest('.submit-form-section')) {
                  return; // Don't unblur submission form elements for non-submit steps
                }
                child.style.filter = 'none';
                child.style.pointerEvents = 'auto';
                child.style.opacity = '1';
              });
            }
            
            // Scroll element into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100); // 100ms delay
      
      return () => {
        clearTimeout(timer);
        
        // Remove tour-active class from body
        document.body.classList.remove('tour-active');
        
        // Remove all tour highlights
        const existingHighlights = document.querySelectorAll('.tour-highlight');
        existingHighlights.forEach(el => {
          el.classList.remove('tour-highlight');
        });
        
        if (highlightedElement) {
          highlightedElement.style.outline = '';
          highlightedElement.style.outlineOffset = '';
          highlightedElement.style.zIndex = '';
          highlightedElement.style.position = '';
          highlightedElement.style.filter = '';
          highlightedElement.style.pointerEvents = '';
          highlightedElement.style.backgroundColor = '';
          highlightedElement.style.borderRadius = '';
          
          // Restore blur for child elements if needed
          // But keep submission form disabled if it should be
          const blurredElements = highlightedElement.querySelectorAll('.pointer-events-none.opacity-50.blur-sm');
          blurredElements.forEach(child => {
            // For step 6 (submit-work), we unblurred everything, so restore everything
            // For other steps, skip submission form elements to keep them disabled
            if (tourSteps[currentStep].id !== 'submit-work' && child.closest('.submit-form-section')) {
              return; // Don't restore submission form elements for non-submit steps
            }
            child.style.filter = '';
            child.style.pointerEvents = '';
            child.style.opacity = '';
          });
        }
      };
    }
  }, [currentStep, isActive, highlightedElement]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Only reset position if modal hasn't been dragged by user
      if (!hasBeenDragged) {
        // Reset to center position
        if (typeof window !== 'undefined') {
          setModalPosition({
            x: window.innerWidth / 2,
            y: Math.max(0, (window.innerHeight - 200) / 2)
          });
        }
      }
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsActive(false);
    // Remove tour-active class from body
    document.body.classList.remove('tour-active');
    
    // Remove all tour highlights
    const existingHighlights = document.querySelectorAll('.tour-highlight');
    existingHighlights.forEach(el => {
      el.classList.remove('tour-highlight');
    });
    
    if (highlightedElement) {
      highlightedElement.style.outline = '';
      highlightedElement.style.outlineOffset = '';
      highlightedElement.style.zIndex = '';
      highlightedElement.style.position = '';
      highlightedElement.style.filter = '';
      highlightedElement.style.pointerEvents = '';
      highlightedElement.style.backgroundColor = '';
      highlightedElement.style.borderRadius = '';
      
      // Re-blur submission form elements when tour ends (if we're on step 6)
      if (tourSteps[currentStep].id === 'submit-work') {
        const submissionForm = highlightedElement.querySelector('.submit-form-section');
        if (submissionForm) {
          const blurredElements = submissionForm.querySelectorAll('.pointer-events-none.opacity-50.blur-sm');
          blurredElements.forEach(child => {
            // Restore the original blur state
            child.style.filter = '';
            child.style.pointerEvents = '';
            child.style.opacity = '';
          });
        }
      }
    }
    
    onComplete();
  };

  // Drag functionality - MUST be declared before useEffect hooks
  const handleMouseDown = (e) => {
    const modal = e.currentTarget.closest('.tour-modal');
    if (!modal) return;
    
    // Get the actual position including transform
    const rect = modal.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
    
    // Set the modal position to the actual pixel position (removing transform)
    setModalPosition({
      x: rect.left,
      y: rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || typeof window === 'undefined') return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep modal within viewport bounds
    const maxX = window.innerWidth - 400; // modal width
    const maxY = window.innerHeight - 200; // modal height
    
    setModalPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setHasBeenDragged(true); // Mark that the modal has been dragged
  };

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
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
          className={`tour-modal bg-white rounded-lg shadow-lg p-6 max-w-sm border border-gray-200 pointer-events-auto ${isDragging ? 'shadow-2xl scale-105' : ''} ${isAnimating ? 'bounce-in' : ''}`}
          style={{
            position: 'fixed',
            left: `${modalPosition.x}px`,
            top: `${modalPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : (isAnimating ? 'none' : 'all 0.2s ease'),
            transform: isDragging ? 'none' : (hasBeenDragged ? 'none' : 'translate(-50%, 0)')
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {currentTourStep.title}
            </h2>
            <p className="text-gray-600 whitespace-pre-line leading-relaxed">
              {currentTourStep.content}
            </p>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Step {currentStep + 1} of {tourSteps.length}
            </div>
            
            <div className="flex gap-2">
              {currentStep < tourSteps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Skip Tour
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {currentStep === tourSteps.length - 1 ? 'Start Assessment' : 'Next'}
              </button>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="mt-4 flex gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded ${
                  index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}