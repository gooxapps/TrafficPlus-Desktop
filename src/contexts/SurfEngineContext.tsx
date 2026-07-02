import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { Campaign, Proxy as ProxyType } from "@/types";
import {
  addActivity, onDataChange, updateCampaign, getCampaigns, getProxies,
} from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";

const DEFAULT_DURATION = 15; // seconds
const MIN_DURATION = 10;
const MAX_DURATION = 25;
const REWARD_PER_VISIT = 1;
const MAX_SLOTS = 40;

// Device presets (matches electron/main.js)
const DEFAULT_DEVICES = [
  'Desktop Chrome',
  'Desktop Firefox', 
  'Desktop Safari',
  'iPhone 14 Pro Max',
  'iPhone 14 Pro',
  'Samsung Galaxy S24',
  'iPad Pro',
];

// Generate random viewing time for more realistic behavior using base duration
const getRandomDuration = (baseDuration: number = DEFAULT_DURATION): number => {
  const variance = Math.floor(Math.random() * 5); // ±2s
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, baseDuration + variance - 2));
};

// Pick random device
const getRandomDevice = (): string => {
  return DEFAULT_DEVICES[Math.floor(Math.random() * DEFAULT_DEVICES.length)];
};



export interface SurfSlot {
  id: number;
  campaign: Campaign | null;
  remaining: number;
  isPaused: boolean;
  popupOpen: boolean;
  popupBlocked: boolean;
  deviceType: string;
  userAgent?: string;
  headless?: boolean;
  proxy?: ProxyType | null;
}

interface SurfEngineCtx {
  slotCount: number;
  setSlotCount: (n: number) => void;
  duration: number;
  setDuration: (n: number) => void;
  isRunning: boolean;
  isVerified: boolean;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  showPopups: boolean;
  toggleShowPopups: () => void;
  pool: Campaign[];
  slots: SurfSlot[];
  sessionCredits: number;
  sessionVisits: number;
  hidden: boolean;
  maxSlots: number;
  availableDevices: string[];
  setSlotDevice: (slotId: number, deviceType: string) => void;
  setSlotUserAgent: (slotId: number, userAgent: string) => void;
  setSlotHeadless: (slotId: number, headless: boolean) => void;
  setSlotProxy: (slotId: number, proxyId: string | null) => void;
  networkThrottle: string;
  setNetworkThrottle: (v: string) => void;
  proxyMode: 'none' | 'single' | 'rotate' | 'per-slot';
  setProxyMode: (v: 'none' | 'single' | 'rotate' | 'per-slot') => void;
  selectedProxyId: string | null;
  setSelectedProxyId: (v: string | null) => void;
  proxies: ProxyType[];
  start: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  stop: () => void;
  pauseSlot: (slotId: number) => void;
  resumeSlot: (slotId: number) => void;
  nextSlot: (slotId: number) => void;
  reopenSlot: (slotId: number) => void;
}

const SurfCtx = createContext<SurfEngineCtx | null>(null);

