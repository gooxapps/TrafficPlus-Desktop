import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { settings } = useSiteSettings();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-muted-foreground">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (settings?.authRequired === false) {
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Prevent non-admins from accessing admin pages
  if (user.role !== "admin" && (location.pathname.startsWith("/admin"))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
