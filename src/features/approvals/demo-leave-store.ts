"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { LeaveRequest } from "./leave-workflow";

const DEMO_LEAVE_STORAGE_KEY = "dexin-nebula.demo.leave-request.v1";
const DEMO_LEAVE_CHANGE_EVENT = "dexin-nebula:demo-leave-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DEMO_LEAVE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DEMO_LEAVE_CHANGE_EVENT, onStoreChange);
  };
}

export function useDemoLeaveRequest() {
  const serializedRequest = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => window.localStorage.getItem(DEMO_LEAVE_STORAGE_KEY),
    () => undefined,
  );

  const saveRequest = useCallback((nextRequest: LeaveRequest) => {
    window.localStorage.setItem(
      DEMO_LEAVE_STORAGE_KEY,
      JSON.stringify(nextRequest),
    );
    window.dispatchEvent(new Event(DEMO_LEAVE_CHANGE_EVENT));
  }, []);

  const clearRequest = useCallback(() => {
    window.localStorage.removeItem(DEMO_LEAVE_STORAGE_KEY);
    window.dispatchEvent(new Event(DEMO_LEAVE_CHANGE_EVENT));
  }, []);

  const request = useMemo(() => {
    if (!serializedRequest) {
      return null;
    }

    try {
      return JSON.parse(serializedRequest) as LeaveRequest;
    } catch {
      return null;
    }
  }, [serializedRequest]);

  return {
    request,
    isReady: serializedRequest !== undefined,
    saveRequest,
    clearRequest,
  };
}
