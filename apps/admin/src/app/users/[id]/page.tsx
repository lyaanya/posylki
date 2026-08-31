"use client";

import { use, useEffect, useState } from "react";
import { AdminApiError } from "@/lib/api";
import { fetchUserCard, moderateUser, type AdminUserCard, type ModerateUserAction } from "@/lib/admin-users";

const ACTION_LABEL: Record<ModerateUserAction, string> = {
  warn: "Вынести предупреждение",
  ban_user: "Заблокировать",
  unban: "Разблокировать",
};

function Section({ title, items }: { title: string; items: unknown[] }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
        {title} ({items.length})
      </p>
      {items.length > 0 ? (
        <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify(items, null, 2)}</pre>
      ) : null}
    </div>
  );
}

/** ТЗ E16 пп.16.18-16.20 — карточка пользователя, номер документа нигде не отображается. */
export default function UserCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [card, setCard] = useState<AdminUserCard | null>(null);
  const [action, setAction] = useState<ModerateUserAction | null>(null);
  const [reason, setReason] = useState("");
  const [banDurationDays, setBanDurationDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    fetchUserCard(id)
      .then(setCard)
      .catch(() => setCard(null));
  }

  useEffect(load, [id]);

  async function handleSubmit() {
    if (!action || reason.trim().length < 3) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await moderateUser(id, {
        action,
        reason,
        ...(action === "ban_user" && banDurationDays ? { banDurationDays: Number(banDurationDays) } : {}),
      });
      setAction(null);
      setReason("");
      setBanDurationDays("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Не получилось выполнить действие");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (card === null) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  const { profile } = card;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{profile.email}</p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-[var(--color-muted-foreground)]">Телефон</dt>
          <dd>{profile.phone ?? "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Дата рождения</dt>
          <dd>{profile.dateOfBirth ?? "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Тип документа</dt>
          <dd>{profile.documentType ?? "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Верификация</dt>
          <dd>{profile.verificationStatus}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Регистрация</dt>
          <dd>{new Date(profile.createdAt).toLocaleDateString("ru-RU")}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Пригласил</dt>
          <dd>{profile.referrerEmail ?? "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Статус</dt>
          <dd>{profile.isBlocked ? `заблокирован (${profile.blockedReason})` : "активен"}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="Объявления" items={card.listings} />
        <Section title="Сделки" items={card.deals} />
        <Section title="Отзывы о пользователе" items={card.reviewsReceived} />
        <Section title="Жалобы поданные" items={card.complaintsFiled} />
        <Section title="Жалобы полученные" items={card.complaintsReceived} />
        <Section title="Предупреждения" items={card.warnings} />
        <Section title="Блокировки" items={card.bans} />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm font-medium">Действия</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["warn", "ban_user", "unban"] as ModerateUserAction[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${
                action === a ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "border-[var(--color-border)]"
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
                placeholder="Срок в днях (пусто — бессрочно)"
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
              Применить
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
