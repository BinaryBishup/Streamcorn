"use client";

import { SubscriptionProvider } from "@/contexts/subscription-context";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { DeviceSessionGuard } from "@/components/device-session-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <SessionHeartbeat />
      <DeviceSessionGuard>{children}</DeviceSessionGuard>
    </SubscriptionProvider>
  );
}
