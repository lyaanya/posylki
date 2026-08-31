"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApiError } from "@/lib/api";
import {
  decideComplaint,
  fetchComplaintDetail,
  type ComplaintDetail,
  type ModerationDecisionAction,
} from "@/lib/moderation";

const ACTION_LABEL: Record<ModerationDecisionAction, string> = {
  reject: "Отклонить жалобу",
  warn: "Вынести предупреждение",
  hide_listing: "Скрыть объявление",
  remove_review: "Удалить отзыв",
  ban_user: "Заблокировать пользователя",
};

/** ТЗ E16 пп.16.13-16.16 — карточка жалобы с полным контекстом и пятью решениями, причина обязательна. */
export default function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [action, setAction] = useState<ModerationDecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const [banDurationDays, setBanDurationDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComplaintDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  async function handleSubmit() {
    if (!action || reason.trim().length < 3) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await decideComplaint(id, {
        action,
        reason,
        ...(action === "ban_user" && banDurationDays ? { banDurationDays: Number(banDurationDays) } : {}),
      });
      router.push("/moderation");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Не получилось сохранить решение");
      setIsSubmitting(false);
    }
  }

  if (detail === null) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  const { complaint } = detail;
  const availableActions: ModerationDecisionAction[] =
    complaint.targetType === "listing"
      ? ["reject", "warn", "hide_listing", "ban_user"]
      : complaint.targetType === "review"
        ? ["reject", "warn", "remove_review", "ban_user"]
        : ["reject", "warn", "ban_user"];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Жалоба на {complaint.targetType}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Категория: {complaint.category} · статус: {complaint.status}
        </p>
      </div>

      {complaint.comment ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm">{complaint.comment}</p>
        </div>
      ) : null}

      {complaint.photoUrls.length > 0 ? (
        <div className="flex gap-2">
          {complaint.photoUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt="Фото к жалобе"
              className="h-32 w-32 rounded-[var(--radius-sm)] border border-[var(--color-border)] object-cover"
            />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Автор жалобы</p>
          <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(detail.author, null, 2)}</pre>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Обвиняемая сторона</p>
          <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(detail.accused, null, 2)}</pre>
        </div>
      </div>

      {detail.pastComplaints.length > 1 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
            Прошлые жалобы на эту сторону ({detail.pastComplaints.length - 1})
          </p>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm font-medium">Решение</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {availableActions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${
                action === a
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "border-[var(--color-border)]"
              }`}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>

        {action ? (
          <div className="mt-4 flex flex-col gap-3">
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина (обязательно)"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
            {action === "ban_user" ? (
              <input
                type="number"
                value={banDurationDays}
                onChange={(e) => setBanDurationDays(e.target.value)}
                placeholder="Срок блокировки в днях (пусто — бессрочно)"
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
            ) : null}
            {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || reason.trim().length < 3}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
            >
              Применить решение
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
