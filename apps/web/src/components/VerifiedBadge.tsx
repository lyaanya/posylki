import { dictionary } from "@/lib/dictionary";

type VerifiedBadgeProps = {
  compact?: boolean;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 10.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VerifiedBadge({ compact = false }: VerifiedBadgeProps) {
  if (compact) {
    return (
      <span
        className="flex size-5 items-center justify-center rounded-full border-2 border-card bg-success text-on-success"
        title={dictionary.common.verifiedBadge}
      >
        <CheckIcon className="size-3" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
      <CheckIcon className="size-3.5" />
      {dictionary.common.verifiedBadge}
    </span>
  );
}
