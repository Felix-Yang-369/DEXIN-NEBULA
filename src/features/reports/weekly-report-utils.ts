export function datePartsInShanghai(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function mondayForDate(date = new Date()) {
  const { year, month, day } = datePartsInShanghai(date);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - dayOfWeek + 1);
  return isoDate(utcDate);
}

export function addDays(iso: string, amount: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
}

export function defaultReportingWeek() {
  return addDays(mondayForDate(), -7);
}

export function isValidReportingWeek(
  value: string | undefined,
): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
}

export function reportingWeekOptions(count = 13) {
  const currentMonday = mondayForDate();
  return Array.from({ length: count }, (_, index) =>
    addDays(currentMonday, index * -7),
  );
}

export function formatWeekRange(weekStart: string) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
  });
  return `${formatter.format(new Date(`${weekStart}T00:00:00Z`))} — ${formatter.format(
    new Date(`${addDays(weekStart, 6)}T00:00:00Z`),
  )}`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "尚未提交";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