export function SurfEngineProvider({ children }: { children: React.ReactNode }) {
  const { user, updateCredits } = useAuth();
  const [pool, setPool] = useState<Campaign[]>([]);
  const [slotCount, setSlotCountState] = useState(1);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [sessionCredits, setSessionCredits] = useState(0);
  const [sessionVisits, setSessionVisits] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [slots, setSlots] = useState<SurfSlot[]>([]);
  const [showPopups, setShowPopups] = useState(true);
  const [availableDevices, setAvailableDevices] = useState<string[]>(DEFAULT_DEVICES);
  const [networkThrottle, setNetworkThrottle] = useState<string>('none');
  const [proxyMode, setProxyMode] = useState<'none' | 'single' | 'rotate' | 'per-slot'>('none');
  const [selectedProxyId, setSelectedProxyId] = useState<string | null>(null);
  const [proxies, setProxies] = useState<ProxyType[]>([]);
  const [campaignQueue, setCampaignQueue] = useState<Campaign[]>([]); // Queue of campaigns to execute sequentially
  
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map()); // track active timers per slot
  const nextIdxRef = useRef(0);
  const proxyIdxRef = useRef(0);
  const isRunningRef = useRef(isRunning);
  const campaignQueueRef = useRef<Campaign[]>([]);

  // Pick proxy for slot
  const getProxyForSlot = (
    proxyMode: 'none' | 'single' | 'rotate' | 'per-slot',
    proxies: ProxyType[],
    selectedProxyId: string | null,
    slotId: number,
    slotProxyId?: string | null
  ): ProxyType | null => {
    if (proxyMode === 'none' || proxies.length === 0) return null;
    if (proxyMode === 'single') {
      return proxies.find(p => p.id === selectedProxyId) || null;
    }
    if (proxyMode === 'per-slot') {
      return proxies.find(p => p.id === slotProxyId) || null;
    }
    // Rotate mode: assign each slot a proxy in round-robin
    const idx = (proxyIdxRef.current + slotId) % proxies.length;
    return proxies[idx];
  };

  // Load available devices on mount
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.browserGetDevices) {
      electronAPI.browserGetDevices().then((devices: string[]) => {
        setAvailableDevices(devices);
      }).catch((e: any) => {
        console.error('Failed to get devices:', e);
        setAvailableDevices(DEFAULT_DEVICES);
      });
    }
  }, []);

  // Load proxies
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const p = await getProxies(user.id);
      setProxies(p);
    };
    load();
    return onDataChange(load);
  }, [user?.id]);

  const syncPool = useCallback(async () => {
    try {
      const campaigns = await getCampaigns();
      console.log('All campaigns:', campaigns);
      console.log('Current user id:', user?.id);
      const fresh = campaigns.filter(
        (c) => c.status === "active" && c.creditsUsed < c.creditsAllocated && c.ownerId === user?.id
      );
      console.log('Filtered pool:', fresh);
      setPool(fresh);
    } catch (e) {
      console.error('Failed to sync pool:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    syncPool();
    return onDataChange(syncPool);
  }, [syncPool]);

  // Visibility tracker
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Clean up timers
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  // Helpers
  const setSlot = useCallback((id: number, patch: Partial<SurfSlot>) => {
    setSlots((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const setSlotDevice = useCallback((slotId: number, deviceType: string) => {
    setSlot(slotId, { deviceType });
  }, [setSlot]);

  const setSlotUserAgent = useCallback((slotId: number, userAgent: string) => {
    setSlot(slotId, { userAgent: userAgent.trim() || undefined });
  }, [setSlot]);

  const setSlotHeadless = useCallback((slotId: number, headless: boolean) => {
    setSlot(slotId, { headless });
  }, [setSlot]);

  const setSlotProxy = useCallback((slotId: number, proxyId: string | null) => {
    const p = proxies.find(pr => pr.id === proxyId) || null;
    setSlot(slotId, { proxy: p });
  }, [proxies, setSlot]);

  const pickNextCampaign = useCallback(async (excludeIds: Set<string>): Promise<Campaign | null> => {
    try {
      const campaigns = await getCampaigns();
      const fresh = campaigns.filter(
        (c) => c.status === "active" && c.creditsUsed < c.creditsAllocated && c.ownerId === user?.id
      );
      if (fresh.length === 0) return null;
      for (let i = 0; i < fresh.length; i++) {
        const idx = (nextIdxRef.current + i) % fresh.length;
        if (!excludeIds.has(fresh[idx].id)) {
          nextIdxRef.current = (idx + 1) % fresh.length;
          return fresh[idx];
        }
      }
      const c = fresh[nextIdxRef.current % fresh.length];
      nextIdxRef.current = (nextIdxRef.current + 1) % fresh.length;
      return c;
    } catch (e) {
      console.error('Failed to pick campaign:', e);
      return null;
    }
  }, [user?.id]);

  // Check if queue has pending campaigns and auto-start next batch
  const checkAndProcessQueue = useCallback(async (currentSlots: SurfSlot[]) => {
    if (!isRunningRef.current || campaignQueueRef.current.length === 0) return;
    
    // Check if all slots are idle (no campaign)
    const allIdle = currentSlots.every(s => !s.campaign);
    if (allIdle) {
      console.log('[Queue] All slots idle, starting next batch from queue');
      // Remove first 10 campaigns from queue for next batch
      const nextBatch = campaignQueueRef.current.splice(0, Math.min(10, campaignQueueRef.current.length));
      setCampaignQueue([...campaignQueueRef.current]);
      
      // Assign to slots
      const newSlots = currentSlots.map((slot, idx) => {
        if (idx < nextBatch.length) {
          const randomDuration = getRandomDuration(duration);
          return { ...slot, campaign: nextBatch[idx], remaining: randomDuration, isPaused: false };
        }
        return slot;
      });
      
      setSlots(newSlots);
    }
  }, [duration, setCampaignQueue]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    campaignQueueRef.current = campaignQueue;
  }, [campaignQueue]);

  const closePopupForSlot = useCallback(async (slotId: number) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.browserClose) {
      await electronAPI.browserClose(slotId);
    }
    setSlot(slotId, { popupOpen: false });
  }, [setSlot]);

  const openPopupForSlot = useCallback(async (slotId: number, url: string, deviceType?: string, mode?: 'direct' | 'search' | 'freelancing', searchEngine?: string, searchKeywords?: string, searchPlatform?: string, searchTargetName?: string, searchPage?: number, searchSort?: string, networkThrottle?: string, proxy?: ProxyType | null, userAgent?: string, headless?: boolean): Promise<boolean> => {
    try {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI || !electronAPI.browserOpen) {
        return false;
      }
      const device = deviceType || getRandomDevice();
      // Determine headless: explicit slot headless OR global showPopups false
      const finalHeadless = !!headless || !showPopups;
      // @ts-ignore: We added a 10th argument for headless mode
      const result = await electronAPI.browserOpen(url, slotId, device, mode, searchEngine, searchKeywords, searchPlatform, searchTargetName, searchPage, searchSort, networkThrottle || 'none', proxy, userAgent, finalHeadless);
      if (!result || !result.success) {
        console.error('Failed to open browser:', result?.error || 'unknown error');
        setSlot(slotId, { popupOpen: false, popupBlocked: true });
        return false;
      }
      setSlot(slotId, { popupOpen: true, popupBlocked: false });
      return true;
    } catch (error) {
      console.error('Failed to open browser:', error);
      setSlot(slotId, { popupOpen: false, popupBlocked: true });
      return false;
    }
  }, [showPopups, setSlot]);

  const handleSlotComplete = useCallback(async (slotId: number) => {
    if (!isRunningRef.current) return;
    const slot = slots.find(s => s.id === slotId);
    const c = slot?.campaign;
    if (c) {
      const role = user?.role || "user";
      const multiplier = role === "premium" ? 2 : role === "admin" ? 3 : 1;
      const reward = REWARD_PER_VISIT * multiplier;

      updateCredits(reward);
      setSessionCredits(s => s + reward);
      setSessionVisits(s => s + 1);
      await updateCampaign(c.id, {
        visitsReceived: c.visitsReceived + 1,
        creditsUsed: Math.min(c.creditsAllocated, c.creditsUsed + 1),
      });
      await addActivity({
        type: "earn",
        amount: reward,
        description: `Surfed ${c.title}`,
        campaignId: c.id,
        userId: user?.id
      });
      toast({
        title: `+${reward} credit${reward > 1 ? "s" : ""} earned`,
        description: c.title,
        variant: "success",
      });
    }

    // Close current popup
    await closePopupForSlot(slotId);
    if (!isRunningRef.current) return;

    if (autoRotate) {
      const exclude = new Set(
        slots.filter(s => s.id !== slotId && s.campaign).map(s => s.campaign!.id)
      );
      const nextCampaign = await pickNextCampaign(exclude);
      if (nextCampaign && isRunningRef.current) {
        const randomDuration = getRandomDuration(duration);
        await new Promise(r => setTimeout(r, 300 + Math.random() * 600)); // faster delay
        if (!isRunningRef.current) return;
        setSlot(slotId, { campaign: nextCampaign, remaining: randomDuration, isPaused: false });
        
        const proxy = getProxyForSlot(proxyMode, proxies, selectedProxyId, slotId, slot?.proxy?.id);
        const opened = await openPopupForSlot(
          slotId,
          nextCampaign.url,
          undefined,
          nextCampaign.mode,
          nextCampaign.searchEngine,
          nextCampaign.searchKeywords,
          nextCampaign.searchPlatform,
          nextCampaign.searchTargetName,
          nextCampaign.searchPage,
          nextCampaign.searchSort,
          networkThrottle,
          proxy,
          slot?.userAgent,
          slot?.headless
        );
        if (opened && isRunningRef.current) {
          const timerId = setTimeout(() => handleSlotComplete(slotId), randomDuration * 1000);
          timersRef.current.set(slotId, timerId);

          const electronAPI = (window as any).electronAPI;
          if (electronAPI && electronAPI.browserWait) {
            await electronAPI.browserWait(slotId, randomDuration * 1000);
          }
        } else if (opened && !isRunningRef.current) {
          await closePopupForSlot(slotId);
        }
      } else {
        setSlot(slotId, { campaign: null });
        // Check queue for next batch
        setSlots(currentSlots => {
          setTimeout(() => checkAndProcessQueue(currentSlots), 100);
          return currentSlots;
        });
      }
    } else {
      setSlot(slotId, { isPaused: true, remaining: duration });
    }
  }, [slots, user, autoRotate, closePopupForSlot, openPopupForSlot, setSlot, pickNextCampaign, updateCampaign, updateCredits, addActivity, toast, duration, proxyMode, proxies, selectedProxyId, networkThrottle, getProxyForSlot, checkAndProcessQueue]);

  // --- Public actions ---
  const setSlotCount = useCallback((n: number) => {
    if (isRunning) return;
    setSlotCountState(Math.max(1, Math.min(MAX_SLOTS, n)));
  }, [isRunning]);

  const start = useCallback(async () => {
    const campaigns = await getCampaigns();
    const fresh = campaigns.filter(
      (c) => c.status === "active" && c.creditsUsed < c.creditsAllocated && c.ownerId === user?.id
    );
    if (fresh.length === 0) {
      toast({
        title: "No campaigns to surf",
        description: "Add your own active campaign first to start promoting.",
        variant: "default",
      });
      return;
    }
    setIsVerified(true);
    nextIdxRef.current = 0;
    // Increment proxy index for rotation
    if (proxyMode === 'rotate' && proxies.length > 0) {
      proxyIdxRef.current = (proxyIdxRef.current + 1) % proxies.length;
    }

    const newSlots: SurfSlot[] = [];
    const used = new Set<string>();
    for (let i = 0; i < slotCount; i++) {
      const c = await pickNextCampaign(used);
      if (c) used.add(c.id);
      const randomDuration = getRandomDuration(duration);
      const existingSlot = slots.find(s => s.id === i);
      newSlots.push({
        id: i,
        campaign: c,
        remaining: randomDuration,
        isPaused: false,
        popupOpen: false,
        popupBlocked: false,
        deviceType: existingSlot?.deviceType || getRandomDevice(),
        headless: existingSlot?.headless || false,
        userAgent: existingSlot?.userAgent,
        proxy: existingSlot?.proxy || null,
      });
    }
    setSlots(newSlots);
    setIsRunning(true);
    isRunningRef.current = true;

    // Open popups concurrently and then start timers + browserWait concurrently
    const openPromises = newSlots.map(async (slot) => {
      if (!slot.campaign) return { slotId: slot.id, opened: false };
      if (!isRunningRef.current) return { slotId: slot.id, opened: false };
      const proxy = getProxyForSlot(proxyMode, proxies, selectedProxyId, slot.id, slot.proxy?.id);
      const opened = await openPopupForSlot(
        slot.id,
        slot.campaign.url,
        slot.deviceType,
        slot.campaign.mode,
        slot.campaign.searchEngine,
        slot.campaign.searchKeywords,
        slot.campaign.searchPlatform,
        slot.campaign.searchTargetName,
        slot.campaign.searchPage,
        slot.campaign.searchSort,
        networkThrottle,
        proxy,
        slot.userAgent,
        slot.headless
      );
      return { slotId: slot.id, opened };
    });

    const openResults = await Promise.all(openPromises);
    if (!isRunningRef.current) {
      // If stop was triggered during open, close any opened browsers immediately.
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.browserCloseAll) {
        await electronAPI.browserCloseAll();
      }
      return;
    }

    // Start timers and browserWait in parallel for opened slots
    const waitPromises: Promise<void>[] = [];
    for (const res of openResults) {
      if (res.opened) {
        const slot = newSlots.find(s => s.id === res.slotId);
        if (!slot) continue;
        const timerId = setTimeout(() => handleSlotComplete(res.slotId), slot.remaining * 1000);
        timersRef.current.set(res.slotId, timerId);

        const electronAPI = (window as any).electronAPI;
        if (electronAPI && electronAPI.browserWait) {
          waitPromises.push(electronAPI.browserWait(res.slotId, slot.remaining * 1000).catch((e: any) => { console.error('browserWait failed', e); }));
        }
      }
    }
    // Fire-and-forget but don't block UI; wait for all simulated waits to at least be scheduled
    Promise.allSettled(waitPromises).catch(() => {});
  }, [slotCount, slots, pickNextCampaign, openPopupForSlot, handleSlotComplete, user?.id, toast, proxyMode, proxies, selectedProxyId, networkThrottle, duration]);

  const pauseAll = useCallback(() => {
    // Clear all timers
    for (const [_, timer] of timersRef.current.entries()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setSlots((cur) => cur.map((s) => ({ ...s, isPaused: true })));
  }, []);

  const resumeAll = useCallback(() => {
    setSlots((cur) => cur.map((s) => ({ ...s, isPaused: false })));
    // Restart timers for all slots that have campaigns
    slots.forEach(async (slot) => {
      if (slot.campaign && !slot.isPaused) {
        const timerId = setTimeout(() => handleSlotComplete(slot.id), slot.remaining * 1000);
        timersRef.current.set(slot.id, timerId);
      }
    });
  }, [slots, handleSlotComplete]);

  const stop = useCallback(async () => {
    setIsRunning(false);
    setIsVerified(false);
    setSlots([]);

    // Clear all timers
    for (const [_, timer] of timersRef.current.entries()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();

    // Close all popups using the closeAll handler (immediate)
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.browserCloseAll) {
      await electronAPI.browserCloseAll();
    }
  }, []);

  const pauseSlot = useCallback((slotId: number) => {
    const timer = timersRef.current.get(slotId);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(slotId);
    setSlot(slotId, { isPaused: true });
  }, [setSlot]);

  const resumeSlot = useCallback(async (slotId: number) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot?.campaign) {
      const proxy = getProxyForSlot(proxyMode, proxies, selectedProxyId, slotId, slot?.proxy?.id);
      const opened = await openPopupForSlot(
        slotId,
        slot.campaign.url,
        undefined,
        slot.campaign.mode,
        slot.campaign.searchEngine,
        slot.campaign.searchKeywords,
        slot.campaign.searchPlatform,
        slot.campaign.searchTargetName,
        slot.campaign.searchPage,
        slot.campaign.searchSort,
        networkThrottle,
        proxy,
        slot.userAgent,
        slot.headless
      );
      if (opened) {
        const timerId = setTimeout(() => handleSlotComplete(slotId), slot.remaining * 1000);
        timersRef.current.set(slotId, timerId);
        setSlot(slotId, { isPaused: false });
      }
    } else {
      setSlot(slotId, { isPaused: false });
    }
  }, [slots, openPopupForSlot, handleSlotComplete, setSlot, proxyMode, proxies, selectedProxyId, networkThrottle]);

  const nextSlot = useCallback(async (slotId: number) => {
    const timer = timersRef.current.get(slotId);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(slotId);

    const slot = slots.find(s => s.id === slotId);
    const exclude = new Set(
      slots.filter(s => s.id !== slotId && s.campaign).map(s => s.campaign!.id)
    );
    const next = await pickNextCampaign(exclude);
    if (!next) return;

    await closePopupForSlot(slotId);
    const randomDuration = getRandomDuration(duration);
    setSlot(slotId, { campaign: next, remaining: randomDuration, isPaused: false });
    
    const proxy = getProxyForSlot(proxyMode, proxies, selectedProxyId, slotId, slot?.proxy?.id);
    const opened = await openPopupForSlot(
          slotId,
          next.url,
          undefined,
          next.mode,
          next.searchEngine,
          next.searchKeywords,
          next.searchPlatform,
          next.searchTargetName,
          next.searchPage,
          next.searchSort,
          networkThrottle,
          proxy,
          slot?.userAgent,
          slot?.headless
        );
    if (opened) {
      const timerId = setTimeout(() => handleSlotComplete(slotId), randomDuration * 1000);
      timersRef.current.set(slotId, timerId);
    }
  }, [slots, pickNextCampaign, closePopupForSlot, openPopupForSlot, handleSlotComplete, setSlot, proxyMode, proxies, selectedProxyId, networkThrottle, duration]);

  const reopenSlot = useCallback(async (slotId: number) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot?.campaign) return;

    await closePopupForSlot(slotId);
    const randomDuration = getRandomDuration(duration);
    const proxy = getProxyForSlot(proxyMode, proxies, selectedProxyId, slotId, slot?.proxy?.id);
    const opened = await openPopupForSlot(
      slotId,
      slot.campaign.url,
      undefined,
      slot.campaign.mode,
      slot.campaign.searchEngine,
      slot.campaign.searchKeywords,
      slot.campaign.searchPlatform,
      slot.campaign.searchTargetName,
      slot.campaign.searchPage,
      slot.campaign.searchSort,
      networkThrottle,
      proxy,
      slot.userAgent,
      slot.headless
    );
    if (opened) {
      const timer = timersRef.current.get(slotId);
      if (timer) clearTimeout(timer);
      const timerId = setTimeout(() => handleSlotComplete(slotId), randomDuration * 1000);
      timersRef.current.set(slotId, timerId);
      setSlot(slotId, { isPaused: false, remaining: randomDuration });
    }
  }, [slots, closePopupForSlot, openPopupForSlot, handleSlotComplete, setSlot, proxyMode, proxies, selectedProxyId, networkThrottle, duration]);

  // Auto-stop if pool drains during a session
  useEffect(() => {
    if (pool.length === 0 && isRunning) stop();
  }, [pool.length, isRunning, stop]);

  const toggleShowPopups = useCallback(() => {
    setShowPopups((prev) => {
      const next = !prev;
      // Inform main process to hide/show active browsers
      try {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI && electronAPI.browserSetHidden) {
          electronAPI.browserSetHidden(next === false); // hidden when showPopups becomes false
        }
      } catch (e) {
        console.error('Failed to toggle browser hidden state:', e);
      }
      return next;
    });
  }, []);

  // Campaign queue methods
  const addCampaignsToQueue = useCallback((campaigns: Campaign[]) => {
    const newQueue = [...campaignQueue, ...campaigns];
    setCampaignQueue(newQueue);
    campaignQueueRef.current = newQueue;
    toast({
      title: 'Campaigns queued',
      description: `${campaigns.length} campaign(s) added to queue`,
      variant: 'success',
    });
  }, [campaignQueue, toast]);

  const clearCampaignQueue = useCallback(() => {
    setCampaignQueue([]);
    campaignQueueRef.current = [];
    toast({
      title: 'Queue cleared',
      description: 'Campaign queue has been cleared',
      variant: 'default',
    });
  }, [toast]);

  const value = useMemo<SurfEngineCtx>(() => ({
    slotCount, setSlotCount, duration, setDuration, isRunning, isVerified, autoRotate, setAutoRotate,
    showPopups, toggleShowPopups,
    pool, slots, sessionCredits, sessionVisits, hidden, maxSlots: MAX_SLOTS,
    availableDevices, setSlotDevice, setSlotUserAgent, setSlotHeadless, setSlotProxy,
    networkThrottle, setNetworkThrottle,
    proxyMode, setProxyMode,
    selectedProxyId, setSelectedProxyId,
    proxies,
    start, pauseAll, resumeAll, stop, pauseSlot, resumeSlot, nextSlot, reopenSlot,
  }), [
    slotCount, setSlotCount, duration, setDuration, isRunning, isVerified, autoRotate,
    showPopups, toggleShowPopups,
    pool, slots, sessionCredits, sessionVisits, hidden,
    availableDevices, setSlotDevice, setSlotUserAgent, setSlotHeadless, setSlotProxy,
    networkThrottle, setNetworkThrottle,
    proxyMode, setProxyMode,
    selectedProxyId, setSelectedProxyId,
    proxies,
    start, pauseAll, resumeAll, stop, pauseSlot, resumeSlot, nextSlot, reopenSlot,
  ]);

  return <SurfCtx.Provider value={value}>{children}</SurfCtx.Provider>;
}

export function useSurfEngine() {
  const ctx = useContext(SurfCtx);
  if (!ctx) throw new Error("useSurfEngine must be used within SurfEngineProvider");
  return ctx;
}
