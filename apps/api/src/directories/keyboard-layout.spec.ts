import { describe, expect, it } from "vitest";
import {
  cyrillicToLatinByLayout,
  expandLayoutVariants,
  latinToCyrillicByLayout,
} from "./keyboard-layout.js";

describe("keyboard-layout", () => {
  it("переводит «yzxfyu», набранное не в той раскладке, в «нячанг» (E05 п. 5.2)", () => {
    expect(latinToCyrillicByLayout("yzxfyu")).toBe("нячанг");
  });

  it("переводит «нячанг» в «yzxfyu» и обратно", () => {
    expect(cyrillicToLatinByLayout("нячанг")).toBe("yzxfyu");
  });

  it("expandLayoutVariants включает исходный запрос и оба варианта раскладки", () => {
    const variants = expandLayoutVariants("yzxfyu");
    expect(variants).toContain("yzxfyu");
    expect(variants).toContain("нячанг");
  });
});
