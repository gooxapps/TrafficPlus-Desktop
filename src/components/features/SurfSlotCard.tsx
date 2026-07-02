import type { SurfSlot } from "@/contexts/SurfEngineContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import {
  Globe, Pause, Play, ChevronRight, ExternalLink,
  AlertTriangle, MonitorPlay, Coins, Smartphone,
  Eye, EyeOff, Shield
} from "lucide-react";
import { isElectron } from "@/lib/utils";
import type { Proxy as ProxyType } from "@/types";

interface Props {
  slot: SurfSlot;
  duration: number;
  hidden: boolean;
  showPopups?: boolean;
  availableDevices?: string[];
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onNext: (id: number) => void;
  onReopen: (id: number) => void;
  onSetDevice?: (id: number, deviceType: string) => void;
  onSetUserAgent?: (id: number, userAgent: string) => void;
  onSetHeadless?: (id: number, headless: boolean) => void;
  proxies?: ProxyType[];
  onSetProxy?: (id: number, proxyId: string | null) => void;
  proxyMode?: string;
}

export function SurfSlotCard({ slot, duration, hidden, showPopups = false, availableDevices = [], onPause, onResume, onNext, onReopen, onSetDevice, onSetUserAgent, onSetHeadless, proxies = [], onSetProxy, proxyMode }: Props) {
  const c = slot.campaign;
  const progress = ((duration - slot.remaining) / duration) * 100;
  const isWebMode = !isElectron();
  
  const status = !c
    ? "Idle"
    : isWebMode
      ? slot.isPaused
        ? "Paused"
        : "Viewing in iframe"
      : slot.popupBlocked && showPopups
        ? "Popup blocked"
        : !slot.popupOpen && showPopups
          ? "Popup closed"
          : slot.isPaused
            ? "Paused"
            : showPopups
              ? "Popup open"
              : "Surfing in background";
              
  const statusLabel = !c
    ? "Waiting for campaign"
    : isWebMode
      ? slot.isPaused
        ? "Resume this slot to continue surfing"
        : `Next link in ${slot.remaining}s`
      : slot.popupBlocked && showPopups
        ? "Allow popups and reopen to continue"
        : !slot.popupOpen && showPopups
          ? "Popup is closed; reopen this slot"
          : slot.isPaused
            ? "Resume this slot to continue surfing"
            : `Next link in ${slot.remaining}s`;

  // Determine if device is mobile
  const isMobileDevice = slot.deviceType?.toLowerCase().includes('iphone') || 
                        slot.deviceType?.toLowerCase().includes('galaxy') || 
                        slot.deviceType?.toLowerCase().includes('ipad');

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Slot {slot.id + 1}</p>
            <p className="font-semibold text-sm truncate">{c?.title ?? "Idle"}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{status}</p>
              {slot.deviceType && (
                <Badge variant="muted" className="text-[9px] flex items-center gap-1">
                  {isMobileDevice ? <Smartphone className="w-2.5 h-2.5" /> : <MonitorPlay className="w-2.5 h-2.5" />}
                  {slot.deviceType}
                </Badge>
              )}
              {slot.proxy && (
                <Badge variant="accent" className="text-[9px] font-mono flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  {slot.proxy.host}:{slot.proxy.port}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge variant="primary" className="text-[10px]"><Coins className="w-3 h-3" /> +1</Badge>
          {hidden && !slot.isPaused && (isWebMode || slot.popupOpen) && (
            <Badge variant="success" className="text-[10px]">BG</Badge>
          )}
        </div>
      </div>

      <div className="relative aspect-[16/10] bg-gradient-to-br from-muted/20 via-card to-card flex items-center justify-center">
        {!c ? (
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-xl bg-muted mx-auto flex items-center justify-center mb-2">
              <Globe className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Waiting...</p>
            <p className="text-xs text-muted-foreground">No campaign assigned yet</p>
          </div>
        ) : isWebMode ? (
          <iframe
            src={c.url}
            title={c.title}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
            loading="lazy"
          />
        ) : showPopups && slot.popupBlocked ? (
          <div className="text-center max-w-xs p-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 mx-auto flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-sm font-semibold">Popup blocked</p>
            <p className="text-xs text-muted-foreground mt-1">Allow popups, then reopen this slot.</p>
            <Button size="sm" className="mt-3" onClick={() => onReopen(slot.id)}>
              <ExternalLink className="w-3.5 h-3.5" /> Reopen
            </Button>
          </div>
        ) : showPopups && !slot.popupOpen ? (
          <div className="text-center p-4">
            <div className="w-11 h-11 rounded-xl bg-muted mx-auto flex items-center justify-center mb-2">
              <ExternalLink className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Popup closed</p>
            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[220px] mx-auto">{c.url}</p>
            <Button size="sm" className="mt-3" onClick={() => onReopen(slot.id)}>
              <ExternalLink className="w-3.5 h-3.5" /> Reopen popup
            </Button>
          </div>
        ) : (
          <div className="text-center p-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl" />
              <div className="relative w-14 h-14 rounded-xl bg-card border border-primary/40 flex items-center justify-center mx-auto glow-primary">
                <MonitorPlay className="w-7 h-7 text-primary" />
              </div>
            </div>
            <p className="font-semibold text-sm mt-2">{slot.isPaused ? "Paused" : showPopups ? "Popup open" : "Surfing"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px] mx-auto truncate">{c.title}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{showPopups ? "Viewing in popup" : "Running in background"}</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-card border-t border-border">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-3xl font-bold tracking-tight">{slot.remaining}s</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-semibold">{statusLabel}</p>
          </div>
        </div>
        <Progress value={progress} />
        
        {/* Device selector */}
        {availableDevices.length > 0 && onSetDevice && (
          <div className="mt-3">
            <label className="text-[11px] text-muted-foreground block mb-1">Device</label>
            <select
              value={slot.deviceType || availableDevices[0]}
              onChange={(e) => onSetDevice(slot.id, e.target.value)}
              className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 py-1"
            >
              {availableDevices.map((device) => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </div>
        )}

        {onSetUserAgent && (
          <div className="mt-3">
            <label className="text-[11px] text-muted-foreground block mb-1">Custom User-Agent</label>
            <input
              type="text"
              value={slot.userAgent ?? ""}
              onChange={(e) => onSetUserAgent(slot.id, e.target.value)}
              placeholder="Leave blank to use device UA"
              className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 py-1"
            />
          </div>
        )}

        {isElectron() && onSetHeadless && (
          <div className="mt-3">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={slot.headless ?? false}
                onChange={(e) => onSetHeadless(slot.id, e.target.checked)}
                className="w-3 h-3 accent-[hsl(var(--primary))]"
              />
              Headless mode (no visible window)
            </label>
          </div>
        )}

        {proxyMode === 'per-slot' && onSetProxy && proxies.length > 0 && (
          <div className="mt-3">
            <label className="text-[11px] text-muted-foreground block mb-1">Proxy Profile</label>
            <select
              value={slot.proxy?.id || ""}
              onChange={(e) => onSetProxy(slot.id, e.target.value || null)}
              className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 py-1 font-mono"
            >
              <option value="">No Proxy (Direct Connection)</option>
              {proxies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.type.toUpperCase()} • {p.host}:{p.port} {p.country ? `(${p.country})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {proxyMode === 'per-slot' && onSetProxy && proxies.length === 0 && (
          <div className="mt-3 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded p-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              No proxies loaded. Configure proxies on the <a href="/proxies" className="underline font-semibold">Proxies page</a> first.
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {slot.isPaused ? (
            <Button size="sm" onClick={() => onResume(slot.id)}>
              <Play className="w-3.5 h-3.5" /> Resume
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onPause(slot.id)}>
              <Pause className="w-3.5 h-3.5" /> Pause
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onNext(slot.id)}>
            <ChevronRight className="w-3.5 h-3.5" /> Skip
          </Button>
        </div>
      </div>
    </Card>
  );
}
