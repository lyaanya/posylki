export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 60" className={className} aria-hidden="true">
      <text
        x="0"
        y="38"
        fontFamily="var(--font-heading)"
        fontWeight="800"
        fontSize="34"
        letterSpacing="-1"
        fill="var(--color-foreground)"
      >
        VEZZY
      </text>
      <path
        d="M6 50 C 60 62, 120 58, 160 44"
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Акцент логотипа — точный цвет из утверждённого брендборда (раунд 6),
          отдельный от приглушённого --color-action, который используют кнопки. */}
      <circle cx="160" cy="44" r="4.5" fill="#D82961" />
    </svg>
  );
}
