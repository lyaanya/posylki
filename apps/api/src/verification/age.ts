/** ТЗ E04 п.4.4 — учитывает месяц/день, а не только разницу годов. */
export function isAdult(dateOfBirthIso: string, today: Date = new Date()): boolean {
  const dob = new Date(dateOfBirthIso);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age >= 18;
}
