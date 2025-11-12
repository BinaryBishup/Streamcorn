"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkDeviceLimit } from "@/lib/device-session";

/**
 * Component that guards all protected routes and ensures
 * the user has a valid device session before accessing the app
 */
export function DeviceSessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkSessionValidity();
  }, [pathname]);

  const checkSessionValidity = async () => {
    // Public routes that don't require session check
    const publicRoutes = ["/auth", "/profiles"];
    const isPublicRoute = publicRoutes.some((route) => pathname === route);

    if (isPublicRoute) {
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }

    const supabase = createClient();

    try {
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in, redirect to auth
        router.push("/auth");
        return;
      }

      // Check if user has a valid device session
      const sessionId = localStorage.getItem("session_id");
      const deviceFingerprint = localStorage.getItem("device_fingerprint");

      if (!sessionId || !deviceFingerprint) {
        // No valid session, redirect to profiles to select one
        router.push("/profiles");
        return;
      }

      // Verify the session exists in the database
      const { data: session, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single();

      if (error || !session) {
        // Session doesn't exist or is invalid, redirect to profiles
        localStorage.removeItem("session_id");
        localStorage.removeItem("device_fingerprint");
        router.push("/profiles");
        return;
      }

      // Check if device limit is still valid
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("device_limit")
        .eq("user_id", user.id)
        .single();

      const deviceLimit = subscription?.device_limit || 1;
      const { allowed } = await checkDeviceLimit(user.id, deviceLimit);

      if (!allowed) {
        // Device limit exceeded, redirect to profiles
        localStorage.removeItem("session_id");
        localStorage.removeItem("device_fingerprint");
        router.push("/profiles");
        return;
      }

      // All checks passed, user is authorized
      setIsAuthorized(true);
    } catch (error) {
      console.error("Error checking session validity:", error);
      // On error, redirect to profiles to be safe
      router.push("/profiles");
    } finally {
      setIsChecking(false);
    }
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Only render children if authorized
  return isAuthorized ? <>{children}</> : null;
}
