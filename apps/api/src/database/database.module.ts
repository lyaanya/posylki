import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.js";
import { createDatabase } from "./database.js";

/**
 * Kysely<DB> — generic-тип, у него нет стабильного class-значения для
 * использования как токен DI. DATABASE — символ-токен для инъекции.
 */
export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (config: ConfigService<Env, true>) =>
        createDatabase(config.get("SUPABASE_DB_URL", { infer: true })),
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
