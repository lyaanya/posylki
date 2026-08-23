"use client";

import { useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { parseListingText, type ParsedListingText } from "@/lib/ai";

const UNDETERMINED_LABELS: Record<string, string> = {
  type: "тип объявления",
  fromCity: "город отправления",
  toCity: "город назначения",
  date: "дата",
  weightKg: "вес",
  pricePerKg: "цена за кг",
  minPrice: "минимальная стоимость",
};

/**
 * Сценарий 3 ИИ-сервиса (E13 пп. 13.22–13.27): пользователь пишет объявление
 * одной строкой, форма заполняется сама. Результат — только предзаполнение,
 * поля остаются редактируемыми и требуют подтверждения публикацией (13.26).
 */
export function AiListingAssist({ onParsed }: { onParsed: (data: ParsedListingText) => void }) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undetermined, setUndetermined] = useState<string[]>([]);

  async function handleSubmit() {
    if (text.trim().length < 3) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setUndetermined([]);

    const result = await parseListingText(text);

    if (!result.ok) {
      // Нейтральное сообщение при сбое (E13 п. 13.27) — форма остаётся
      // пустой, ничего не выдумывается, можно заполнить вручную.
      setError(dictionary.createListing.aiAssistError);
      setIsLoading(false);
      return;
    }

    onParsed(result.data);
    setUndetermined(result.data.undeterminedFields);
    setIsLoading(false);
  }

  return (
    <div className="rounded-sm border border-[#DCEAF3] bg-card-alt p-3">
      <p className="text-xs font-semibold text-foreground">{dictionary.createListing.aiAssistTitle}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={dictionary.createListing.aiAssistPlaceholder}
        className="mt-2 w-full rounded-sm border border-border bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading || text.trim().length < 3}
        className="font-heading mt-2 rounded-sm bg-primary px-3 py-1.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {isLoading ? dictionary.createListing.aiAssistLoading : dictionary.createListing.aiAssistCta}
      </button>

      {error ? <p className="mt-2 text-xs text-muted-foreground">{error}</p> : null}

      {undetermined.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {dictionary.createListing.aiAssistUndetermined}:{" "}
          {undetermined.map((f) => UNDETERMINED_LABELS[f] ?? f).join(", ")} —{" "}
          {dictionary.createListing.draftFillManually.toLowerCase()}
        </p>
      ) : null}
    </div>
  );
}
