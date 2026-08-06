const dayMilliseconds = 86_400_000;

function utcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function dateRangeOverlapDays(
  startDate: string,
  endDate: string,
  rangeStart: string,
  rangeEnd: string,
) {
  const start = Math.max(utcDay(startDate), utcDay(rangeStart));
  const end = Math.min(utcDay(endDate), utcDay(rangeEnd));
  if (end < start) return 0;
  return Math.floor((end - start) / dayMilliseconds) + 1;
}

export function isOnApprovedLeave(
  status: string,
  startDate: string,
  endDate: string,
  date: string,
) {
  return status === "approved" && startDate <= date && endDate >= date;
}

export function leaveBalanceSyncLabel(status: string) {
  const labels: Record<string, string> = {
    recorded: "已同步余额",
    not_applicable: "仅记录考勤",
    balance_missing: "假期账户未配置",
    insufficient_balance: "可用余额不足",
  };
  return labels[status] ?? "状态未知";
}
