import { HttpStatus } from "@nestjs/common";
import { AppException } from "../common/app-exception.js";
import type { DealStatus } from "./deals.types.js";

/**
 * Разрешённые переходы (ТЗ п.10.1, тех. детали эпика — "машина состояний
 * реализуется явно, отдельным модулем"). Строгий линейный порядок плюс
 * два выхода в терминальные статусы — это и есть гарантия "обратные
 * переходы запрещены" (10.4) на уровне структуры, без отдельной проверки.
 *
 * Единственное исключение из ТЗ — "возврат из шага передачи на
 * переподтверждение при перевесе" (10.17) — реализовано НЕ как переход
 * статуса назад, а как блокировка перехода вперёд: попытка handed_over
 * с перевесом пересчитывает цену и сбрасывает согласие обеих сторон, но
 * status остаётся 'agreed' (см. attemptHandover в deals.service.ts).
 * Формально статус никогда не движется назад — только не продвигается,
 * пока стороны не подтвердят заново.
 */
const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  responded: ["agreed", "cancelled"],
  agreed: ["handed_over", "cancelled"],
  handed_over: ["in_transit", "problem"],
  in_transit: ["awaiting_pickup", "problem"],
  awaiting_pickup: ["delivered", "problem"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
  problem: [],
};

export function assertDealTransitionAllowed(from: DealStatus, to: DealStatus): void {
  if (!DEAL_TRANSITIONS[from].includes(to)) {
    throw new AppException({
      code: "INVALID_DEAL_TRANSITION",
      message: `Переход из статуса "${from}" в "${to}" недопустим`,
      status: HttpStatus.BAD_REQUEST,
    });
  }
}
