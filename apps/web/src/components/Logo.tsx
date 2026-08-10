export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 128" className={className} aria-hidden="true">
      <text
        x="4"
        y="84"
        fontFamily="MorfinSans, var(--font-manrope), sans-serif"
        fontWeight="800"
        fontSize="130"
        letterSpacing="-2"
        fill="currentColor"
      >
        VEZZY
      </text>
      <path
        d="M6 102 C 92 122, 224 118, 302 94"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="302" cy="94" r="6" fill="currentColor" />
    </svg>
  );
}
