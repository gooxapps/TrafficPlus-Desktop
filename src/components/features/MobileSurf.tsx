import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ArrowLeft, ArrowRight, X, Clock, Coins, Globe, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";

interface MobileSurfProps {
  campaign: Campaign | null;
  duration: number;
  onComplete: () => void;
  onNext: () => void;
  onClose: () => void;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
}

export function MobileSurf({
  campaign,
  duration,
  onComplete,
  onNext,
  onClose,
  isPaused,
  onPause,
  onResume,
}: MobileSurfProps) {
  const [remaining, setRemaining] = useState(duration);
  const [showIframe, setShowIframe] = useState(false);

  useEffect(() => {
    if (!campaign || isPaused) return;

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [campaign, duration, isPaused, onComplete]);

  useEffect(() => {
    if (campaign) {
      setShowIframe(true);
    }
  }, [campaign]);

  if (!campaign) {
    return (
      <Card className="p-6 text-center">
        <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No campaign to surf</p>
        <Button onClick={onNext} className="mt-3">
          <ArrowRight className="w-4 h-4 mr-2" /> Next campaign
        </Button>
      </Card>
    );
  }

  const progress = ((duration - remaining) / duration) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <Card className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate flex-1">{campaign.title}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-2xl font-bold">{remaining}s</span>
          <Badge variant="muted" className="ml-auto">
            <Coins className="w-3 h-3 mr-1" /> +1 credit
          </Badge>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-2" />
      </Card>

      {/* Content area */}
      <div className="flex-1 relative bg-muted">
        {showIframe && (
          <iframe
            src={campaign.url}
            className="w-full h-full border-0"
            title={campaign.title}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
        {!showIframe && (
          <div className="flex items-center justify-center h-full">
            <Zap className="w-8 h-8 text-muted-foreground animate-pulse" />
          </div>
        )}
      </div>

      {/* Footer controls */}
      <Card className="p-3 border-t">
        <div className="flex gap-2">
          {isPaused ? (
            <Button onClick={onResume} className="flex-1">
              <Zap className="w-4 h-4 mr-2" /> Resume
            </Button>
          ) : (
            <Button onClick={onPause} variant="outline" className="flex-1">
              Pause
            </Button>
          )}
          <Button onClick={onNext} className="flex-1">
            <ArrowRight className="w-4 h-4 mr-2" /> Skip
          </Button>
        </div>
      </Card>
    </div>
  );
}
