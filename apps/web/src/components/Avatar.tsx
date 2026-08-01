import { VerifiedBadge } from "./VerifiedBadge";

type AvatarProps = {
  initials: string;
  verified?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "size-9 text-sm",
  md: "size-12 text-base",
  lg: "size-16 text-lg",
};

export function Avatar({ initials, verified, size = "md" }: AvatarProps) {
  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-primary font-heading font-semibold text-on-primary`}
      >
        {initials}
      </div>
      {verified ? (
        <span className="absolute -right-0.5 -bottom-0.5">
          <VerifiedBadge compact />
        </span>
      ) : null}
    </div>
  );
}
