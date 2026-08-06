const dayMilliseconds = 86_400_000;

function utcDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function qualificationRisk(
  expiresOn: string | null,
  asOfDate: string,
  warningDays = 60,
) {
  if (!expiresOn) return "no_expiry" as const;
  const days = (utcDay(expiresOn) - utcDay(asOfDate)) / dayMilliseconds;
  if (days < 0) return "expired" as const;
  if (days <= warningDays) return "expiring" as const;
  return "valid" as const;
}

export function supplierRiskSummary(
  qualifications: Array<{ expires_on: string | null; status: string }>,
  asOfDate: string,
) {
  const active = qualifications.filter((item) => item.status === "active");
  if (active.some((item) => qualificationRisk(item.expires_on, asOfDate) === "expired")) {
    return "expired" as const;
  }
  if (active.some((item) => qualificationRisk(item.expires_on, asOfDate) === "expiring")) {
    return "expiring" as const;
  }
  if (active.length === 0) return "missing" as const;
  return "normal" as const;
}
