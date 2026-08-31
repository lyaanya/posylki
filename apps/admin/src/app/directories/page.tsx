"use client";

import { useEffect, useState } from "react";
import {
  createDirectoryItem,
  fetchDirectory,
  setDirectoryItemActive,
  updateDirectoryItem,
  type DirectoryResource,
} from "@/lib/directories";

type FieldType = "text" | "number" | "textarea" | "list";

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
}

interface ResourceConfig {
  resource: DirectoryResource;
  label: string;
  fields: FieldConfig[];
  columns: { key: string; label: string }[];
}

/** ТЗ E16 п.16.26 — 5 структурно похожих справочников через одну CRUD-таблицу. */
const RESOURCES: ResourceConfig[] = [
  {
    resource: "cities",
    label: "Города",
    fields: [
      { key: "nameRu", label: "Название (рус.)", type: "text", required: true },
      { key: "nameEn", label: "Название (англ.)", type: "text", required: true },
      { key: "countryCode", label: "Код страны", type: "text", required: true },
      { key: "timezone", label: "Часовой пояс", type: "text", required: true },
      { key: "sortOrder", label: "Порядок сортировки", type: "number" },
      { key: "synonyms", label: "Синонимы (через запятую)", type: "list" },
    ],
    columns: [
      { key: "nameRu", label: "Название" },
      { key: "countryCode", label: "Страна" },
      { key: "timezone", label: "Часовой пояс" },
    ],
  },
  {
    resource: "currencies",
    label: "Валюты",
    fields: [
      { key: "code", label: "Код (ISO)", type: "text", required: true },
      { key: "name", label: "Название", type: "text", required: true },
      { key: "symbol", label: "Символ", type: "text", required: true },
      { key: "decimalPlaces", label: "Знаков после запятой", type: "number", required: true },
    ],
    columns: [
      { key: "code", label: "Код" },
      { key: "name", label: "Название" },
      { key: "symbol", label: "Символ" },
    ],
  },
  {
    resource: "weight-references",
    label: "Справочник веса",
    fields: [
      { key: "name", label: "Название", type: "text", required: true },
      { key: "weightGrams", label: "Вес, г", type: "number", required: true },
      { key: "weightGramsMax", label: "Вес до, г (диапазон)", type: "number" },
      { key: "category", label: "Категория", type: "text" },
      { key: "sortOrder", label: "Порядок сортировки", type: "number" },
    ],
    columns: [
      { key: "name", label: "Название" },
      { key: "weightGrams", label: "Вес, г" },
      { key: "category", label: "Категория" },
    ],
  },
  {
    resource: "stop-list",
    label: "Стоп-лист",
    fields: [
      { key: "name", label: "Название", type: "text", required: true },
      { key: "explanation", label: "Пояснение", type: "textarea" },
      { key: "category", label: "Категория", type: "text" },
      { key: "countryCode", label: "Код страны (пусто = везде)", type: "text" },
    ],
    columns: [
      { key: "name", label: "Название" },
      { key: "category", label: "Категория" },
      { key: "countryCode", label: "Страна" },
    ],
  },
  {
    resource: "document-types",
    label: "Типы документов",
    fields: [
      { key: "name", label: "Название", type: "text", required: true },
      { key: "countryCode", label: "Код страны", type: "text", required: true },
      { key: "numberPattern", label: "Шаблон номера (regex)", type: "text" },
    ],
    columns: [
      { key: "name", label: "Название" },
      { key: "countryCode", label: "Страна" },
      { key: "numberPattern", label: "Шаблон" },
    ],
  },
];

type Item = Record<string, unknown> & { id: string; isActive: boolean };

export default function DirectoriesPage() {
  const [activeResource, setActiveResource] = useState<DirectoryResource>("cities");
  const [items, setItems] = useState<Item[] | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = RESOURCES.find((r) => r.resource === activeResource)!;

  function load(resource: DirectoryResource) {
    setItems(null);
    fetchDirectory<Item>(resource)
      .then(setItems)
      .catch(() => setItems([]));
  }

  useEffect(() => {
    load(activeResource);
    setFormValues({});
    setEditingId(null);
    setError(null);
  }, [activeResource]);

  function startEdit(item: Item) {
    const values: Record<string, string> = {};
    for (const field of config.fields) {
      const raw = item[field.key];
      values[field.key] = field.type === "list" && Array.isArray(raw) ? raw.join(", ") : raw != null ? String(raw) : "";
    }
    setFormValues(values);
    setEditingId(item.id);
  }

  function cancelEdit() {
    setFormValues({});
    setEditingId(null);
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      const raw = formValues[field.key]?.trim() ?? "";
      if (raw === "") continue;
      if (field.type === "number") payload[field.key] = Number(raw);
      else if (field.type === "list") payload[field.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      else payload[field.key] = raw;
    }
    return payload;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = config.fields.filter((f) => f.required && !formValues[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Заполните обязательные поля: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    try {
      const payload = buildPayload();
      if (editingId) await updateDirectoryItem(activeResource, editingId, payload);
      else await createDirectoryItem(activeResource, payload);
      cancelEdit();
      load(activeResource);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  }

  async function toggleActive(item: Item) {
    await setDirectoryItemActive(activeResource, item.id, !item.isActive);
    load(activeResource);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Справочники</h1>

      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {RESOURCES.map((r) => (
          <button
            key={r.resource}
            type="button"
            onClick={() => setActiveResource(r.resource)}
            className={`rounded-t-[var(--radius-sm)] px-3 py-2 text-sm font-medium ${
              activeResource === r.resource
                ? "bg-[var(--color-card)] text-[var(--color-primary)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      >
        <p className="text-sm font-medium">{editingId ? "Изменить запись" : "Новая запись"}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {config.fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
              {field.label}
              {field.type === "textarea" ? (
                <textarea
                  rows={2}
                  value={formValues[field.key] ?? ""}
                  onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={formValues[field.key] ?? ""}
                  onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)]"
                />
              )}
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            className="self-start rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)]"
          >
            {editingId ? "Сохранить" : "Добавить"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="self-start rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      {items === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                {config.columns.map((col) => (
                  <th key={col.key} className="px-4 py-2 font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                  {config.columns.map((col) => (
                    <td key={col.key} className="px-4 py-2">
                      {String(item[col.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(item)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.isActive
                          ? "bg-[var(--color-success)] text-[var(--color-on-success)]"
                          : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                      }`}
                    >
                      {item.isActive ? "активна" : "отключена"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                    >
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length + 2} className="px-4 py-6 text-center text-[var(--color-muted-foreground)]">
                    Записей нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
