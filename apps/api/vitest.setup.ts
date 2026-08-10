import "reflect-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Тот же .env в корне репозитория, что читает и приложение (см. app.module.ts).
config({ path: path.resolve(currentDir, "../../.env") });
