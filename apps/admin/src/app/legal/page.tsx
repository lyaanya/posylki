"use client";

import { useEffect, useState } from "react";
import { fetchLegalDocuments, publishLegalDocument, type LegalDocument, type LegalDocumentType } from "@/lib/legal";

const TYPE_LABELS: Record<LegalDocumentType, string> = {
  terms: "Условия использования",
  privacy: "Политика конфиденциальности",
  service_rules: "Правила сервиса",
  consent: "Согласие на обработку данных",
};

const TYPES = Object.keys(TYPE_LABELS) as LegalDocumentType[];

/** ТЗ E16 п.16.29 — публикация версий; сам гейт повторного принятия (E03) не реализован. */
export default function LegalDocumentsPage() {
  const [documents, setDocuments] = useState<LegalDocument[] | null>(null);
  const [type, setType] = useState<LegalDocumentType>("terms");
  const [title, setTitle] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchLegalDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }

  useEffect(load, []);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !bodyMarkdown.trim() || !effectiveAt) {
      setError("Заполните заголовок, текст и дату вступления в силу");
      return;
    }

    try {
      await publishLegalDocument({
        type,
        title: title.trim(),
        bodyMarkdown: bodyMarkdown.trim(),
        effectiveAt: new Date(effectiveAt).toISOString(),
      });
      setTitle("");
      setBodyMarkdown("");
      setEffectiveAt("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось опубликовать");
    }
  }

  const byType = (documents ?? []).reduce<Record<string, LegalDocument[]>>((acc, doc) => {
    (acc[doc.type] ??= []).push(doc);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Юридические документы</h1>

      <form
        onSubmit={handlePublish}
        className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      >
        <p className="text-sm font-medium">Опубликовать новую версию</p>

        <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
          Тип документа
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LegalDocumentType)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
          Заголовок
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
          Текст (Markdown)
          <textarea
            rows={8}
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
          Вступает в силу
          <input
            type="datetime-local"
            value={effectiveAt}
            onChange={(e) => setEffectiveAt(e.target.value)}
            className="w-fit rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
          />
        </label>

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        <button
          type="submit"
          className="self-start rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
        >
          Опубликовать новую версию
        </button>
      </form>

      {documents === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {TYPES.map((t) => {
            const versions = (byType[t] ?? []).sort((a, b) => b.version - a.version);
            if (versions.length === 0) return null;
            return (
              <div key={t} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <p className="text-sm font-semibold">{TYPE_LABELS[t]}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {versions.map((doc) => (
                    <details key={doc.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        v{doc.version} — {doc.title}{" "}
                        <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
                          (в силе с {new Date(doc.effectiveAt).toLocaleString("ru-RU")})
                        </span>
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-muted-foreground)]">{doc.bodyMarkdown}</pre>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
          {documents.length === 0 && (
            <p className="text-sm text-[var(--color-muted-foreground)]">Документов пока нет</p>
          )}
        </div>
      )}
    </div>
  );
}
