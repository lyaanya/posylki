/**
 * Отдельный файл без "use client": используется и с сервера (публичный
 * профиль — серверный компонент), и с клиента (шапка). lib/auth.ts не
 * годится — весь модуль с "use client" нельзя вызывать при серверном рендере.
 */
export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return nameOrEmail.slice(0, 2).toUpperCase();
}
