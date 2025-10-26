"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Subscription, type SubscriptionPlan } from "@/lib/subscription";

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isActive: boolean;
  plan: SubscriptionPlan;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // If no subscription exists, create a default basic plan
        if (error.code === 'PGRST116') {
          const { data: newSub, error: createError } = await supabase
            .from("subscriptions")
            .insert({
              user_id: user.id,
              plan: 'basic',
              device_limit: 1,
              status: 'active',
            })
            .select()
            .single();

          if (!createError && newSub) {
            setSubscription(newSub);
          }
        } else {
          console.error("Error loading subscription:", error);
        }
      } else {
        setSubscription(data);
      }
    } catch (error) {
      console.error("Error in loadSubscription:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();

    // Subscribe to auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      loadSubscription();
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const isActive = subscription?.status === 'active';
  const plan: SubscriptionPlan = subscription?.plan || 'basic';

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        isActive,
        plan,
        refreshSubscription: loadSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
