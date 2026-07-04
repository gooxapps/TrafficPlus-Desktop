import { HashRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Surf from "@/pages/Surf";
import Campaigns from "@/pages/Campaigns";
import Credits from "@/pages/Credits";
import Referrals from "@/pages/Referrals";
import Analytics from "@/pages/Analytics";
import Premium from "@/pages/Premium";
import Admin from "@/pages/Admin";
import AdminUsers from "@/pages/AdminUsers";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import Contacts from "@/pages/Contacts";
import SavedCampaigns from "@/pages/SavedCampaigns";
import Proxies from "@/pages/Proxies";
import NotFound from "@/pages/NotFound";
import { Toaster } from "@/components/ui/Toaster";
import UpdateBanner from "@/components/ui/UpdateBanner";
import { SurfEngineProvider } from "@/contexts/SurfEngineContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect } from "react";
import { toast } from "@/hooks/useToast";

export default function App() {
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.onSurfChallenge) {
      electronAPI.onSurfChallenge((data: any) => {
        try {
          const slot = data?.slotId != null ? `Slot ${data.slotId}` : 'Surf';
          toast({ title: 'Challenge detected', description: `${slot}: ${data.url || ''}`, variant: 'default' });
          // Optionally, bring window to front by focusing
          try { window.focus(); } catch (e) { /* ignore */ }
        } catch (e) {
          console.error('surf challenge handler error', e);
        }
      });
    }
  }, []);
  return (
    <ErrorBoundary>
      <HashRouter>
        <SurfEngineProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/surf" element={<ProtectedRoute><Surf /></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
            <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/proxies" element={<ProtectedRoute><Proxies /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
            <Route path="/saved-campaigns" element={<ProtectedRoute><SavedCampaigns /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <UpdateBanner />
          <Toaster />
        </SurfEngineProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
