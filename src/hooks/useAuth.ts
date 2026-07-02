import { useEffect, useState, useCallback, useRef } from "react";
import type { User, UserRole } from "@/types";
import { getCurrentUser, signOut } from "@/lib/auth";
import { loadAll, setUserId } from "@/lib/storage";

const electronAPI = (window as any).electronAPI;

let currentUser: User | null = null;
let currentLoading = true;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function syncUserWithDB(userId: string) {
  if (!electronAPI) return;
  try {
    const dbUser = await electronAPI.userGet(userId);
    if (dbUser) {
      // Merge DB user with current user
      currentUser = {
        ...(currentUser || dbUser),
        ...dbUser,
      };
      localStorage.setItem("trafficplus_user", JSON.stringify(currentUser));
      notify();
    }
  } catch (err) {
    console.error("Error syncing user with DB:", err);
  }
}

async function initialize() {
  // Initialize user
  currentUser = getCurrentUser();
  if (currentUser) {
    setUserId(currentUser.id);
    loadAll(currentUser.id).catch(console.error);
    // Sync with DB
    syncUserWithDB(currentUser.id);
  } else {
    setUserId(null);
  }
  currentLoading = false;
  notify();

  const handleAuthChange = () => {
    currentUser = getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.id);
      loadAll(currentUser.id).catch(console.error);
      // Sync with DB
      syncUserWithDB(currentUser.id);
    } else {
      setUserId(null);
    }
    notify();
  };

  window.addEventListener("auth_changed", handleAuthChange);
  return () => window.removeEventListener("auth_changed", handleAuthChange);
}

export function useAuth() {
  const [, setTick] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    let cleanup: (() => void) | undefined;
    (async () => {
      cleanup = await initialize();
    })();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const updateCredits = useCallback(async (delta: number) => {
    if (!currentUser) return;
    const next = Math.max(0, currentUser.credits + delta);
    currentUser = { ...currentUser, credits: next };
    
    // Update in localStorage and DB
    localStorage.setItem("trafficplus_user", JSON.stringify(currentUser));
    if (electronAPI) {
      try {
        await electronAPI.userUpdate(currentUser.id, { credits: next });
      } catch (err) {
        console.error("Error updating credits in DB:", err);
      }
    }
    notify();
  }, []);

  const upgrade = useCallback(async (role: UserRole) => {
    if (!currentUser) return;
    currentUser = { ...currentUser, role };
    localStorage.setItem("trafficplus_user", JSON.stringify(currentUser));
    if (electronAPI) {
      try {
        await electronAPI.userUpdate(currentUser.id, { role });
      } catch (err) {
        console.error("Error upgrading role in DB:", err);
      }
    }
    notify();
  }, []);

  const updateProfile = useCallback(async (patch: { name?: string; bio?: string; avatar?: string; storeRawIps?: boolean }) => {
    if (!currentUser) return;
    currentUser = { ...currentUser, ...patch };
    localStorage.setItem("trafficplus_user", JSON.stringify(currentUser));
    if (electronAPI) {
      try {
        await electronAPI.userUpdate(currentUser.id, patch);
      } catch (err) {
        console.error("Error updating profile in DB:", err);
      }
    }
    notify();
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  return {
    user: currentUser,
    loading: currentLoading,
    updateCredits,
    upgrade,
    updateProfile,
    logout,
  };
}
