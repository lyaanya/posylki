import { describe, expect, it } from "vitest";
import { base32Encode, generateTotpSecret, hotp, verifyTotpCode } from "./totp.js";

// RFC 6238 Appendix B — официальные тест-векторы для SHA1, секрет — ASCII
// "12345678901234567890". Векторы восьмизначные; наш код — шестизначный
// (CODE_DIGITS=6), но binary % 10^6 математически равно последним 6
// цифрам восьмизначного (с сохранением ведущих нулей) значения — поэтому
// сравниваем с последними 6 символами официального вектора.
const RFC_SECRET_ASCII = "12345678901234567890";
const RFC_SECRET_BASE32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, "ascii"));

describe("hotp (RFC 6238 Appendix B test vectors)", () => {
  const cases: [number, string][] = [
    [1, "94287082"],
    [37037036, "07081804"],
    [37037037, "14050471"],
    [41152263, "89005924"],
    [66666666, "69279037"],
  ];

  it.each(cases)("counter %i даёт код, совпадающий с official vector %s (последние 6 цифр)", (counter, expected8) => {
    expect(hotp(RFC_SECRET_BASE32, counter)).toBe(expected8.slice(-6));
  });
});

describe("verifyTotpCode", () => {
  it("принимает верный код для текущего момента", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-01-01T12:00:00Z");
    const counter = Math.floor(now.getTime() / 1000 / 30);
    const code = hotp(secret, counter);
    expect(verifyTotpCode(secret, code, now)).toBe(true);
  });

  it("принимает код соседнего шага (допуск на рассинхрон часов)", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-01-01T12:00:00Z");
    const counter = Math.floor(now.getTime() / 1000 / 30);
    const codeOneStepAhead = hotp(secret, counter + 1);
    expect(verifyTotpCode(secret, codeOneStepAhead, now)).toBe(true);
  });

  it("отклоняет код за пределами допуска", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-01-01T12:00:00Z");
    const counter = Math.floor(now.getTime() / 1000 / 30);
    const codeTooFarAhead = hotp(secret, counter + 5);
    expect(verifyTotpCode(secret, codeTooFarAhead, now)).toBe(false);
  });

  it("отклоняет неверный формат (не 6 цифр)", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "12345")).toBe(false);
    expect(verifyTotpCode(secret, "abcdef")).toBe(false);
  });

  it("отклоняет код от другого секрета", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const now = new Date("2026-01-01T12:00:00Z");
    const counter = Math.floor(now.getTime() / 1000 / 30);
    const codeForB = hotp(secretB, counter);
    expect(verifyTotpCode(secretA, codeForB, now)).toBe(false);
  });
});
