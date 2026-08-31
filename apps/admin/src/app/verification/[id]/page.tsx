"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApiError } from "@/lib/api";
import {
  decideVerification,
  fetchVerificationDetail,
  type VerificationDetail,
  type VerificationRejectionReason,
} from "@/lib/verification";

const REASON_LABEL: Record<VerificationRejectionReason, string> = {
  unreadable_photo: "Нечитаемое фото",
  expired_document: "Истёк срок действия документа",
  data_mismatch: "Данные не совпадают",
  selfie_mismatch: "Селфи не совпадает с документом",
  review_timeout: "Истёк срок рассмотрения (автоматически)",
  other: "Другое",
};

/** review_timeout проставляется только фоновой задачей (E04 п.4.16) — модератор его не выбирает. */
const SELECTABLE_REASONS: VerificationRejectionReason[] = [
  "unreadable_photo",
  "expired_document",
  "data_mismatch",
  "selfie_mismatch",
  "other",
];

/** ТЗ E16 пп.16.7-16.10 — карточка заявки: фото по временным ссылкам, история, решение с удалением файлов. */
export default function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [reason, setReason] = useState<VerificationRejectionReason>("unreadable_photo");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);

  useEffect(() => {
    fetchVerificationDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  async function handleDecide(approved: boolean) {
    setIsSubmitting(true);
    setError(null);
    try {
      await decideVerification(id, approved ? { approved: true } : { approved: false, rejectionReasonCode: reason, rejectionComment: comment });
      router.push("/verification");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Не получилось сохранить решение");
      setIsSubmitting(false);
    }
  }

  if (detail === null) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  const { request } = detail;
  if (request.status !== "pending") {
    return <p className="text-sm text-[var(--color-muted-foreground)]">По этой заявке уже принято решение.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {request.submittedFirstName} {request.submittedLastName}
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">Фото документа</p>
          {detail.documentPhotoUrl ? (
            <img src={detail.documentPhotoUrl} alt="Документ" className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)]" />
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">Недоступно</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">Селфи</p>
          {detail.selfiePhotoUrl ? (
            <img src={detail.selfiePhotoUrl} alt="Селфи" className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)]" />
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">Недоступно</p>
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Данные из заявки</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-[var(--color-muted-foreground)]">Дата рождения</dt>
          <dd>{request.submittedDateOfBirth}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Тип документа</dt>
          <dd>{request.documentType}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Подана</dt>
          <dd>{new Date(request.createdAt).toLocaleString("ru-RU")}</dd>
        </dl>
      </div>

      {detail.pastRequests.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">История прошлых заявок</p>
          <div className="flex flex-col gap-2">
            {detail.pastRequests.map((r) => (
              <div key={r.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">
                {new Date(r.createdAt).toLocaleDateString("ru-RU")} — {r.status}
                {r.rejectionReasonCode ? ` (${REASON_LABEL[r.rejectionReasonCode]})` : ""}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm font-medium">Решение</p>

        {confirmingApprove ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--color-warning)]">
              Фотографии будут удалены из хранилища немедленно и безвозвратно. Продолжить?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleDecide(true)}
                disabled={isSubmitting}
                className="rounded-[var(--radius-sm)] bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-[var(--color-on-success)] disabled:opacity-60"
              >
                Подтвердить одобрение
              </button>
              <button
                type="button"
                onClick={() => setConfirmingApprove(false)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : confirmingReject ? (
          <div className="mt-3 flex flex-col gap-3">
            <label className="text-sm font-medium">Причина</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as VerificationRejectionReason)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            >
              {SELECTABLE_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REASON_LABEL[value]}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
            <p className="text-sm text-[var(--color-warning)]">
              Фотографии будут удалены из хранилища немедленно и безвозвратно.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDecide(false)}
                disabled={isSubmitting}
                className="rounded-[var(--radius-sm)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-[var(--color-on-destructive)] disabled:opacity-60"
              >
                Подтвердить отклонение
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReject(false)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingApprove(true)}
              className="rounded-[var(--radius-sm)] bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-[var(--color-on-success)]"
            >
              Одобрить
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReject(true)}
              className="rounded-[var(--radius-sm)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-[var(--color-on-destructive)]"
            >
              Отклонить
            </button>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-[var(--color-destructive)]">{error}</p> : null}
      </div>
    </div>
  );
}
