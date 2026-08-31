"use client";

import { useState } from "react";
import { dictionary } from "@/lib/dictionary";
import {
  ModerationApiError,
  createComplaint,
  uploadComplaintPhoto,
  type ComplaintCategory,
  type ComplaintTargetType,
} from "@/lib/moderation";

const MAX_PHOTOS = 5;

const CATEGORIES: { value: ComplaintCategory; label: keyof typeof dictionary.moderation }[] = [
  { value: "fraud", label: "categoryFraud" },
  { value: "prohibited_item", label: "categoryProhibitedItem" },
  { value: "rudeness", label: "categoryRudeness" },
  { value: "breach_of_agreement", label: "categoryBreachOfAgreement" },
  { value: "fake_documents", label: "categoryFakeDocuments" },
  { value: "spam", label: "categorySpam" },
  { value: "other", label: "categoryOther" },
];

function errorMessage(err: unknown): string {
  if (err instanceof ModerationApiError) {
    if (err.code === "COMPLAINT_ALREADY_ACTIVE") return dictionary.moderation.alreadyActiveError;
    return err.message || dictionary.moderation.genericError;
  }
  return dictionary.moderation.genericError;
}

/**
 * ТЗ E12 п.12.2 — кнопка жалобы, доступная с профиля, чата, объявления,
 * отзыва и сделки; одна реализация формы на все точки входа, различается
 * только targetType/targetId.
 */
export function ComplaintButton({
  targetType,
  targetId,
  className,
  label,
}: {
  targetType: ComplaintTargetType;
  targetId: string;
  className?: string;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintCategory>("other");
  const [comment, setComment] = useState("");
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  function reset() {
    setCategory("other");
    setComment("");
    setPhotoPaths([]);
    setError(null);
    setIsDone(false);
  }

  function close() {
    setIsOpen(false);
    reset();
  }

  async function handleAttach(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (photoPaths.length + files.length > MAX_PHOTOS) {
      setError(dictionary.moderation.attachmentsLimitError);
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadComplaintPhoto(f)));
      setPhotoPaths((prev) => [...prev, ...uploaded]);
    } catch {
      setError(dictionary.moderation.uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      await createComplaint({
        targetType,
        targetId,
        category,
        comment: comment.trim() || undefined,
        photoPaths,
      });
      setIsDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ??
          "font-heading shrink-0 rounded-sm border border-border px-2.5 py-1.5 text-xs font-bold text-destructive"
        }
      >
        {label ?? dictionary.moderation.complainCta}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-lg bg-card p-5 shadow-lg sm:rounded-md">
            {isDone ? (
              <div className="text-center">
                <p className="font-heading text-lg font-bold text-foreground">
                  {dictionary.moderation.successTitle}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{dictionary.moderation.successText}</p>
                <button
                  type="button"
                  onClick={close}
                  className="font-heading mt-5 w-full rounded-sm bg-action py-2.5 text-sm font-bold text-on-action"
                >
                  {dictionary.moderation.closeCta}
                </button>
              </div>
            ) : (
              <>
                <p className="font-heading text-lg font-bold text-foreground">
                  {dictionary.moderation.modalTitle}
                </p>

                <label className="mt-4 block text-sm font-medium text-muted-foreground">
                  {dictionary.moderation.categoryLabel}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {dictionary.moderation[c.label]}
                    </option>
                  ))}
                </select>

                <label className="mt-4 block text-sm font-medium text-muted-foreground">
                  {dictionary.moderation.commentLabel}
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={dictionary.moderation.commentPlaceholder}
                  maxLength={1000}
                  className="mt-1.5 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <div className="mt-3 flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {isUploading ? "…" : `📎 ${dictionary.moderation.attachCta}`}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      disabled={isUploading || photoPaths.length >= MAX_PHOTOS}
                      onChange={handleAttach}
                    />
                  </label>
                  {photoPaths.length > 0 ? (
                    <span className="text-xs text-muted-foreground">{photoPaths.length}</span>
                  ) : null}
                </div>

                {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={isSubmitting}
                    className="font-heading flex-1 rounded-sm border border-border py-2.5 text-sm font-bold text-foreground disabled:opacity-50"
                  >
                    {dictionary.moderation.cancelCta}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploading}
                    className="font-heading flex-1 rounded-sm bg-action py-2.5 text-sm font-bold text-on-action disabled:opacity-60"
                  >
                    {isSubmitting ? dictionary.moderation.submitting : dictionary.moderation.submitCta}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
