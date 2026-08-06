const dayMilliseconds = 86_400_000;

function utcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function remainingLeave(entitled: number, used: number) {
  return Math.max(0, Number(entitled) - Number(used));
}

export function contractExpiresWithin(
  endsOn: string | null,
  asOfDate: string,
  days: number,
) {
  if (!endsOn) return false;
  const difference = (utcDay(endsOn) - utcDay(asOfDate)) / dayMilliseconds;
  return difference <= days;
}
