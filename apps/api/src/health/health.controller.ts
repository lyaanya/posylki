import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { sql, type Kysely } from "kysely";
import { Public } from "../auth/public.decorator.js";
import type { DB } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";

interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  database: "ok" | "unavailable";
}

@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  @Public()
  @Get()
  async check(@Res() res: Response): Promise<void> {
    const database = await this.checkDatabase();
    const status = database === "ok" ? "ok" : "degraded";

    const body: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      database,
    };

    res.status(status === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }

  private async checkDatabase(): Promise<"ok" | "unavailable"> {
    try {
      await sql`select 1`.execute(this.db);
      return "ok";
    } catch {
      return "unavailable";
    }
  }
}
