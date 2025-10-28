"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Check, Monitor, Users, Sparkles, ArrowLeft } from "lucide-react";
import { useSubscription } from "@/contexts/subscription-context";

export default function SubscribePage() {
  const router = useRouter();
  const supabase = createClient();
  const { plan: currentPlan, refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    setLoading(true);
    setSelectedPlan(plan);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      // Check if user already has a subscription
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (existingSubscription) {
        // Update existing subscription
        const { error } = await supabase
          .from("subscriptions")
          .update({
            plan,
            device_limit: SUBSCRIPTION_PLANS[plan].deviceLimit,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase.from("subscriptions").insert({
          user_id: user.id,
          plan,
          device_limit: SUBSCRIPTION_PLANS[plan].deviceLimit,
          status: "active",
          started_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      // Refresh subscription context
      await refreshSubscription();

      // Redirect to home
      router.push("/");
    } catch (error) {
      console.error("Error updating subscription:", error);
      alert("Failed to update subscription. Please try again.");
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const planConfig = {
    basic: {
      title: "Basic",
      price: "280",
      description: "Perfect for individual viewing",
      features: [
        { icon: Monitor, text: "SD (480p) streaming quality" },
        { icon: Users, text: "Watch on 1 device at a time" },
        { icon: Check, text: "Unlimited movies & TV shows" },
        { icon: Check, text: "Access on mobile, tablet & computer" },
        { icon: Check, text: "Personalized recommendations" },
        { icon: Check, text: "Cancel anytime" },
      ],
    },
    premium: {
      title: "Premium",
      price: "450",
      description: "Great for couples and small families",
      features: [
        { icon: Sparkles, text: "HD (720p) streaming quality" },
        { icon: Users, text: "Watch on 2 devices at a time" },
        { icon: Check, text: "Unlimited movies & TV shows" },
        { icon: Check, text: "Access on mobile, tablet & computer" },
        { icon: Check, text: "Download content on 2 devices" },
        { icon: Check, text: "Personalized recommendations" },
        { icon: Check, text: "Cancel anytime" },
      ],
    },
    ultra: {
      title: "Ultra",
      price: "650",
      description: "Full access to premium streaming",
      features: [
        { icon: Sparkles, text: "Full HD (1080p) streaming quality" },
        { icon: Users, text: "Watch on 4 devices at a time" },
        { icon: Check, text: "Unlimited movies & TV shows" },
        { icon: Check, text: "Access on mobile, tablet, computer & TV" },
        { icon: Check, text: "Download content on 4 devices" },
        { icon: Check, text: "Personalized recommendations" },
        { icon: Check, text: "Priority customer support" },
        { icon: Check, text: "Cancel anytime" },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-white">StreamCorn Subscription Plans</h1>
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          {(Object.keys(planConfig) as SubscriptionPlan[]).map((planKey) => {
            const config = planConfig[planKey];
            const isCurrentPlan = currentPlan === planKey;

            return (
              <div
                key={planKey}
                className="relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 hover:border-zinc-700 transition-colors"
              >
                {/* Plan Title */}
                <h2 className="text-2xl font-semibold text-white mb-6">{config.title}</h2>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-sm text-zinc-400">₹</span>
                    <span className="text-5xl font-medium text-white tracking-tight">
                      {config.price}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    INR / month (inclusive of GST)
                  </p>
                </div>

                {/* Description */}
                <p className="text-zinc-400 mb-6">{config.description}</p>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={loading || isCurrentPlan}
                  className={`w-full h-12 rounded-lg font-medium mb-8 transition-all ${
                    isCurrentPlan
                      ? "bg-zinc-700 text-zinc-400 cursor-not-allowed hover:bg-zinc-700"
                      : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  {loading && selectedPlan === planKey
                    ? "Processing..."
                    : isCurrentPlan
                    ? "Current Plan"
                    : `Get ${config.title}`}
                </Button>

                {/* Features */}
                <ul className="space-y-3">
                  {config.features.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <li key={index} className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-zinc-300">{feature.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500">
            All plans include unlimited streaming and the ability to cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
