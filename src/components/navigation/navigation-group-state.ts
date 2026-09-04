export function ensureNavigationGroupOpen(
  current: ReadonlySet<string>,
  groupLabel?: string,
) {
  if (!groupLabel || current.has(groupLabel)) return current;

  const next = new Set(current);
  next.add(groupLabel);
  return next;
}

export function setNavigationGroupOpen(
  current: ReadonlySet<string>,
  groupLabel: string,
  open: boolean,
) {
  if (current.has(groupLabel) === open) return current;

  const next = new Set(current);

  if (open) next.add(groupLabel);
  else next.delete(groupLabel);

  return next;
}

export function createNavigationGroupMemory() {
  const remembered = new Set<string>();

  return {
    remember(groupLabels: readonly string[], openGroups: ReadonlySet<string>) {
      for (const label of groupLabels) remembered.delete(label);
      for (const label of openGroups) {
        if (groupLabels.includes(label)) remembered.add(label);
      }
    },
    restore(groupLabels: readonly string[], activeGroup?: string) {
      const restored = new Set(
        groupLabels.filter((label) => remembered.has(label)),
      );
      const openGroups = ensureNavigationGroupOpen(restored, activeGroup);

      for (const label of openGroups) remembered.add(label);
      return openGroups;
    },
  };
}

type NavigationGroupMemory = ReturnType<typeof createNavigationGroupMemory>;

let browserNavigationGroupMemory: NavigationGroupMemory | undefined;

export function getNavigationGroupMemory() {
  if (typeof window === "undefined") {
    return createNavigationGroupMemory();
  }

  browserNavigationGroupMemory ??= createNavigationGroupMemory();
  return browserNavigationGroupMemory;
}
