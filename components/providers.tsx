"use client";

import { SubscriptionProvider } from "@/contexts/subscription-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      {children}
    </SubscriptionProvider>
  );
}
