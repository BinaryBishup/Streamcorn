"use client";

import { X, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription";

interface UpgradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: SubscriptionPlan;
  requiredPlan?: SubscriptionPlan;
}

export function UpgradeDrawer({ isOpen, onClose, currentPlan, requiredPlan }: UpgradeDrawerProps) {
  if (!isOpen) return null;

  const plans: SubscriptionPlan[] = ['basic', 'premium', 'ultra'];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-zinc-950 rounded-t-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Upgrade Your Plan</h2>
            <p className="text-sm text-zinc-400 mt-1">
              {requiredPlan
                ? `Unlock ${SUBSCRIPTION_PLANS[requiredPlan].name} features and more`
                : "Choose the plan that's right for you"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Plans */}
        <div className="p-6 space-y-4">
          {plans.map((planKey) => {
            const plan = SUBSCRIPTION_PLANS[planKey];
            const isCurrent = currentPlan === planKey;
            const isRecommended = planKey === requiredPlan;

            return (
              <div
                key={planKey}
                className={`relative rounded-xl border-2 p-6 transition-all ${
                  isCurrent
                    ? "border-zinc-600 bg-zinc-900/50"
                    : isRecommended
                    ? "border-red-500 bg-red-500/10"
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                }`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-3 left-6 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" fill="currentColor" />
                    RECOMMENDED
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-700 text-white text-xs font-bold rounded-full">
                    CURRENT PLAN
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    <p className="text-3xl font-bold text-white">
                      {plan.price}
                    </p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-3 text-zinc-300">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">
                        {plan.qualities.join(", ")}
                      </strong>{" "}
                      video quality
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-zinc-300">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>
                      Watch on{" "}
                      <strong className="text-white">
                        {plan.deviceLimit} {plan.deviceLimit === 1 ? "device" : "devices"}
                      </strong>{" "}
                      at once
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-zinc-300">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Unlimited movies and TV shows</span>
                  </li>
                  <li className="flex items-start gap-3 text-zinc-300">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Cancel anytime</span>
                  </li>
                </ul>

                {/* CTA Button */}
                {isCurrent ? (
                  <Button
                    disabled
                    className="w-full bg-zinc-700 text-zinc-400 cursor-not-allowed"
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      isRecommended
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-white text-black hover:bg-zinc-200"
                    }`}
                    onClick={() => {
                      // TODO: Implement upgrade logic
                      console.log(`Upgrade to ${planKey}`);
                    }}
                  >
                    {planKey === 'basic' ? 'Downgrade' : 'Upgrade'} to {plan.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent p-6 pt-8">
          <p className="text-center text-sm text-zinc-500">
            All plans include unlimited streaming and offline downloads
          </p>
        </div>
      </div>
    </>
  );
}
