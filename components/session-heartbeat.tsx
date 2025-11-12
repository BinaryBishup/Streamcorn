"use client";

import { useEffect } from "react";
import { updateSessionActivity } from "@/lib/device-session";

/**
 * Component that updates session activity every 5 minutes
 * to keep the device session alive
 */
export function SessionHeartbeat() {
  useEffect(() => {
    // Update immediately on mount
    updateSessionActivity();

    // Set up interval to update every 5 minutes
    const interval = setInterval(() => {
      updateSessionActivity();
    }, 5 * 60 * 1000); // 5 minutes

    // Also update on page visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateSessionActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null; // This component doesn't render anything
}
