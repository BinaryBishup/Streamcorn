"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Loader2, Monitor, Smartphone, Tablet, Tv } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PROFILE_AVATARS } from "@/lib/constants";
import { checkDeviceLimit, createSession, deleteSession, type UserSession } from "@/lib/device-session";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  is_kids: boolean;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editIsKids, setEditIsKids] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deviceSessionsDialogOpen, setDeviceSessionsDialogOpen] = useState(false);
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setProfiles(data || []);
    } catch (error) {
      console.error("Error loading profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfile = async (profileId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      // Get user's subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const deviceLimit = subscription?.device_limit || 1;

      // Check device limit
      const { allowed, sessions } = await checkDeviceLimit(user.id, deviceLimit);

      if (!allowed && sessions) {
        // Show dialog with active sessions
        setActiveSessions(sessions);
        setPendingProfileId(profileId);
        setDeviceSessionsDialogOpen(true);
        return;
      }

      // Create/update session for this device
      const result = await createSession(user.id);

      if (!result.success) {
        console.error("Failed to create session:", result.error);
        // Still allow login even if session creation fails
      }

      localStorage.setItem("selectedProfile", profileId);
      localStorage.setItem("selected_profile_id", profileId);
      router.push("/");
    } catch (error) {
      console.error("Error selecting profile:", error);
      // Fallback to simple profile selection
      localStorage.setItem("selectedProfile", profileId);
      localStorage.setItem("selected_profile_id", profileId);
      router.push("/");
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      const success = await deleteSession(sessionId);

      if (success && pendingProfileId) {
        // Session logged out successfully, now login with pending profile
        setDeviceSessionsDialogOpen(false);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const result = await createSession(user.id);
          if (!result.success) {
            console.error("Failed to create session:", result.error);
          }
        }

        localStorage.setItem("selectedProfile", pendingProfileId);
        localStorage.setItem("selected_profile_id", pendingProfileId);
        router.push("/");
      }
    } catch (error) {
      console.error("Error logging out session:", error);
      alert("Failed to log out device. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleEditProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setEditName(profile.name);
    setEditAvatar(profile.avatar || PROFILE_AVATARS[0]);
    setEditIsKids(profile.is_kids);
    setEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedProfile || isSaving) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editName,
          avatar: editAvatar,
          is_kids: editIsKids,
        })
        .eq("id", selectedProfile.id);

      if (error) throw error;

      await loadProfiles();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProfile = async () => {
    if (isCreating) return;

    try {
      setIsCreating(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("profiles").insert({
        user_id: user.id,
        name: editName,
        avatar: editAvatar,
        is_kids: editIsKids,
      });

      if (error) throw error;

      await loadProfiles();
      setAddDialogOpen(false);
      setEditName("");
      setEditAvatar(PROFILE_AVATARS[0]);
      setEditIsKids(false);
    } catch (error) {
      console.error("Error creating profile:", error);
      alert("Failed to create profile");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;
    if (!confirm("Are you sure you want to delete this profile?")) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", selectedProfile.id);

      if (error) throw error;

      await loadProfiles();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error deleting profile:", error);
      alert("Failed to delete profile");
    }
  };

  const openAddDialog = () => {
    setEditName("");
    setEditAvatar(PROFILE_AVATARS[0]);
    setEditIsKids(false);
    setAddDialogOpen(true);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-8 h-8" />;
      case "tablet":
        return <Tablet className="w-8 h-8" />;
      case "tv":
        return <Tv className="w-8 h-8" />;
      default:
        return <Monitor className="w-8 h-8" />;
    }
  };

  const formatLastActivity = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return "Active now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center justify-center mb-12">
        <Sparkles className="w-10 h-10 text-red-600 mr-2" />
        <h1 className="text-3xl font-bold text-red-600">StreamCorn</h1>
      </div>

      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-center mb-12">
          <h2 className="text-5xl font-medium text-white">Who's watching?</h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="ml-6 px-6 py-2 border border-gray-600 text-gray-300 hover:text-white hover:border-white transition-colors rounded text-lg"
          >
            <Pencil className="w-5 h-5 inline mr-2" />
            {isEditing ? "Done" : "Edit"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="group relative flex flex-col items-center"
            >
              <button
                onClick={() =>
                  isEditing
                    ? handleEditProfile(profile)
                    : handleSelectProfile(profile.id)
                }
                className="relative"
              >
                {profile.avatar ? (
                  <div className="relative w-40 h-40 rounded-lg overflow-hidden border-4 border-transparent group-hover:border-white transition-all">
                    <Image
                      src={profile.avatar}
                      alt={profile.name}
                      fill
                      className="object-cover"
                    />
                    {profile.is_kids && (
                      <div className="absolute top-2 right-2 bg-pink-600 text-white text-xs font-bold px-2 py-1 rounded">
                        KIDS
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-lg bg-gray-700 flex items-center justify-center text-white text-5xl font-bold border-4 border-transparent group-hover:border-white transition-all">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center">
                    <Pencil className="w-12 h-12 text-white" />
                  </div>
                )}
              </button>
              <p className="mt-4 text-gray-300 group-hover:text-white text-xl">
                {profile.name}
              </p>
            </div>
          ))}

          {/* Add Profile Button */}
          {profiles.length < 4 && (
            <div className="group flex flex-col items-center">
              <button
                onClick={openAddDialog}
                className="w-40 h-40 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center border-4 border-transparent group-hover:border-white transition-all"
              >
                <Plus className="w-16 h-16 text-gray-400 group-hover:text-white" />
              </button>
              <p className="mt-4 text-gray-300 group-hover:text-white text-xl">
                Add
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Customize your profile name, avatar, and settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-white">
                Profile Name
              </Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-2 bg-gray-800 border-gray-700 text-white"
                placeholder="Enter profile name"
              />
            </div>

            <div>
              <Label className="text-white mb-4 block">Select Avatar</Label>
              <div className="grid grid-cols-5 gap-4">
                {PROFILE_AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => setEditAvatar(avatar)}
                    className={`relative w-full aspect-square rounded-lg overflow-hidden border-4 transition-all ${
                      editAvatar === avatar
                        ? "border-red-600 scale-105"
                        : "border-transparent hover:border-gray-600"
                    }`}
                  >
                    <Image src={avatar} alt="Avatar" fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="kids"
                checked={editIsKids}
                onCheckedChange={(checked) => setEditIsKids(checked as boolean)}
              />
              <Label htmlFor="kids" className="text-white cursor-pointer">
                Kids Profile
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteProfile}
              className="mr-auto"
            >
              Delete Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              className="bg-red-600 hover:bg-red-700"
              disabled={!editName.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Profile Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Add Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new profile for your account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label htmlFor="add-name" className="text-white">
                Profile Name
              </Label>
              <Input
                id="add-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-2 bg-gray-800 border-gray-700 text-white"
                placeholder="Enter profile name"
              />
            </div>

            <div>
              <Label className="text-white mb-4 block">Select Avatar</Label>
              <div className="grid grid-cols-5 gap-4">
                {PROFILE_AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    onClick={() => setEditAvatar(avatar)}
                    className={`relative w-full aspect-square rounded-lg overflow-hidden border-4 transition-all ${
                      editAvatar === avatar
                        ? "border-red-600 scale-105"
                        : "border-transparent hover:border-gray-600"
                    }`}
                  >
                    <Image src={avatar} alt="Avatar" fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="add-kids"
                checked={editIsKids}
                onCheckedChange={(checked) => setEditIsKids(checked as boolean)}
              />
              <Label htmlFor="add-kids" className="text-white cursor-pointer">
                Kids Profile
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProfile}
              className="bg-red-600 hover:bg-red-700"
              disabled={!editName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Profile"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Sessions Dialog */}
      <Dialog open={deviceSessionsDialogOpen} onOpenChange={setDeviceSessionsDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Device Limit Reached</DialogTitle>
            <DialogDescription className="text-gray-400">
              You've reached the maximum number of devices for your plan. Please log out from one of the devices below to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="text-gray-300">
                  {getDeviceIcon(session.device_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{session.device_name}</h4>
                  <p className="text-sm text-gray-400">{formatLastActivity(session.last_activity)}</p>
                  {session.ip_address && (
                    <p className="text-xs text-gray-500 mt-1">IP: {session.ip_address}</p>
                  )}
                </div>
                <Button
                  onClick={() => handleLogoutSession(session.id)}
                  variant="destructive"
                  size="sm"
                  disabled={isLoggingOut}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Logging out...
                    </>
                  ) : (
                    "Log Out"
                  )}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeviceSessionsDialogOpen(false);
                setPendingProfileId(null);
              }}
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
