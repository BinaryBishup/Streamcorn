"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Menu, ChevronDown, Bell, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS, OTT_PLATFORMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const selectedPlatform = searchParams.get("platform");

  useEffect(() => {
    loadProfiles();

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadProfiles = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (data) {
        setProfiles(data);
        const selectedProfileId = localStorage.getItem("selectedProfile");
        const selected = data.find((p) => p.id === selectedProfileId);
        setCurrentProfile(selected || data[0]);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
    }
  };

  const handleProfileSwitch = (profileId: string) => {
    localStorage.setItem("selectedProfile", profileId);
    window.location.reload();
  };

  const handlePlatformFilter = (platformId: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (selectedPlatform === platformId) {
      params.delete("platform");
    } else {
      params.set("platform", platformId);
    }

    const newUrl = `${pathname}?${params.toString()}`;
    router.push(newUrl);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("selectedProfile");
    router.push("/auth");
  };

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? "bg-black" : "bg-gradient-to-b from-black to-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        {/* Left Side - Logo & Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="w-8 h-8 text-red-600" />
            <span className="text-2xl font-bold text-red-600 hidden sm:block">
              StreamCorn
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-white ${
                  pathname === item.href
                    ? "text-white"
                    : "text-gray-300"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-900 border-gray-800">
              {NAV_ITEMS.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="text-white">
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Side - Search, Notifications, Profile */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <Link href="/search">
            <Button
              variant="ghost"
              size="icon"
            >
              <Search className="w-5 h-5" />
            </Button>
          </Link>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Bell className="w-5 h-5" />
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2"
              >
                {currentProfile?.avatar ? (
                  <div className="relative w-8 h-8 rounded overflow-hidden">
                    <Image
                      src={currentProfile.avatar}
                      alt={currentProfile.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {currentProfile?.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <ChevronDown className="w-4 h-4 hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-gray-900 border-gray-800"
            >
              <div className="px-2 py-1.5 text-sm text-gray-400">
                Switch Profile
              </div>
              {profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => handleProfileSwitch(profile.id)}
                  className="text-white cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {profile.avatar ? (
                      <div className="relative w-6 h-6 rounded overflow-hidden">
                        <Image
                          src={profile.avatar}
                          alt={profile.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-700 flex items-center justify-center text-xs">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{profile.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem asChild className="text-white cursor-pointer">
                <Link href="/profiles">Manage Profiles</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-white cursor-pointer"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* OTT Platform Filters */}
      <div className="border-t border-white/10 px-4 md:px-8 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-4 min-w-max">
          {OTT_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handlePlatformFilter(platform.id)}
              className={`relative h-12 px-4 rounded-lg transition-all flex items-center justify-center ${
                selectedPlatform === platform.id
                  ? "bg-white/20 ring-2 ring-white/50 scale-105"
                  : "bg-white/5 hover:bg-white/10"
              }`}
              title={platform.name}
            >
              <Image
                src={platform.logo}
                alt={platform.name}
                width={80}
                height={32}
                className="object-contain max-h-8"
              />
            </button>
          ))}
          {selectedPlatform && (
            <button
              onClick={() => handlePlatformFilter(selectedPlatform)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
