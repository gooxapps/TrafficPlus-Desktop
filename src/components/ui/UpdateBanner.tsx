import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/hooks/useToast';

export default function UpdateBanner() {
  const [status, setStatus] = useState<null | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available'>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.onUpdateEvent) return;

    const handler = (type: string, payload: any) => {
      if (type === 'checking') {
        setStatus('checking');
        toast({ title: 'Checking for updates' });
      } else if (type === 'available') {
        setStatus('available');
        setInfo(payload);
        toast({ title: 'Update available', description: `Version ${payload.version}` });
      } else if (type === 'not-available') {
        setStatus('not-available');
        toast({ title: 'No updates available' });
      } else if (type === 'progress') {
        setStatus('downloading');
        setProgress(Math.round((payload.percent || 0)));
      } else if (type === 'downloaded') {
        setStatus('downloaded');
        setInfo(payload);
        toast({ title: 'Update downloaded', description: 'Will be installed on quit or you can install now.' });
      }
    };

    const remover = electronAPI.onUpdateEvent(handler);
    return () => { if (typeof remover === 'function') remover(); };
  }, []);

  const doCheck = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.updateCheck) return;
    const res = await electronAPI.updateCheck();
    if (res && res.success) {
      toast({ title: 'Manual update check triggered' });
    } else {
      toast({ title: 'Update check failed', description: res && res.error });
    }
  };

  const installNow = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.updateInstall) return;
    await electronAPI.updateInstall();
  };

  if (!status) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-accent text-accent-foreground rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
        <div>
          {status === 'checking' && <div>Checking for updates…</div>}
          {status === 'available' && <div>Update available{info?.version ? ` — ${info.version}` : ''}</div>}
          {status === 'downloading' && <div>Downloading update… {progress ? `${progress}%` : ''}</div>}
          {status === 'downloaded' && <div>Update ready to install</div>}
          {status === 'not-available' && <div>No updates available</div>}
        </div>
        <div className="flex items-center gap-2">
          {(status === 'available' || status === 'not-available' || status === 'checking') && (
            <Button variant="outline" onClick={doCheck}>Check now</Button>
          )}
          {status === 'downloaded' && (
            <Button onClick={installNow}>Restart & Install</Button>
          )}
        </div>
      </div>
    </div>
  );
}
