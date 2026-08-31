import { describe, expect, it } from "vitest";
import { hashDocumentNumber } from "./document-hash.js";

describe("hashDocumentNumber", () => {
  const salt = "test-salt";

  it("нормализует регистр и пробелы до хэширования", () => {
    expect(hashDocumentNumber("ab 12 34", salt)).toBe(hashDocumentNumber("AB1234", salt));
  });

  it("детерминирована для одного и того же входа", () => {
    expect(hashDocumentNumber("AB1234", salt)).toBe(hashDocumentNumber("AB1234", salt));
  });

  it("разная соль даёт разный хэш для одного и того же номера", () => {
    expect(hashDocumentNumber("AB1234", "salt-a")).not.toBe(hashDocumentNumber("AB1234", "salt-b"));
  });

  it("разный номер документа даёт разный хэш", () => {
    expect(hashDocumentNumber("AB1234", salt)).not.toBe(hashDocumentNumber("AB1235", salt));
  });
});
