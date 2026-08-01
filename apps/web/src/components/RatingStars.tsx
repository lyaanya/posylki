function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
      <path
        d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"
        fill={filled ? "var(--color-warning)" : "none"}
        stroke="var(--color-warning)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RatingStars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`рейтинг ${value} из 5`}>
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <StarIcon key={n} filled={n <= rounded} />
        ))}
      </span>
      <span className="text-sm font-medium text-foreground">{value.toFixed(1)}</span>
    </span>
  );
}
