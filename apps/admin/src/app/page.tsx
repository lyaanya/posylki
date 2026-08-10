const SECTIONS = [
  { title: "Верификация", description: "Очередь проверки документов (E04, E16)" },
  { title: "Модерация", description: "Жалобы, проблемные сделки, объявления от ИИ (E12, E16)" },
  { title: "Пользователи", description: "Поиск, карточка, блокировки (E16)" },
  { title: "Сделки", description: "Просмотр без ручной смены статуса (E10, E16)" },
  { title: "Поддержка", description: "Обращения пользователей (E15, E16)" },
  { title: "Справочники", description: "Города, валюты, веса, стоп-лист (E05, E16)" },
] as const;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Сводка</h1>
        <p className="mt-1 text-[var(--color-muted-foreground)]">
          Каркас админ-панели (E01). Разделы наполняются по мере готовности связанных эпиков.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)]"
          >
            <h2 className="text-base font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {section.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
