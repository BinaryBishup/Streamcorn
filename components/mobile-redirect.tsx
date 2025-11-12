"use client";

import { useEffect } from "react";

export function MobileRedirect() {
  useEffect(() => {
    // Check if user is on mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 768;

    if (isMobile || isSmallScreen) {
      // Redirect to mobile app
      window.location.href = "https://app.streamcorn.com";
    }
  }, []);

  return null;
}
