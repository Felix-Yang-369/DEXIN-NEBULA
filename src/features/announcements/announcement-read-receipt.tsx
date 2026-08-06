"use client";

import { useEffect } from "react";
import { markAnnouncementReadAction } from "./server-actions";

export function AnnouncementReadReceipt({
  announcementId,
}: {
  announcementId: string;
}) {
  useEffect(() => {
    void markAnnouncementReadAction(announcementId);
  }, [announcementId]);

  return null;
}
