"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { useSubscription } from "@/contexts/subscription-context";
import Image from "next/image";

export default function SubscribePage() {
  const router = useRouter();
  const supabase = createClient();
  const { plan: currentPlan, refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [popularMovies, setPopularMovies] = useState<string[]>([]);

  useEffect(() => {
    fetchPopularMovies();
  }, []);

  const fetchPopularMovies = async () => {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US&page=1`
      );
      const data = await response.json();
      const posters = data.results
        .filter((movie: any) => movie.poster_path)
        .slice(0, 30)
        .map((movie: any) => `https://image.tmdb.org/t/p/w342${movie.poster_path}`);
      setPopularMovies(posters);
    } catch (error) {
      console.error("Error fetching popular movies:", error);
    }
  };

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
      quality: "SD (480p)",
      devices: "1 device",
      features: [
        "Unlimited movies & TV shows",
        "Watch on mobile, tablet, computer & TV",
        "Personalized recommendations",
        "Cancel anytime",
      ],
    },
    premium: {
      title: "Premium",
      price: "450",
      description: "Great for couples and small families",
      quality: "HD (720p)",
      devices: "2 devices",
      features: [
        "Unlimited movies & TV shows",
        "Watch on mobile, tablet, computer & TV",
        "Personalized recommendations",
        "Cancel anytime",
      ],
    },
    ultra: {
      title: "Ultra",
      price: "650",
      description: "Full access to premium streaming",
      quality: "Full HD (1080p)",
      devices: "4 devices",
      features: [
        "Unlimited movies & TV shows",
        "Watch on mobile, tablet, computer & TV",
        "Personalized recommendations",
        "Priority customer support",
        "Cancel anytime",
      ],
    },
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-zinc-400 hover:text-white mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-xl font-semibold text-white">Plans</h1>
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

                {/* Key Features - Quality & Devices */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <span className="text-sm text-zinc-400">Video Quality</span>
                    <span className="text-sm font-semibold text-white">{config.quality}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <span className="text-sm text-zinc-400">Devices</span>
                    <span className="text-sm font-semibold text-white">{config.devices}</span>
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={loading || isCurrentPlan}
                  className={`w-full h-12 rounded-lg font-medium mb-6 transition-all ${
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
                <ul className="space-y-2.5">
                  {config.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-300">{feature}</span>
                    </li>
                  ))}
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

      {/* Movie Posters Background Slider with OTT Logos */}
      {popularMovies.length > 0 && (
        <div className="relative w-full overflow-hidden py-16 bg-black">
          {/* Animated Poster Rows */}
          <div className="relative space-y-4">
            {/* Row 1 - Moving Right */}
            <div className="flex gap-4 animate-scroll-right">
              {[...popularMovies.slice(0, 10), ...popularMovies.slice(0, 10)].map((poster, i) => (
                <div key={`row1-${i}`} className="relative flex-shrink-0 w-32 h-48 rounded-lg overflow-hidden">
                  <Image
                    src={poster}
                    alt="Movie"
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              ))}
            </div>

            {/* Row 2 - Moving Left */}
            <div className="flex gap-4 animate-scroll-left">
              {[...popularMovies.slice(10, 20), ...popularMovies.slice(10, 20)].map((poster, i) => (
                <div key={`row2-${i}`} className="relative flex-shrink-0 w-32 h-48 rounded-lg overflow-hidden">
                  <Image
                    src={poster}
                    alt="Movie"
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              ))}
            </div>

            {/* Row 3 - Moving Right */}
            <div className="flex gap-4 animate-scroll-right">
              {[...popularMovies.slice(20, 30), ...popularMovies.slice(20, 30)].map((poster, i) => (
                <div key={`row3-${i}`} className="relative flex-shrink-0 w-32 h-48 rounded-lg overflow-hidden">
                  <Image
                    src={poster}
                    alt="Movie"
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          {/* Platform Logos and Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="flex items-center gap-6 mb-6 flex-wrap justify-center px-4">
              <div className="relative w-24 h-12">
                <Image
                  src="/ott-logos/netflix.png"
                  alt="Netflix"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="relative w-24 h-12">
                <Image
                  src="/ott-logos/prime-video.png"
                  alt="Prime Video"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="relative w-24 h-12">
                <Image
                  src="/ott-logos/jioHotstar.png"
                  alt="Hotstar"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="relative w-24 h-12">
                <Image
                  src="/ott-logos/zee5.webp"
                  alt="Zee5"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="relative w-24 h-12">
                <Image
                  src="/ott-logos/hoichoi.png"
                  alt="Hoichoi"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <p className="text-white text-2xl font-semibold">Included in all plans</p>
          </div>
        </div>
      )}
    </div>
  );
}
