"use client";

import { useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { referralLink } from "@/lib/referral";

/** ТЗ E08 п.8.17-8.19 — персональная ссылка-приглашение, доступна из профиля. */
export function InviteLinkCard({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const link = referralLink(userId);

  return (
    <div className="mt-6 rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="font-heading text-sm font-bold text-foreground">{dictionary.profile.inviteTitle}</p>
      <p className="mt-1 text-sm text-muted-foreground">{dictionary.profile.inviteText}</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Буфер обмена недоступен — ссылку можно скопировать вручную из поля выше.
            }
          }}
          className="font-heading shrink-0 rounded-sm border border-border px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted"
        >
          {copied ? dictionary.profile.linkCopied : dictionary.profile.copyLinkCta}
        </button>
      </div>
    </div>
  );
}
