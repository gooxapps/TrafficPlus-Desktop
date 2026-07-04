import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useSurfEngine } from "@/contexts/SurfEngineContext";
import { SurfSlotCard } from "@/components/features/SurfSlotCard";
import { MobileSurf } from "@/components/features/MobileSurf";
import {
  Pause, Play, Globe, Coins, Shield, Eye, Square,
  EyeOff, Layers, Zap, Smartphone, Wifi, Plus, Trash2, Server,
  Upload, Search, Activity, CheckCircle2, AlertCircle, XCircle,
  Loader2, RefreshCw, Download,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn, isElectron } from "@/lib/utils";
import { NETWORK_PRESETS } from "@/lib/mock-data";
import { addProxy, deleteProxy, importProxiesFromFile, importProxiesFromContent, scrapeProxiesFromUrl, testProxy } from "@/lib/storage";
import { toast } from "@/hooks/useToast";
import type { Proxy as ProxyType, ProxyTestResult } from "@/types";

const SLOT_OPTIONS = [1,2,3,4,5,6,7,8,9,10];

// Mobile detection
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export default function Surf() {
  const { user } = useAuth();
  const eng = useSurfEngine();
  const [isMobileView, setIsMobileView] = useState(false);
  const [currentMobileSlot, setCurrentMobileSlot] = useState(0);
  const [showAddProxy, setShowAddProxy] = useState(false);
  const [proxyTab, setProxyTab] = useState('add');
  const [newProxy, setNewProxy] = useState({
    type: 'http',
    host: '',
    port: '',
    username: '',
    password: '',
    country: '',
    timezone: '',
    language: 'en-US',
  });
  const [proxyTextInput, setProxyTextInput] = useState('');
  const [proxyScrapeUrl, setProxyScrapeUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [testingProxyId, setTestingProxyId] = useState<string | null>(null);
  const [proxyTestResults, setProxyTestResults] = useState<Record<string, ProxyTestResult>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  const handleAddProxy = async () => {
    if (!newProxy.host || !newProxy.port) {
      toast({ title: 'Error', description: 'Host and port are required!', variant: 'default' });
      return;
    }
    try {
      await addProxy({
        type: newProxy.type as any,
        host: newProxy.host,
        port: parseInt(newProxy.port),
        username: newProxy.username || undefined,
        password: newProxy.password || undefined,
        country: newProxy.country || undefined,
        timezone: newProxy.timezone || undefined,
        language: newProxy.language,
      });
      toast({ title: 'Success', description: 'Proxy added!', variant: 'default' });
      setNewProxy({
        type: 'http',
        host: '',
        port: '',
        username: '',
        password: '',
        country: '',
        timezone: '',
        language: 'en-US',
      });
      setShowAddProxy(false);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to add proxy!', variant: 'default' });
      console.error(e);
    }
  };

  const handleDeleteProxy = async (id: string) => {
    try {
      await deleteProxy(id);
      setProxyTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: 'Success', description: 'Proxy deleted!', variant: 'default' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete proxy!', variant: 'default' });
      console.error(e);
    }
  };

  const handleTestProxy = async (proxy: ProxyType) => {
    if (testingProxyId || isTestingAll) return;
    setTestingProxyId(proxy.id);
    try {
      const result = await testProxy(proxy);
      if (result) {
        setProxyTestResults((prev) => ({ ...prev, [proxy.id]: result }));
        toast({
          title: result.working ? 'Proxy working' : 'Proxy failed',
          description: result.working
            ? `${proxy.host}:${proxy.port} — ${result.speed}ms${result.ip ? ` • ${result.ip}` : ''}`
            : result.error || 'Connection failed',
          variant: 'default',
        });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to test proxy!', variant: 'default' });
      console.error(e);
    } finally {
      setTestingProxyId(null);
    }
  };

  const handleTestAllProxies = async () => {
    if (eng.proxies.length === 0 || testingProxyId || isTestingAll) return;
    setIsTestingAll(true);
    let working = 0;
    let failed = 0;
    for (const proxy of eng.proxies) {
      setTestingProxyId(proxy.id);
      try {
        const result = await testProxy(proxy);
        if (result) {
          setProxyTestResults((prev) => ({ ...prev, [proxy.id]: result }));
          if (result.working) working++;
          else failed++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        console.error(e);
      }
    }
    setTestingProxyId(null);
    setIsTestingAll(false);
    toast({
      title: 'Batch test complete',
      description: `${working} working, ${failed} failed`,
      variant: 'default',
    });
  };

  const handleSelectFile = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    try {
      const fileResult = await electronAPI.dialogOpenFile({
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'CSV Files', extensions: ['csv'] },
        ],
      });
      if (!fileResult.canceled && Array.isArray(fileResult.filePaths) && fileResult.filePaths.length > 0) {
        const filePath = fileResult.filePaths[0];
        if (!filePath) {
          toast({ title: 'Import canceled', description: 'No file was selected.', variant: 'default' });
          return;
        }
        setIsImporting(true);
        const result = await importProxiesFromFile(filePath);
        const n = result?.count || 0;
        const desc = n === 0 ? 'No proxies imported' : n === 1 ? '1 proxy imported' : `${n} proxies imported`;
        toast({ title: 'Import complete', description: desc, variant: 'default' });
        setIsImporting(false);
      } else {
        toast({ title: 'Import canceled', description: 'No file was selected.', variant: 'default' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to import proxies from file!', variant: 'default' });
      console.error(e);
      setIsImporting(false);
    }
  };

  const handleImportText = async () => {
    if (!proxyTextInput.trim()) {
      toast({ title: 'Error', description: 'Please enter proxy text!', variant: 'default' });
      return;
    }
    setIsImporting(true);
    try {
      const result = await importProxiesFromContent(proxyTextInput);
      toast({ title: 'Success', description: `Imported ${result.count} proxies!`, variant: 'default' });
      setProxyTextInput('');
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to import proxies!', variant: 'default' });
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  const handleScrape = async () => {
    if (!proxyScrapeUrl.trim()) {
      toast({ title: 'Error', description: 'Please enter a URL!', variant: 'default' });
      return;
    }
    setIsScraping(true);
    try {
      const result = await scrapeProxiesFromUrl(proxyScrapeUrl);
      toast({ title: 'Success', description: `Scraped and imported ${result.count} proxies!`, variant: 'default' });
      setProxyScrapeUrl('');
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to scrape proxies!', variant: 'default' });
      console.error(e);
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    setIsMobileView(isMobile());
    const handleResize = () => setIsMobileView(isMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allPaused = eng.slots.length > 0 && eng.slots.every((s) => s.isPaused);
  const activeSlots = eng.slots.filter((s) => s.popupOpen && !s.isPaused).length;
  const sessionStatus = !eng.isRunning
    ? "Surf engine is stopped"
    : allPaused
      ? "All slots are paused. Resume to continue."
      : eng.showPopups
        ? `Viewing ${activeSlots}/${eng.slotCount} popup window(s) rotating through campaigns. Updates every ${eng.duration}s.`
        : `Surfing ${activeSlots}/${eng.slotCount} active slot(s) in background. Updates every ${eng.duration}s.`;
  const gridCols =
    eng.slotCount === 1 ? "grid-cols-1"
    : eng.slotCount === 2 ? "grid-cols-1 md:grid-cols-2"
    : "grid-cols-1 md:grid-cols-2";

  if (eng.pool.length === 0) {
    return (
      <DashboardLayout title="Surf & Earn" subtitle="Earn credits by visiting other marketers' websites.">
        <Card className="p-12 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-xl bg-primary/10 mx-auto flex items-center justify-center mb-3">
            <Globe className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold">No active campaigns yet</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Once campaigns are added and approved they'll appear here. Submit your own site to seed the rotation.
          </p>
          <Link to="/campaigns"><Button className="mt-5">Add a campaign</Button></Link>
        </Card>
      </DashboardLayout>
    );
  }

  // Mobile view - single slot with iframe
  if (isMobileView) {
    const currentSlot = eng.slots[currentMobileSlot] || { campaign: eng.pool[0], isPaused: false, remaining: 15, id: 0, popupOpen: false, popupBlocked: false, deviceType: 'Desktop Chrome' };
    const handleMobileComplete = () => {
      setCurrentMobileSlot((prev) => (prev + 1) % Math.max(eng.pool.length, 1));
    };

    return (
      <DashboardLayout title="Surf & Earn" subtitle="Mobile surf mode - view one site at a time.">
        <div className="space-y-4">
          {/* Mobile surf controls */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Mobile Mode</span>
              </div>
              {!eng.isRunning ? (
                <Button size="sm" onClick={() => {
                  eng.setSlotCount(1);
                  eng.start();
                }}>
                  <Play className="w-4 h-4 mr-2" /> Start
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={eng.stop}>
                  <Square className="w-4 h-4 mr-2" /> Stop
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">+{eng.sessionCredits}</p>
                <p className="text-xs text-muted-foreground">Credits earned</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{eng.sessionVisits}</p>
                <p className="text-xs text-muted-foreground">Sites visited</p>
              </div>
            </div>
          </Card>

          {/* Mobile surf interface */}
          {eng.isRunning && currentSlot.campaign && (
            <div className="h-[60vh]">
              <MobileSurf
                campaign={currentSlot.campaign}
                duration={currentSlot.remaining || 15}
                onComplete={handleMobileComplete}
                onNext={handleMobileComplete}
                onClose={() => eng.stop()}
                isPaused={currentSlot.isPaused}
                onPause={() => eng.pauseSlot(0)}
                onResume={() => eng.resumeSlot(0)}
              />
            </div>
          )}

          {!eng.isRunning && (
            <Card className="p-8 text-center">
              <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Mobile Surf Mode</h3>
              <p className="text-sm text-muted-foreground mb-4">
                View one site at a time in an embedded browser. Perfect for mobile devices.
              </p>
              <Button onClick={() => {
                eng.setSlotCount(1);
                eng.start();
              }}>
                <Play className="w-4 h-4 mr-2" /> Start surfing
              </Button>
            </Card>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Surf & Earn" subtitle={`Earn credits by visiting other marketers' websites — surf up to ${eng.maxSlots} sites at once.`}>
      {/* Mode banner */}
      {!isElectron() && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Web Demo Mode</h3>
              <p className="text-sm text-amber-700 mt-1">
                You're using the web version. For full features including search automation,
                proxies, and human-like behavior, download and use the desktop app.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="primary" className="bg-amber-600 hover:bg-amber-700">
                  <Download className="w-4 h-4 mr-2" /> Download Desktop App
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* Master controls */}
          <Card className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Concurrent surf windows</span>
            <div className="flex gap-1 ml-1">
              {SLOT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => eng.setSlotCount(n)}
                  disabled={eng.isRunning}
                  className={cn(
                    "h-9 w-9 rounded-lg text-sm font-bold transition-colors border",
                    eng.slotCount === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-muted",
                    eng.isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Visit duration</span>
            <input
              type="range"
              min={10}
              max={60}
              value={eng.duration}
              onChange={(e) => eng.setDuration(parseInt(e.target.value))}
              disabled={eng.isRunning}
              className="w-32"
            />
            <Badge variant="muted" className="ml-1">{eng.duration}s</Badge>
          </div>

          {isElectron() && (
            <>
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Network</span>
                <select
                  value={eng.networkThrottle}
                  onChange={(e) => eng.setNetworkThrottle(e.target.value)}
                  disabled={eng.isRunning}
                  className="h-9 bg-card border border-border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {NETWORK_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset === 'none' ? 'No throttling' : preset.replace('-', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Device / User-Agent</span>
                <select
                  value={eng.globalDevice}
                  onChange={(e) => eng.setGlobalDevice(e.target.value)}
                  disabled={eng.isRunning}
                  className="h-9 bg-card border border-border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Random">Random</option>
                  {eng.availableDevices.map((device) => (
                    <option key={device} value={device}>{device}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Proxy</span>
                <select
                  value={eng.proxyMode}
                  onChange={(e) => eng.setProxyMode(e.target.value as any)}
                  disabled={eng.isRunning}
                  className="h-9 bg-card border border-border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="none">None</option>
                  <option value="single">Single Proxy</option>
                  <option value="rotate">Rotate</option>
                  <option value="per-slot">Per Slot</option>
                </select>
                {eng.proxyMode === 'single' && eng.proxies.length > 0 && (
                  <select
                    value={eng.selectedProxyId || ''}
                    onChange={(e) => eng.setSelectedProxyId(e.target.value || null)}
                    disabled={eng.isRunning}
                    className="h-9 bg-card border border-border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {eng.proxies.map(p => (
                      <option key={p.id} value={p.id}>{p.host}:{p.port}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
        </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[hsl(var(--primary))]"
                    checked={eng.autoRotate}
                    onChange={(e) => eng.setAutoRotate(e.target.checked)}
                  />
                  Auto-rotate
                </label>
                {!eng.isRunning ? (
                  <Button onClick={eng.start}>
                    <Play className="w-4 h-4" /> Start surfing {eng.slotCount > 1 ? `(${eng.slotCount}×)` : ""}
                  </Button>
                ) : allPaused ? (
                  <Button onClick={eng.resumeAll}>
                    <Play className="w-4 h-4" /> Resume all
                  </Button>
                ) : (
                  <Button variant="outline" onClick={eng.pauseAll}>
                    <Pause className="w-4 h-4" /> Pause all
                  </Button>
                )}
                {eng.isRunning ? (
                  <Button variant="ghost" onClick={eng.stop} className="text-red-500 hover:text-red-500">
                    <Square className="w-4 h-4 mr-1" /> Stop
                  </Button>
                ) : null}
                
                {isElectron() && (
                  <Button
                    variant="outline"
                    onClick={eng.toggleShowPopups}
                    title={eng.showPopups ? "Switch to background mode (hidden)" : "Switch to visible browser mode"}
                    className="whitespace-nowrap"
                  >
                    {eng.showPopups ? (
                      <>
                        <Eye className="w-4 h-4 mr-1" /> Visible Browser Mode
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 mr-1" /> Background Mode (Hidden)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {eng.isRunning && eng.hidden && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <EyeOff className="w-3 h-3" /> Background mode — timers keep running while this tab is hidden.
              </p>
            )}
          </Card>

          <Card className="p-4 border-l-4 border-primary bg-primary/5">
            <div className="text-sm">
              <p className="font-semibold">Session status</p>
              <p className="text-base font-bold mt-2">{sessionStatus}</p>
            </div>
          </Card>

          {/* Slots grid */}
          {!eng.isRunning ? (
            <Card className="p-10 text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 border-primary/20">
              <div className="w-14 h-14 rounded-xl bg-primary/10 mx-auto flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold">Background surfing mode</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Surf runs silently in the background. No popups will appear on your screen.
                Your timers keep running in Web Workers, and you'll earn credits automatically.
              </p>
              <Button className="mt-5" onClick={eng.start}>
                I'm not a robot — Start surfing {eng.slotCount > 1 ? `(${eng.slotCount}×)` : ""}
              </Button>
            </Card>
          ) : (
          <div className={`grid ${gridCols} gap-3`}>
            {eng.slots.map((slot) => (
              <SurfSlotCard
                key={slot.id}
                slot={slot}
                duration={eng.duration}
                hidden={eng.hidden}
                showPopups={eng.showPopups}
                availableDevices={eng.availableDevices}
                onPause={eng.pauseSlot}
                onResume={eng.resumeSlot}
                onNext={eng.nextSlot}
                onReopen={eng.reopenSlot}
                onSetDevice={eng.setSlotDevice}
                onSetUserAgent={eng.setSlotUserAgent}
                onSetHeadless={eng.setSlotHeadless}
                proxies={eng.proxies}
                onSetProxy={eng.setSlotProxy}
                proxyMode={eng.proxyMode}
              />
            ))}
          </div>
        )}

          <Card className="p-4 bg-gradient-to-br from-primary/5 via-card to-accent/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-semibold">Multi-window surfing engine</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Each slot opens its own popup, runs its own timer in a Web Worker, and earns credits independently.
                  Your timer stays accurate even when this tab is hidden, minimized, or the browser is in another app.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>This session</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Credits earned</p>
                <p className="text-3xl font-bold text-primary">+{eng.sessionCredits}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sites visited</p>
                <p className="text-2xl font-bold">{eng.sessionVisits}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active slots</p>
                <p className="text-2xl font-bold">{eng.slots.filter((s) => s.popupOpen && !s.isPaused).length} / {eng.slotCount}</p>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-xl font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-accent" /> {user?.credits.toLocaleString() ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pool ({eng.pool.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {eng.pool.slice(0, 8).map((s) => {
                const inUse = eng.slots.some((slot) => slot.campaign?.id === s.id);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "p-2.5 rounded-lg border",
                      inUse ? "border-primary/40 bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.url}</p>
                      </div>
                      {inUse && <Badge variant="success" className="text-[9px]">LIVE</Badge>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Proxies ({eng.proxies.length})</CardTitle>
                <div className="flex items-center gap-1">
                  {eng.proxies.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleTestAllProxies}
                      disabled={eng.isRunning || isTestingAll || !!testingProxyId}
                      title="Test all proxies"
                    >
                      {isTestingAll ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddProxy(!showAddProxy)}
                    disabled={eng.isRunning}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showAddProxy && (
                <Tabs value={proxyTab} onValueChange={setProxyTab} className="w-full">
                  <TabsList className="flex flex-wrap h-auto gap-2 mb-4">
                    <TabsTrigger value="add">Add Single</TabsTrigger>
                    <TabsTrigger value="file">Import File</TabsTrigger>
                    <TabsTrigger value="text">Import Text</TabsTrigger>
                    <TabsTrigger value="scrape">Scrape</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="add" className="space-y-2 border border-border rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          value={newProxy.type}
                          onChange={(e) => setNewProxy({ ...newProxy, type: e.target.value })}
                          className="w-full h-8 bg-card border border-border rounded px-2 text-sm"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks4">SOCKS4</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Port</Label>
                        <Input
                          type="number"
                          value={newProxy.port}
                          onChange={(e) => setNewProxy({ ...newProxy, port: e.target.value })}
                          placeholder="8080"
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Host</Label>
                      <Input
                        value={newProxy.host}
                        onChange={(e) => setNewProxy({ ...newProxy, host: e.target.value })}
                        placeholder="proxy.example.com"
                        className="h-8"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Username (Optional)</Label>
                        <Input
                          value={newProxy.username}
                          onChange={(e) => setNewProxy({ ...newProxy, username: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Password (Optional)</Label>
                        <Input
                          type="password"
                          value={newProxy.password}
                          onChange={(e) => setNewProxy({ ...newProxy, password: e.target.value })}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Country</Label>
                        <Input
                          value={newProxy.country}
                          onChange={(e) => setNewProxy({ ...newProxy, country: e.target.value })}
                          placeholder="US"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Timezone</Label>
                        <Input
                          value={newProxy.timezone}
                          onChange={(e) => setNewProxy({ ...newProxy, timezone: e.target.value })}
                          placeholder="America/New_York"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Language</Label>
                        <Input
                          value={newProxy.language}
                          onChange={(e) => setNewProxy({ ...newProxy, language: e.target.value })}
                          placeholder="en-US"
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddProxy(false)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleAddProxy}>
                        Add Proxy
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-2 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        className="flex-1"
                        onClick={handleSelectFile}
                        disabled={eng.isRunning || isImporting}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Select File
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supports any format: TXT, JSON, CSV, or plain text with proxies in lines
                    </p>
                  </TabsContent>

                  <TabsContent value="text" className="space-y-2 border border-border rounded-lg p-3">
                    <Label className="text-xs">Paste proxies (one per line)</Label>
                    <Textarea
                      value={proxyTextInput}
                      onChange={(e) => setProxyTextInput(e.target.value)}
                      placeholder="192.168.1.1:8080&#10;socks5://proxy.example.com:1080&#10;user:pass@host:port"
                      className="min-h-[100px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleImportText}
                        disabled={eng.isRunning || isImporting}
                      >
                        Import
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="scrape" className="space-y-2 border border-border rounded-lg p-3">
                    <Label className="text-xs">URL to scrape proxies from</Label>
                    <div className="flex gap-2">
                      <Input
                        value={proxyScrapeUrl}
                        onChange={(e) => setProxyScrapeUrl(e.target.value)}
                        placeholder="https://example.com/proxies"
                        className="flex-1"
                      />
                      <Button
                        onClick={handleScrape}
                        disabled={eng.isRunning || isScraping}
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Scrape
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Will extract any proxies from the page text content
                    </p>
                  </TabsContent>
                </Tabs>
              )}

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {eng.proxies.map((p) => {
                  const result = proxyTestResults[p.id];
                  const isTesting = testingProxyId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "p-2.5 rounded-lg border bg-card",
                        result?.working && "border-emerald-500/30",
                        result && !result.working && "border-red-500/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{p.host}:{p.port}</p>
                            {result && (
                              result.working ? (
                                <Badge variant="success" className="text-[9px] shrink-0">
                                  <CheckCircle2 className="w-3 h-3" /> OK
                                </Badge>
                              ) : (
                                <Badge variant="danger" className="text-[9px] shrink-0">
                                  <XCircle className="w-3 h-3" /> Fail
                                </Badge>
                              )
                            )}
                            {isTesting && (
                              <Badge variant="muted" className="text-[9px] shrink-0">
                                <Loader2 className="w-3 h-3 animate-spin" /> Testing
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {p.type.toUpperCase()}
                            {p.country && ` • ${p.country}`}
                            {p.timezone && ` • ${p.timezone}`}
                          </p>
                          {result && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {result.speed != null && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Activity className="w-3 h-3" />
                                  {result.speed}ms
                                </span>
                              )}
                              {result.ip && (
                                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                                  {result.ip}
                                </span>
                              )}
                              {(result.country || p.country) && (
                                <Badge variant="muted" className="text-[9px]">
                                  {result.country || p.country}
                                </Badge>
                              )}
                              {result.exposed && (
                                <Badge variant="warning" className="text-[9px]">
                                  <AlertCircle className="w-3 h-3" /> Exposed
                                </Badge>
                              )}
                              {result.banned && (
                                <Badge variant="danger" className="text-[9px]">
                                  Banned
                                </Badge>
                              )}
                              {result.error && !result.working && (
                                <span className="text-[10px] text-red-500 truncate max-w-full" title={result.error}>
                                  {result.error}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestProxy(p)}
                            disabled={eng.isRunning || isTestingAll || isTesting}
                            title="Test proxy"
                          >
                            {isTesting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Activity className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProxy(p.id)}
                            disabled={eng.isRunning || isTestingAll}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
