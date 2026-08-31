"use client";

import { useEffect, useState } from "react";
import { fetchSummary, type AdminSummary } from "@/lib/summary";

const SCENARIO_LABEL: Record<string, string> = {
  listing_moderation: "Модерация объявлений",
  inventory_moderation: "Модерация описи",
  parse_listing_text: "Разбор текста",
  support_assistant: "Ассистент поддержки",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)]">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}

/** ТЗ E16 пп.16.30-16.31 — операционные показатели этапа и расходы на ИИ. */
export default function DashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  useEffect(() => {
    fetchSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Сводка</h1>
        <p className="mt-1 text-[var(--color-muted-foreground)]">
          Операционные показатели этапа. Продуктовой аналитики здесь нет — вынесена в бэклог.
        </p>
      </div>

      {summary === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Заявок в очереди верификации" value={summary.verificationQueueCount} />
            <StatCard label="Среднее время ожидания, мин" value={summary.averageVerificationWaitingMinutes} />
            <StatCard label="Обращений в очереди модерации" value={summary.moderationQueueCount} />
            <StatCard label="Открытых обращений в поддержку" value={summary.openSupportTicketsCount} />
            <StatCard label="Проблемных сделок" value={summary.problemDealsCount} />
          </div>

          <div>
            <h2 className="text-lg font-semibold">Расходы на ИИ-сервис (30 дней)</h2>
            <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted-foreground)]">
                    <th className="p-3 font-medium">Сценарий</th>
                    <th className="p-3 font-medium">Запросов</th>
                    <th className="p-3 font-medium">Ошибок</th>
                    <th className="p-3 font-medium">Входные токены</th>
                    <th className="p-3 font-medium">Выходные токены</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.aiUsage.length === 0 ? (
                    <tr>
                      <td className="p-3 text-[var(--color-muted-foreground)]" colSpan={5}>
                        Обращений не было
                      </td>
                    </tr>
                  ) : (
                    summary.aiUsage.map((row) => (
                      <tr key={row.scenario} className="border-b border-[var(--color-border)] last:border-none">
                        <td className="p-3">{SCENARIO_LABEL[row.scenario] ?? row.scenario}</td>
                        <td className="p-3">{row.requestCount}</td>
                        <td className="p-3">{row.errorCount}</td>
                        <td className="p-3">{row.inputTokens.toLocaleString("ru-RU")}</td>
                        <td className="p-3">{row.outputTokens.toLocaleString("ru-RU")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
