"use client";

import { SubscriptionProvider } from "@/contexts/subscription-context";
import { SessionHeartbeat } from "@/components/session-heartbeat";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <SessionHeartbeat />
      {children}
    </SubscriptionProvider>
  );
}
