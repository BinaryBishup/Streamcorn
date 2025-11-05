import { createClient } from "@/lib/supabase/client";

export interface UserSession {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string;
  device_type: "computer" | "mobile" | "tablet" | "tv";
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  created_at: string;
}

/**
 * Generate a unique device fingerprint based on browser characteristics
 */
export function generateDeviceFingerprint(): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Combine various browser/device characteristics
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ];

  // Add canvas fingerprint
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("StreamCorn", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("StreamCorn", 4, 17);
    components.push(canvas.toDataURL());
  }

  // Simple hash function
  const str = components.join("|||");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
}

/**
 * Get device name (browser + OS)
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // Detect browser
  if (ua.indexOf("Firefox") > -1) browser = "Firefox";
  else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
  else if (ua.indexOf("Safari") > -1) browser = "Safari";
  else if (ua.indexOf("Edge") > -1) browser = "Edge";

  // Detect OS
  if (ua.indexOf("Mac") > -1) os = "macOS";
  else if (ua.indexOf("Windows") > -1) os = "Windows";
  else if (ua.indexOf("Linux") > -1) os = "Linux";
  else if (ua.indexOf("Android") > -1) os = "Android";
  else if (ua.indexOf("iOS") > -1 || ua.indexOf("iPhone") > -1) os = "iOS";

  return `${browser} on ${os}`;
}

/**
 * Get device type
 */
export function getDeviceType(): "computer" | "mobile" | "tablet" | "tv" {
  const ua = navigator.userAgent;

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return "mobile";
  }
  if (/TV|SmartTV|GoogleTV|AppleTV|WebOS/.test(ua)) {
    return "tv";
  }
  return "computer";
}

/**
 * Get user's IP address (using a public API)
 */
export async function getUserIP(): Promise<string | null> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Failed to get IP:", error);
    return null;
  }
}

/**
 * Create a new session for the current device
 */
export async function createSession(userId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const fingerprint = generateDeviceFingerprint();

  try {
    // Get IP address
    const ipAddress = await getUserIP();

    // Use upsert to handle existing sessions automatically
    // onConflict: device_fingerprint - updates if exists, inserts if not
    const { data, error } = await supabase
      .from("user_sessions")
      .upsert(
        {
          user_id: userId,
          device_fingerprint: fingerprint,
          device_name: getDeviceName(),
          device_type: getDeviceType(),
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          last_activity: new Date().toISOString(),
        },
        { onConflict: "device_fingerprint" }
      )
      .select()
      .single();

    if (error) throw error;

    // Store fingerprint and session ID in localStorage
    localStorage.setItem("device_fingerprint", fingerprint);
    localStorage.setItem("session_id", data.id);

    return { success: true };
  } catch (error: any) {
    console.error("Error creating session:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user has reached device limit and handle accordingly
 */
export async function checkDeviceLimit(
  userId: string,
  deviceLimit: number
): Promise<{ allowed: boolean; kickedDevice?: string }> {
  const supabase = createClient();

  try {
    // Get all active sessions for this user
    const { data: sessions, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("last_activity", { ascending: true });

    if (error) throw error;

    const fingerprint = generateDeviceFingerprint();

    // Check if current device already has a session
    const currentDeviceSession = sessions?.find(
      (s) => s.device_fingerprint === fingerprint
    );

    if (currentDeviceSession) {
      // Current device already logged in, allow
      return { allowed: true };
    }

    // Check if limit is reached
    if (sessions && sessions.length >= deviceLimit) {
      // Kick the oldest device (first in the sorted list)
      const oldestSession = sessions[0];
      await supabase
        .from("user_sessions")
        .delete()
        .eq("id", oldestSession.id);

      return { allowed: true, kickedDevice: oldestSession.device_name };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking device limit:", error);
    return { allowed: true }; // Allow on error to not block users
  }
}

/**
 * Update session activity (heartbeat)
 */
export async function updateSessionActivity(): Promise<void> {
  const supabase = createClient();
  const fingerprint = localStorage.getItem("device_fingerprint");
  const sessionId = localStorage.getItem("session_id");

  if (!fingerprint || !sessionId) return;

  try {
    await supabase
      .from("user_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("id", sessionId);
  } catch (error) {
    console.error("Error updating session:", error);
  }
}

/**
 * Delete current session (on logout)
 */
export async function deleteCurrentSession(): Promise<void> {
  const supabase = createClient();
  const sessionId = localStorage.getItem("session_id");

  if (!sessionId) return;

  try {
    await supabase.from("user_sessions").delete().eq("id", sessionId);
    localStorage.removeItem("device_fingerprint");
    localStorage.removeItem("session_id");
  } catch (error) {
    console.error("Error deleting session:", error);
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("last_activity", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting sessions:", error);
    return [];
  }
}

/**
 * Delete a specific session by ID
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from("user_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting session:", error);
    return false;
  }
}
