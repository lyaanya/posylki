import { VerifiedBadge } from "./VerifiedBadge";

type AvatarProps = {
  initials: string;
  /** Фото профиля (E06 п. 6.12) — если задано, показывается вместо инициалов. */
  imageUrl?: string | null;
  verified?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "size-9 text-sm",
  md: "size-12 text-base",
  lg: "size-16 text-lg",
};

export function Avatar({ initials, imageUrl, verified, size = "md" }: AvatarProps) {
  return (
    <div className="relative inline-flex shrink-0">
      {imageUrl ? (
        // Аватары хранятся в Storage под доменом Supabase, не в проекте —
        // next/image потребовал бы настройки доверенных доменов ради того же
        // результата, что и обычный <img>.
        <img
          src={imageUrl}
          alt=""
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-primary font-heading font-semibold text-on-primary`}
        >
          {initials}
        </div>
      )}
      {verified ? (
        <span className="absolute -right-0.5 -bottom-0.5">
          <VerifiedBadge compact />
        </span>
      ) : null}
    </div>
  );
}
