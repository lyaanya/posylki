import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";

interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  database: "ok" | "unavailable" | "not_configured";
}

@Controller("health")
export class HealthController {
  /**
   * Проверка базы данных подключается в задаче 1.3 вместе со слоем
   * репозиториев. До этого момента поле database информирует о том,
   * что проверка ещё не подключена, а не притворяется рабочей.
   */
  @Get()
  check(@Res() res: Response): void {
    const body: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "not_configured",
    };

    res.status(HttpStatus.OK).json(body);
  }
}
