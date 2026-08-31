"use client";

import { useEffect, useState } from "react";
import { createFaq, fetchFaq, updateFaq, type SupportFaqEntry } from "@/lib/admin-support";

/** ТЗ E16 п.16.28/E15 п.15.21 — база типовых ответов, редактируется в админ-панели. */
export default function FaqPage() {
  const [entries, setEntries] = useState<SupportFaqEntry[] | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  function load() {
    fetchFaq()
      .then(setEntries)
      .catch(() => setEntries([]));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    await createFaq({ question: question.trim(), answer: answer.trim() });
    setQuestion("");
    setAnswer("");
    load();
  }

  async function toggleActive(entry: SupportFaqEntry) {
    await updateFaq(entry.id, { isActive: !entry.isActive });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">База типовых ответов</h1>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Вопрос"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
        />
        <textarea
          rows={2}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Ответ"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
        />
        <button type="submit" className="self-start rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]">
          Добавить
        </button>
      </form>

      {entries === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{entry.question}</p>
                <button
                  type="button"
                  onClick={() => toggleActive(entry)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    entry.isActive ? "bg-[var(--color-success)] text-[var(--color-on-success)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                  }`}
                >
                  {entry.isActive ? "активен" : "отключён"}
                </button>
              </div>
              <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">{entry.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
