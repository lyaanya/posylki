import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    // Интеграционные тесты бьют в реальную dev-БД Supabase по сети — 5с
    // дефолт vitest слишком мал и время от времени ловит таймаут на ровном
    // месте даже без параллельной нагрузки. 20с хватает с запасом.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Каждый *.repository.spec.ts открывает свой пул соединений к одной и
    // той же удалённой Supabase БД (createDatabase в beforeAll). При
    // параллельном запуске ~20 файлов это упирается в лимит соединений на
    // стороне Supabase, и beforeAll/afterAll части файлов виснут в таймаут
    // без какой-либо связи с реальным багом. Последовательный запуск файлов
    // медленнее, но детерминирован.
    fileParallelism: false,
  },
});
