export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

const dayMilliseconds = 86_400_000;

function utcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function outstandingAmount(total: number, settled: number) {
  return Math.max(0, Number(total) - Number(settled));
}

export function agingBucket(dueDate: string, asOfDate: string): AgingBucket {
  const overdueDays = Math.floor(
    (utcDay(asOfDate) - utcDay(dueDate)) / dayMilliseconds,
  );

  if (overdueDays <= 0) return "current";
  if (overdueDays <= 30) return "1-30";
  if (overdueDays <= 60) return "31-60";
  if (overdueDays <= 90) return "61-90";
  return "90+";
}
