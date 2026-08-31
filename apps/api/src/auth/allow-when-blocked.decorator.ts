import { SetMetadata } from "@nestjs/common";

export const ALLOW_WHEN_BLOCKED_KEY = "allowWhenBlocked";

/**
 * ТЗ E15 п.15.6 — заблокированный пользователь сохраняет доступ к
 * поддержке (иначе оспорить блокировку невозможно). AuthGuard обычно
 * отклоняет любой запрос заблокированного (E12 п.12.15) — этот декоратор
 * снимает только это ограничение для конкретного маршрута, токен и
 * остальные проверки (валидность сессии, deletedAt) остаются как есть.
 */
export const AllowWhenBlocked = () => SetMetadata(ALLOW_WHEN_BLOCKED_KEY, true);
