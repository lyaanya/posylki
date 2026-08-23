/**
 * Соответствие клавиш ЙЦУКЕН ↔ QWERTY по физическому положению (E05 п. 5.2,
 * "Поиск с учётом раскладки"). Нужно, когда человек набрал русское слово при
 * включённой английской раскладке (или наоборот) — буквы физически верные,
 * но раскладка не та: «нячанг» набранное как «yzxfyu».
 */
const RU_TO_EN: Record<string, string> = {
  й: "q",
  ц: "w",
  у: "e",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ф: "a",
  ы: "s",
  в: "d",
  а: "f",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  с: "c",
  м: "v",
  и: "b",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
};

const EN_TO_RU: Record<string, string> = Object.fromEntries(
  Object.entries(RU_TO_EN).map(([ru, en]) => [en, ru]),
);

function remap(text: string, table: Record<string, string>): string {
  return Array.from(text)
    .map((char) => table[char] ?? char)
    .join("");
}

/** «yzxfyu» → «нячанг» — латиница физически набрана в русской раскладке. */
export function latinToCyrillicByLayout(text: string): string {
  return remap(text, EN_TO_RU);
}

/** «yfxfyu» — обратный случай: кириллица набрана в латинской раскладке. */
export function cyrillicToLatinByLayout(text: string): string {
  return remap(text, RU_TO_EN);
}

/**
 * Все варианты нормализации запроса для поиска по подстроке: как есть,
 * и оба варианта "не той раскладки". Регистр не трогает вызывающий код
 * (обычно всё уже приведено к нижнему регистру перед вызовом).
 */
export function expandLayoutVariants(query: string): string[] {
  const variants = new Set([query, latinToCyrillicByLayout(query), cyrillicToLatinByLayout(query)]);
  return Array.from(variants);
}
