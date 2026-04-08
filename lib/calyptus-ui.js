/**
 * Reusable Calyptus UI class groups (borders, surfaces, shadows, form controls).
 * Pair with `cn()` from `@/lib/utils` when merging conditionals.
 */
export const calyptus = {
  /** Default bordered card (assessment column, chat shell, submit section) */
  cardSurface:
    "rounded-calyptus border border-calyptus-border-card bg-white shadow-sm",

  /** Elevated panel (modals, thank-you card) */
  modalElevated: "rounded-calyptus-lg bg-white shadow-calyptus-elevated",

  modalPadding: "p-[30px]",

  /** Full-screen tinted page wrapper */
  pageShell:
    "flex min-h-screen items-center justify-center bg-calyptus-tint p-4",

  /** Horizontal rules */
  divider: "h-px w-full bg-calyptus-border-field",
  dividerChat: "h-px w-full max-w-[392px] bg-calyptus-border-card",

  /** Loading / evaluate spinners */
  spinnerSm:
    "size-12 animate-spin rounded-full border-2 border-calyptus-border-field border-t-calyptus-blue-deep",
  spinnerMd:
    "size-14 animate-spin rounded-full border-2 border-calyptus-border-field border-t-calyptus-blue-deep",

  /** Blocking overlay (evaluate) */
  overlayBackdrop:
    "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]",

  /** Recorder / submit “processing” strip */
  processingPanel:
    "mb-6 rounded-calyptus border border-calyptus-border-field bg-calyptus-tint/50 p-5",

  /** Video preview frame */
  videoPanel:
    "mb-6 overflow-hidden rounded-calyptus border border-calyptus-border-field bg-calyptus-surface-input/30 p-3",

  /** Info callouts (tinted) */
  tintedCard:
    "mb-6 rounded-calyptus border border-calyptus-border-card bg-calyptus-tint p-4",

  /** Dashed file pickers */
  fileInput:
    "w-full cursor-pointer rounded-xl border-2 border-dashed border-calyptus-border-field bg-white p-2 transition-all duration-200 file:mr-3 file:rounded-md file:border-0 file:bg-calyptus-tint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-calyptus-strong hover:border-calyptus-purple hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-calyptus-purple/30",

  /** Form fields (feedback / modal) */
  fieldInput:
    "h-12 w-full rounded-md border border-solid border-calyptus-border-field bg-white px-3 text-sm text-calyptus-strong outline-none placeholder:text-calyptus-muted focus:border-calyptus-blue-deep focus:ring-1 focus:ring-calyptus-blue-deep/20",
  fieldInputInvalid:
    "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-500/20",
  fieldTextarea:
    "min-h-[90px] w-full resize-y rounded-md border border-solid border-calyptus-border-field bg-white px-3 py-3 text-sm text-calyptus-strong outline-none placeholder:text-calyptus-muted focus:border-calyptus-blue-deep focus:ring-1 focus:ring-calyptus-blue-deep/20",

  /** Labels */
  labelForm: "mb-2 block text-sm font-semibold text-calyptus-body",
  labelFormRequired:
    "required mb-2 block text-sm font-semibold text-calyptus-body",
  legendForm:
    "mb-2.5 block w-full text-left text-xs font-normal leading-snug text-calyptus-body",
  labelModal: "text-xs font-normal leading-snug text-calyptus-body",

  /** Section headings */
  sectionTitleSubmit: "mb-4 text-xl font-bold text-calyptus-strong md:text-2xl",

  /** Footer rule under cards */
  footerRule: "mt-6 pt-6 text-center",

  /** Compact elevated panel for loading message (evaluate overlay) */
  modalPanelCompact:
    "flex w-full max-w-sm flex-col items-center gap-5 text-center rounded-calyptus-lg bg-white p-8 shadow-calyptus-elevated",

  /** Form vertical rhythm */
  formGap: "flex flex-col gap-[22px] w-full",
};
