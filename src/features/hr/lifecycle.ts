export type LifecycleTaskStatus =
  | "pending"
  | "completed"
  | "not_applicable";

export function lifecycleProgress(
  tasks: Array<{ status: LifecycleTaskStatus }>,
) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status !== "pending").length;

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function isLifecycleTaskOverdue(
  dueOn: string | null,
  status: LifecycleTaskStatus,
  today: string,
) {
  return Boolean(dueOn && status === "pending" && dueOn < today);
}
