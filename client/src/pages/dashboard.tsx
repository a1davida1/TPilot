import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { SidebarDashboard } from "@/components/sidebar-dashboard";

export default function Dashboard() {
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

  // Check for guest mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsGuestMode(urlParams.get('guest') === 'true' || !isAuthenticated);
  }, [location, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <SidebarDashboard isGuestMode={isGuestMode} />
    </div>
  );
}