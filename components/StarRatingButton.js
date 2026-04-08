import { cn } from "@/lib/utils";

export default function StarRatingButton({ filled, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={filled}
      className={cn(
        "size-[26px] shrink-0 cursor-pointer border-0 bg-transparent p-0",
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-calyptus-blue-deep/40 focus-visible:ring-offset-0",
        filled
          ? "text-calyptus-blue-deep"
          : "text-calyptus-muted hover:text-calyptus-blue-deep/80",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="pointer-events-none size-[26px]"
      >
        {filled ? (
          <path
            fill="currentColor"
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />
        ) : (
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />
        )}
      </svg>
    </button>
  );
}
