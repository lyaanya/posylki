import { createHmac, randomBytes } from "node:crypto";

/**
 * ТЗ E16 п.16.3 — двухфакторная аутентификация по одноразовому коду из
 * приложения-аутентификатора (RFC 6238 TOTP). Реализовано без внешней
 * библиотеки: алгоритм небольшой и стабильный (HMAC-SHA1, шаг 30с, 6
 * цифр — тот же стандарт, что Google Authenticator/Authy/1Password), а
 * добавлять зависимость ради него — не обязательный риск в конце сессии.
 * Секрет вводится в приложение-аутентификатор вручную (base32-строка),
 * без генерации QR-кода — большинство приложений одинаково хорошо
 * поддерживают оба способа.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;

/** Экспортирован только ради теста по официальным векторам RFC 6238 (см. totp.spec.ts). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Новый секрет для привязки приложения-аутентификатора (первый вход сотрудника, п.16.3). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Экспортирован только ради проверки по официальным тест-векторам RFC 6238 (см. totp.spec.ts). */
export function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

/**
 * Проверяет код с допуском ±1 шаг (30с) на рассинхрон часов между
 * сервером и телефоном сотрудника — стандартная практика TOTP-проверки.
 */
export function verifyTotpCode(secret: string, code: string, now: Date = new Date()): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  const counter = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    if (hotp(secret, counter + drift) === trimmed) return true;
  }
  return false;
}

/** Для отображения сотруднику при первой привязке — вводится вручную в приложение-аутентификатор. */
export function formatSecretForDisplay(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
