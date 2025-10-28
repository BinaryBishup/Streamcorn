"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import {
  User,
  CreditCard,
  Tv,
  Heart,
  LogOut,
  ArrowRight,
  Trash2,
  Play,
  X,
  Crown,
  Smartphone,
  Monitor,
  Tablet,
} from "lucide-react";
import { useSubscription } from "@/contexts/subscription-context";
import Image from "next/image";
import { getTMDBImageUrl, fetchMovieDetails, fetchTVShowDetails } from "@/lib/tmdb";
import { getUserSessions, deleteSession, type UserSession } from "@/lib/device-session";

interface Profile {
  id: string;
  name: string;
  avatar: string;
  is_kids: boolean;
}

interface WatchlistItem {
  id: string;
  content_id: number;
  content_type: "movie" | "tv" | "anime";
  added_at: string;
}

interface ContentDetails {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
}

type TabType = "profile" | "watchlist" | "subscription" | "devices";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const { plan, subscription, refreshSubscription } = useSubscription();

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [loading, setLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistContent, setWatchlistContent] = useState<Map<number, ContentDetails>>(new Map());
  const [devices, setDevices] = useState<UserSession[]>([]);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      // Load current profile
      const profileId = localStorage.getItem("selected_profile_id");
      if (profileId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", profileId)
          .single();

        if (profile) {
          setCurrentProfile(profile);
          await loadWatchlist(profileId);
        }
      }

      // Load real device sessions
      const sessions = await getUserSessions(user.id);
      setDevices(sessions);
    } catch (error) {
      console.error("Error loading account data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWatchlist = async (profileId: string) => {
    try {
      const { data: watchlistData } = await supabase
        .from("watchlist")
        .select("*")
        .eq("profile_id", profileId)
        .order("added_at", { ascending: false });

      if (watchlistData) {
        setWatchlist(watchlistData);

        // Fetch content details from TMDB
        const contentMap = new Map<number, ContentDetails>();
        for (const item of watchlistData) {
          try {
            let details;
            if (item.content_type === "movie") {
              details = await fetchMovieDetails(item.content_id);
            } else {
              details = await fetchTVShowDetails(item.content_id);
            }
            contentMap.set(item.content_id, details);
          } catch (error) {
            console.error(`Error fetching content ${item.content_id}:`, error);
          }
        }
        setWatchlistContent(contentMap);
      }
    } catch (error) {
      console.error("Error loading watchlist:", error);
    }
  };

  const removeFromWatchlist = async (itemId: string, contentId: number) => {
    try {
      const { error } = await supabase.from("watchlist").delete().eq("id", itemId);

      if (error) throw error;

      setWatchlist(watchlist.filter((item) => item.id !== itemId));
      const newContentMap = new Map(watchlistContent);
      newContentMap.delete(contentId);
      setWatchlistContent(newContentMap);
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      alert("Failed to remove from watchlist");
    }
  };

  const handleSignOut = async () => {
    // Delete the current device session
    await deleteSession(localStorage.getItem("session_id") || "");

    // Sign out from Supabase
    await supabase.auth.signOut();

    // Clear all local storage
    localStorage.clear();

    // Redirect to auth page
    router.push("/auth");
  };

  const handleRemoveDevice = async (sessionId: string) => {
    const success = await deleteSession(sessionId);
    if (success) {
      // Reload devices
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const sessions = await getUserSessions(user.id);
        setDevices(sessions);
      }
    } else {
      alert("Failed to remove device");
    }
  };

  const isCurrentDevice = (deviceFingerprint: string): boolean => {
    const currentFingerprint = localStorage.getItem("device_fingerprint");
    return currentFingerprint === deviceFingerprint;
  };

  const formatLastActive = (lastActivity: string): string => {
    const now = new Date();
    const activityDate = new Date(lastActivity);
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Active now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "computer":
        return <Monitor className="w-5 h-5" />;
      case "mobile":
        return <Smartphone className="w-5 h-5" />;
      case "tablet":
        return <Tablet className="w-5 h-5" />;
      default:
        return <Tv className="w-5 h-5" />;
    }
  };

  const tabs = [
    { id: "profile" as TabType, label: "Profile", icon: User },
    { id: "watchlist" as TabType, label: "Watchlist", icon: Heart },
    { id: "subscription" as TabType, label: "Subscription", icon: CreditCard },
    { id: "devices" as TabType, label: "Devices", icon: Tv },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push("/")}
              className="text-red-600 font-bold text-2xl hover:text-red-500 transition-colors"
            >
              StreamCorn
            </button>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-zinc-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Account Settings</h1>
          <p className="text-zinc-400">
            Manage your profile, watchlist, subscription, and devices
          </p>
        </div>

        {/* Two-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Tabs */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-2 sticky top-20">
              <div className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-left ${
                        isActive
                          ? "bg-red-600 text-white"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 p-6 md:p-8">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Profile Information</h2>
                {currentProfile && (
                  <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-zinc-800">
                      <Image
                        src={currentProfile.avatar || "/profile-images/avatar1.png"}
                        alt={currentProfile.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">
                        {currentProfile.name}
                      </h3>
                      <p className="text-zinc-400 text-sm">
                        {currentProfile.is_kids ? "Kids Profile" : "Adult Profile"}
                      </p>
                      <Button
                        onClick={() => router.push("/profiles")}
                        variant="ghost"
                        className="mt-3 text-red-500 hover:text-red-400 px-0"
                      >
                        Switch or Manage Profiles
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Account Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => router.push("/profiles")}
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <span>Manage Profiles</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="w-full justify-between text-red-500 border-red-900 hover:bg-red-950"
                  >
                    <span>Sign Out</span>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Watchlist Tab */}
          {activeTab === "watchlist" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">My Watchlist</h2>
                <span className="text-sm text-zinc-400">
                  {watchlist.length} {watchlist.length === 1 ? "item" : "items"}
                </span>
              </div>

              {watchlist.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-400 mb-4">Your watchlist is empty</p>
                  <Button onClick={() => router.push("/")} className="bg-red-600 hover:bg-red-700">
                    Discover Content
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {watchlist.map((item) => {
                    const content = watchlistContent.get(item.content_id);
                    if (!content) return null;

                    return (
                      <div
                        key={item.id}
                        className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800"
                      >
                        <Image
                          src={getTMDBImageUrl(content.poster_path, "w500")}
                          alt={content.title || content.name || ""}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                              {content.title || content.name}
                            </h3>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-white text-black hover:bg-zinc-200"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Play
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromWatchlist(item.id, item.content_id);
                                }}
                                className="border-zinc-700 hover:border-red-500 hover:bg-red-950"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Subscription Plan</h2>
                {plan && (
                  <div className="bg-gradient-to-r from-red-950/30 to-zinc-900 rounded-xl border border-red-900/30 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-red-600/20">
                          <Crown className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">
                            {SUBSCRIPTION_PLANS[plan].name} Plan
                          </h3>
                          <p className="text-zinc-400 text-sm">
                            {SUBSCRIPTION_PLANS[plan].description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          {SUBSCRIPTION_PLANS[plan].price}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-black/30 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm mb-1">Video Quality</p>
                        <p className="text-white font-semibold">
                          {SUBSCRIPTION_PLANS[plan].qualities.join(", ")}
                        </p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm mb-1">Devices</p>
                        <p className="text-white font-semibold">
                          {SUBSCRIPTION_PLANS[plan].deviceLimit} at a time
                        </p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-4">
                        <p className="text-zinc-400 text-sm mb-1">Status</p>
                        <p className="text-green-500 font-semibold">Active</p>
                      </div>
                    </div>

                    <Button
                      onClick={() => router.push("/subscribe")}
                      className="w-full bg-white text-black hover:bg-zinc-200"
                    >
                      Change Plan
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Billing Information</h3>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-zinc-400 text-sm">
                    Payment integration coming soon. Your subscription is currently active.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Devices Tab */}
          {activeTab === "devices" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Manage Devices</h2>
                  <p className="text-sm text-zinc-400">
                    {devices.length} of {plan ? SUBSCRIPTION_PLANS[plan].deviceLimit : 1} devices
                    in use
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {devices.map((device) => {
                  const isCurrent = isCurrentDevice(device.device_fingerprint);
                  return (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-zinc-700">
                          {getDeviceIcon(device.device_type)}
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{device.device_name}</h4>
                          <p className="text-sm text-zinc-400">
                            {formatLastActive(device.last_activity)}
                          </p>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs px-3 py-1 rounded-full bg-green-600/20 text-green-500 border border-green-600/30">
                          This device
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveDevice(device.id)}
                          className="border-red-900 text-red-500 hover:bg-red-950"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-zinc-800/30 rounded-lg border border-zinc-800">
                <p className="text-sm text-zinc-400">
                  You can use StreamCorn on up to{" "}
                  <span className="text-white font-semibold">
                    {plan ? SUBSCRIPTION_PLANS[plan].deviceLimit : 1}
                  </span>{" "}
                  {plan && SUBSCRIPTION_PLANS[plan].deviceLimit === 1 ? "device" : "devices"} at
                  the same time. Upgrade your plan to watch on more devices simultaneously.
                </p>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
