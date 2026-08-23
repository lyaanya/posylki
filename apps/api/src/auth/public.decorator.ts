import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Помечает эндпоинт доступным гостю без входа (E03 п. 3.10: уровень «Гость»).
 * Без этого декоратора AuthGuard требует валидный токен на любом маршруте.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
