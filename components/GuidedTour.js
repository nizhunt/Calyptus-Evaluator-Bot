import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from "react";
import { createPortal, flushSync } from "react-dom";
import Joyride, { EVENTS, STATUS } from "react-joyride";

import { Button } from "@/components/ui/button";
import { calyptus } from "@/lib/calyptus-ui";
import { cn } from "@/lib/utils";
import { SUBMIT_FILES_MODAL_PANEL_ID } from "./SubmitFilesModal";

/** Avoid SSR warning: `useLayoutEffect` is a no-op on the server. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const SUBMIT_FILES_MODAL_TARGET = `#${SUBMIT_FILES_MODAL_PANEL_ID}`;

/** Config-only steps (Joyride steps are built in the component). */
const tourSteps = [
  {
    id: "welcome",
    title: "Welcome to Your Assessment",
    content:
      "This is an AI Fluency assessment that evaluates your AI skills, problem solving ability and communication skills.\n\nLet me guide you through the process step by step.",
    highlightElement: null,
    position: "center",
  },
  {
    id: "read-record",
    title: "Read & Start Recording",
    content:
      "Read the assessment task carefully and click “Start Recording Now”.\n\nMake sure you understand the requirements before you begin.",
    highlightElement: ".assessment-container",
    position: "right",
  },
  {
    id: "ai-assistant",
    title: "AI Assistant Usage",
    content:
      "You can use the AI assistant (me!) at any time during the assessment.\n\nRemember: I will only provide guidance for specific questions and never give away the solution.\n\nJust like in a real-world interview, asking good questions adds to your score!",
    highlightElement: ".chat-section",
    position: "left",
    unblurTarget: true,
  },
  {
    id: "screen-requirements",
    title: "Screen Share Requirements",
    content:
      "You must share your entire screen, video and audio for the duration of the assessment, so make sure to select all of these when you start to record.\n\nFeel free to:\n• Open new tabs and windows\n• Use AI tools like ChatGPT, Claude, etc.\n• Access any applications you need\n\nEverything will be captured for review.",
    figmaBody: {
      intro:
        "You must share your entire screen, video and audio for the duration of the assessment, so make sure to select all of these when you start to record.",
      listTitle: "Feel free to:",
      items: [
        "Open new tabs and windows.",
        "Use AI tools like ChatGPT, Claude, etc.",
        "Access any applications you need.",
      ],
      outro: "Everything will be captured for review.",
    },
    cardTooltipWidth: 400,
    highlightElement: null,
    position: "center",
  },
  {
    id: "think-out-loud",
    title: "Think Out Loud",
    content:
      "You must communicate your thoughts out loud throughout the assessment.\n\nExplain what you’re doing and why you’re doing it.\n\nThis is crucial for evaluation and significantly impacts your score.",
    highlightElement: null,
    position: "center",
  },
  {
    id: "submit-work",
    title: "Submit Your Work",
    content:
      "When you’re finished:\n\n1. Add at least one project output (screenshots, PDF, MD, JSON, etc.)\n2. Press Submit.\n\nThat’s it! Your assessment will be processed and will appear on your Interviews tab within 15 minutes!",
    primaryButtonLabel: "Next",
    figmaBody: {
      intro: "When you’re finished:",
      orderedItems: [
        "Add at least one project output (screenshots, PDF, MD, JSON, etc.)",
        "Press Submit.",
      ],
      outro:
        "That’s it! Your assessment will be processed and will appear on your Interviews tab within 15 minutes!",
    },
    cardTooltipWidth: 400,
    highlightElement: SUBMIT_FILES_MODAL_TARGET,
    position: "right",
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

const CENTER_TARGET_ID = "guided-tour-center-target";

const SUBMIT_WORK_STEP_INDEX = tourSteps.findIndex(
  (s) => s.id === "submit-work",
);
const CANDIDATE_INFO_STEP_INDEX = tourSteps.findIndex(
  (s) => s.id === "candidate-info",
);

function resolveTourHighlightElement(step) {
  if (!step?.highlightElement) return null;
  return document.querySelector(step.highlightElement);
}

function applyStepDomEffects(stepIndex, savedStyles) {
  const step = tourSteps[stepIndex];
  const element = resolveTourHighlightElement(step);
  if (!element) return;

  element.classList.add("tour-highlight");

  if (step.unblurTarget) {
    savedStyles.set(element, {
      filter: element.style.filter,
      opacity: element.style.opacity,
    });
    element.style.filter = "none";
    element.style.opacity = "1";

    const blurredElements = element.querySelectorAll(
      ".pointer-events-none.opacity-50.blur-sm",
    );
    blurredElements.forEach((child) => {
      if (step.id !== "submit-work" && child.closest(".submit-form-section")) {
        return;
      }
      savedStyles.set(child, {
        filter: child.style.filter,
        opacity: child.style.opacity,
      });
      child.style.filter = "none";
      child.style.opacity = "1";
    });
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Escape Joyride/floater transforms so `fixed` truly centers in the viewport. */
function tourModalPortal(node) {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

function clearTourDom(savedStyles) {
  document.querySelectorAll(".tour-highlight").forEach((el) => {
    el.classList.remove("tour-highlight");
  });
  for (const [el, styles] of savedStyles.entries()) {
    for (const [prop, value] of Object.entries(styles)) {
      el.style[prop] = value;
    }
  }
  savedStyles.clear();
}

/**  “Main Content” block: step + progress, title, body, Next (shared by arrow + card tooltips). */
function TourStepCard({
  step,
  index,
  size,
  progressPct,
  primaryLabel,
  onNext,
  className,
}) {
  return (
    <div
      className={cn(
        "tour-step-card relative z-[1] flex w-full flex-col gap-3 px-3 py-2 text-left",
        className,
      )}
    >
      <div className="flex w-full items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm leading-[18px] text-[#898D8B]">
          <span>Step</span>
          <span>
            {index + 1}/{size}
          </span>
        </div>
        <div className="relative h-0.5 min-h-px min-w-0 flex-1 rounded-full bg-calyptus-border-field">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-calyptus-purple"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      {step.title != null && (
        <h2 className="text-base font-bold leading-normal text-calyptus-strong">
          {step.title}
        </h2>
      )}
      {step.data?.figmaBody ? (
        <div className="w-full min-w-0 text-sm font-medium leading-normal text-calyptus-strong">
          {step.data.figmaBody.orderedItems ? (
            <>
              <p className="whitespace-pre-wrap">{step.data.figmaBody.intro}</p>
              <div className="h-3 shrink-0" aria-hidden />
              <ol className="mb-0 mt-0 list-decimal ps-[21px] marker:text-calyptus-strong">
                {step.data.figmaBody.orderedItems.map((item, i) => (
                  <li key={i}>
                    <span className="leading-normal">{item}</span>
                  </li>
                ))}
              </ol>
              <div className="h-6 shrink-0" aria-hidden />
              <p className="whitespace-pre-wrap">{step.data.figmaBody.outro}</p>
            </>
          ) : (
            <>
              <p className="whitespace-pre-wrap">{step.data.figmaBody.intro}</p>
              <div className="h-3 shrink-0" aria-hidden />
              <p className="whitespace-pre-wrap">
                {step.data.figmaBody.listTitle}
              </p>
              <ul className="mb-0 mt-0 list-disc ps-[21px] marker:text-calyptus-strong">
                {step.data.figmaBody.items.map((item, i) => (
                  <li key={i}>
                    <span className="leading-normal">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="h-3 shrink-0" aria-hidden />
              <p className="whitespace-pre-wrap">{step.data.figmaBody.outro}</p>
            </>
          )}
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm font-medium leading-normal text-calyptus-strong">
          {step.content}
        </p>
      )}
      <div className="flex w-full justify-end">
        <Button
          type="button"
          variant="modalPrimary"
          size="modal"
          className="rounded-xl px-4 py-2 text-xs font-bold leading-[1.4]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNext(e);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

const GuidedTourTooltipContext = createContext(null);

/** Stable component identity for Joyride — avoids remounting inputs on each keystroke. */
function GuidedTourJoyrideTooltip(props) {
  const ctx = useContext(GuidedTourTooltipContext);
  if (!ctx) return null;

  const {
    candidateName,
    setCandidateName,
    candidateEmail,
    setCandidateEmail,
    candidateNameId,
    candidateEmailId,
    nameError,
    emailError,
    isFormValid,
    onSubmitWorkStepEnter,
  } = ctx;

  const { index, isLastStep, size, step, tooltipProps, primaryProps } = props;
  const collectInfo = Boolean(step.data?.collectInfo);
  const isWelcome = Boolean(step.data?.welcomeLayout);
  const isCenteredModalTooltip = Boolean(step.data?.centeredModalTooltip);
  const isArrowTooltip = Boolean(step.data?.arrowTooltip);
  const cardTooltipMaxPx = step.data?.cardTooltipWidth ?? 320;
  const cardTooltipMinPx = cardTooltipMaxPx > 320 ? 280 : 260;
  const progressPct = size > 0 ? ((index + 1) / size) * 100 : 0;

  /** Joyride does not pass `helpers` into custom tooltips — use `primaryProps.onClick`. */
  const advanceTour = (e) => {
    primaryProps?.onClick?.(e);
  };

  const onCandidateSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    advanceTour(e);
  };

  const leavingThinkOutLoud =
    step.data?.stepId === "think-out-loud" ||
    index === SUBMIT_WORK_STEP_INDEX - 1;

  const goNext = (e) => {
    if (collectInfo && isLastStep && !isFormValid) return;
    /**
     * Submit-work targets `#submit-files-modal-panel`, which only exists when
     * SubmitFilesModal is open. Joyride looks up the next target in the same
     * turn as "Next". `STEP_AFTER` is not emitted for normal continuous tours
     * (only when controlled / a narrow lifecycle case), so we must open here.
     */
    if (leavingThinkOutLoud) {
      flushSync(() => {
        onSubmitWorkStepEnter?.();
      });
    }
    advanceTour(e);
  };

  const primaryLabel =
    step.data?.primaryButtonLabel ??
    (isWelcome ? "Start Tour" : isLastStep ? "Start Assessment" : "Next");

  if (isWelcome) {
    const welcomeCard = (
      <div
        className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
        role="presentation"
      >
        <div
          {...tooltipProps}
          className={cn(
            "tour-modal tour-step-card bg-white pointer-events-auto flex w-full min-w-0 flex-col items-center gap-[22px] p-[30px] text-center shadow-calyptus-elevated",
            "w-[min(100vw-2rem,448px)] min-w-[280px] max-w-[448px]",
            tooltipProps.className,
          )}
          style={{
            ...tooltipProps.style,
            position: "relative",
            inset: "auto",
            margin: 0,
            transform: "none",
            width: "min(100vw - 2rem, 448px)",
            maxWidth: 448,
            minWidth: 280,
          }}
          role="dialog"
          aria-modal="true"
          aria-label={
            typeof step.title === "string" ? step.title : "Assessment tour"
          }
        >
          {step.title != null && (
            <h2 className="w-full text-[20px] font-bold leading-normal text-calyptus-strong">
              {step.title}
            </h2>
          )}
          <p className="w-full whitespace-pre-wrap text-base font-normal leading-normal text-[#000122]">
            {step.content}
          </p>
          <div
            className="h-px w-full shrink-0 bg-calyptus-border-input"
            aria-hidden
          />
          <div className="flex w-full justify-center">
            <Button
              type="button"
              variant="modalPrimary"
              size="modal"
              className="rounded-xl px-4 py-2 text-sm font-bold leading-[1.4]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goNext(e);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    );
    return tourModalPortal(welcomeCard);
  }

  if (isCenteredModalTooltip) {
    const centeredCard = (
      <div
        className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
        role="presentation"
      >
        <div
          {...tooltipProps}
          className={cn(
            "tour-modal tour-step-card bg-white pointer-events-auto w-full min-w-0 border-0 p-0 text-left shadow-calyptus-elevated",
            tooltipProps.className,
          )}
          style={{
            ...tooltipProps.style,
            position: "relative",
            inset: "auto",
            margin: 0,
            transform: "none",
            width: `min(100vw - 2rem, ${cardTooltipMaxPx}px)`,
            minWidth: cardTooltipMinPx,
            maxWidth: cardTooltipMaxPx,
          }}
          role="dialog"
          aria-modal="true"
          aria-label={
            typeof step.title === "string" ? step.title : "Tour step"
          }
        >
          <TourStepCard
            step={step}
            index={index}
            size={size}
            progressPct={progressPct}
            primaryLabel={primaryLabel}
            onNext={goNext}
            className="px-4 py-4 md:px-6 md:py-5"
          />
        </div>
      </div>
    );
    return tourModalPortal(centeredCard);
  }

  if (isArrowTooltip) {
    return (
      <div
        {...tooltipProps}
        className={cn(
          "tour-floater-tooltip w-full min-w-0 border-0 bg-transparent p-0 shadow-none",
          tooltipProps.className,
        )}
        style={{
          ...tooltipProps.style,
          width: `min(100vw - 2rem, ${cardTooltipMaxPx}px)`,
          minWidth: cardTooltipMinPx,
          maxWidth: cardTooltipMaxPx,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={
          typeof step.title === "string" ? step.title : "Tour step"
        }
      >
        <TourStepCard
          step={step}
          index={index}
          size={size}
          progressPct={progressPct}
          primaryLabel={primaryLabel}
          onNext={goNext}
        />
      </div>
    );
  }

  const finalStepCard = (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        {...tooltipProps}
        className={cn(
          "tour-modal tour-step-card bg-white pointer-events-auto p-6 text-left shadow-calyptus-elevated",
          "w-[min(100vw-2rem,448px)] min-w-[280px] max-w-[448px]",
          tooltipProps.className,
        )}
        style={{
          ...tooltipProps.style,
          position: "relative",
          inset: "auto",
          margin: 0,
          transform: "none",
          width: "min(100vw - 2rem, 448px)",
          maxWidth: 448,
          minWidth: 280,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof step.title === "string" ? step.title : "Tour"}
      >
        <div className="mb-4 min-w-0">
          {step.title != null && (
            <h2 className="mb-2 text-xl font-bold leading-snug text-calyptus-strong">
              {step.title}
            </h2>
          )}
          <p className="whitespace-pre-line text-sm leading-relaxed text-calyptus-body">
            {step.content}
          </p>
        </div>

        {collectInfo && (
          <form
            id="guided-tour-candidate-form"
            className="mb-6 flex flex-col gap-4"
            noValidate
            onSubmit={onCandidateSubmit}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div>
              <label
                htmlFor={candidateNameId}
                className="mb-1 block text-xs font-normal leading-snug text-calyptus-body"
              >
                <span
                  className="font-bold text-calyptus-primary-green"
                  aria-hidden
                >
                  *
                </span>{" "}
                <span className="sr-only">required, </span>
                Full name
              </label>
              <input
                id={candidateNameId}
                name="candidateName"
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                aria-invalid={!!nameError}
                autoComplete="name"
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  calyptus.fieldInput,
                  calyptus.fieldInputInvalid,
                )}
                placeholder="Enter your full name"
                required
              />
              {nameError && (
                <p
                  className="mt-1 text-xs font-medium text-red-600"
                  role="alert"
                >
                  {nameError}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor={candidateEmailId}
                className="mb-1 block text-xs font-normal leading-snug text-calyptus-body"
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
                id={candidateEmailId}
                name="candidateEmail"
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                aria-invalid={!!emailError}
                autoComplete="email"
                inputMode="email"
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  calyptus.fieldInput,
                  calyptus.fieldInputInvalid,
                )}
                placeholder="Enter your email address"
                required
              />
              {emailError && (
                <p
                  className="mt-1 text-xs font-medium text-red-600"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </div>
          </form>
        )}

        <div className="flex w-full items-center justify-end gap-3">
          <Button
            type={collectInfo ? "submit" : "button"}
            form={collectInfo ? "guided-tour-candidate-form" : undefined}
            variant="modalPrimary"
            size="modal"
            onClick={
              collectInfo
                ? undefined
                : (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goNext(e);
                  }
            }
            disabled={collectInfo && !isFormValid}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return tourModalPortal(finalStepCard);
}

export default function GuidedTour({
  onComplete,
  initialCandidate,
  onSubmitWorkStepEnter,
  onSubmitWorkStepLeave,
}) {
  const [run, setRun] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [joyrideIndex, setJoyrideIndex] = useState(0);
  const savedStyles = useRef(new Map());
  const finishedRef = useRef(false);
  const prevJoyrideIndexRef = useRef(0);
  const candidateRef = useRef({ name: "", email: "" });

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [isFormValid, setIsFormValid] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  const candidateNameId = useId();
  const candidateEmailId = useId();

  useEffect(() => {
    setMounted(true);
    return () => {
      document.body.classList.remove("tour-active");
      clearTourDom(savedStyles.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      onSubmitWorkStepLeave?.();
    };
  }, [onSubmitWorkStepLeave]);

  useEffect(() => {
    candidateRef.current = { name: candidateName, email: candidateEmail };
  }, [candidateName, candidateEmail]);

  useEffect(() => {
    const nameValid = candidateName.trim().length >= 2;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail);

    setIsFormValid(nameValid && emailValid);

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

  const steps = useMemo(
    () =>
      tourSteps.map((s) => ({
        target: s.highlightElement ?? `#${CENTER_TARGET_ID}`,
        title: s.title,
        content: s.content,
        placement: s.position,
        disableBeacon: true,
        hideFooter: true,
        hideBackButton: true,
        spotlightClicks: s.id === "submit-work",
        spotlightPadding: s.highlightElement ? 10 : 4,
        floaterProps: {
          styles: {
            arrow: { display: "none" },
          },
        },
        data: {
          stepId: s.id,
          unblurTarget: s.unblurTarget,
          collectInfo: s.collectInfo,
          welcomeLayout: s.id === "welcome",
          arrowTooltip:
            s.id === "read-record" ||
            s.id === "ai-assistant" ||
            s.id === "submit-work",
          centeredModalTooltip:
            s.id === "screen-requirements" || s.id === "think-out-loud",
          figmaBody: s.figmaBody,
          cardTooltipWidth: s.cardTooltipWidth,
          primaryButtonLabel: s.primaryButtonLabel,
        },
      })),
    [],
  );

  const finishTour = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    document.body.classList.remove("tour-active");
    clearTourDom(savedStyles.current);
    const { name, email } = candidateRef.current;
    onComplete({ name, email });
    setRun(false);
  }, [onComplete]);

  const handleJoyrideCallback = useCallback(
    (data) => {
      const { type, index, status } = data;

      if (type === EVENTS.TOUR_START) {
        setJoyrideIndex(0);
      }

      if (type === EVENTS.TOOLTIP && typeof index === "number") {
        /* Submit step skipped (target missing): close orphan file modal before candidate-info. */
        if (index === CANDIDATE_INFO_STEP_INDEX) {
          onSubmitWorkStepLeave?.();
        }
        setJoyrideIndex(index);
      }

      const done =
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED ||
        type === EVENTS.TOUR_END;

      if (done) {
        finishTour();
      }
    },
    [finishTour, onSubmitWorkStepLeave],
  );

  useEffect(() => {
    if (!run || !mounted) return;
    document.body.classList.add("tour-active");
    return () => {
      document.body.classList.remove("tour-active");
    };
  }, [run, mounted]);

  useEffect(() => {
    if (!run || !mounted || typeof window === "undefined") return;

    const step = tourSteps[joyrideIndex];
    const delay = step?.id === "submit-work" ? 320 : 100;

    const timer = setTimeout(() => {
      applyStepDomEffects(joyrideIndex, savedStyles.current);
    }, delay);

    return () => {
      clearTimeout(timer);
      clearTourDom(savedStyles.current);
    };
  }, [joyrideIndex, run, mounted]);

  useIsomorphicLayoutEffect(() => {
    if (!run || !mounted || SUBMIT_WORK_STEP_INDEX < 0) return;

    const prev = prevJoyrideIndexRef.current;
    if (joyrideIndex === SUBMIT_WORK_STEP_INDEX) {
      onSubmitWorkStepEnter?.();
    } else if (
      prev === SUBMIT_WORK_STEP_INDEX &&
      joyrideIndex !== SUBMIT_WORK_STEP_INDEX
    ) {
      onSubmitWorkStepLeave?.();
    }
    prevJoyrideIndexRef.current = joyrideIndex;
  }, [
    joyrideIndex,
    run,
    mounted,
    onSubmitWorkStepEnter,
    onSubmitWorkStepLeave,
  ]);

  const tooltipContextValue = useMemo(
    () => ({
      candidateName,
      setCandidateName,
      candidateEmail,
      setCandidateEmail,
      candidateNameId,
      candidateEmailId,
      nameError,
      emailError,
      isFormValid,
      onSubmitWorkStepEnter,
    }),
    [
      candidateName,
      candidateEmail,
      candidateNameId,
      candidateEmailId,
      nameError,
      emailError,
      isFormValid,
      onSubmitWorkStepEnter,
    ],
  );

  if (!mounted || !run) return null;

  return (
    <>
      <div
        id={CENTER_TARGET_ID}
        className="pointer-events-none fixed left-1/2 top-1/2 z-[2147483630] h-48 min-h-[12rem] w-[min(100vw-2rem,448px)] min-w-[280px] max-w-[448px] -translate-x-1/2 -translate-y-1/2 opacity-0"
        aria-hidden
      />

      <GuidedTourTooltipContext.Provider value={tooltipContextValue}>
        <Joyride
          steps={steps}
          run={run}
          continuous
          showProgress={false}
          showSkipButton={false}
          hideCloseButton
          disableCloseOnEsc
          disableOverlayClose
          spotlightPadding={10}
          callback={handleJoyrideCallback}
          tooltipComponent={GuidedTourJoyrideTooltip}
          styles={{
            options: {
              zIndex: 2147483640,
              arrowColor: "#fff",
              backgroundColor: "transparent",
              overlayColor: "rgba(0, 0, 0, 0.15)",
              primaryColor: "#0C30AD",
              textColor: "#383D3A",
              width: 448,
            },
            spotlight: {
              borderRadius: 10,
            },
            tooltip: {
              padding: 0,
              borderRadius: 8,
              boxShadow: "none",
              backgroundColor: "transparent",
            },
            tooltipContainer: {
              textAlign: "left",
            },
          }}
        />
      </GuidedTourTooltipContext.Provider>
    </>
  );
}
