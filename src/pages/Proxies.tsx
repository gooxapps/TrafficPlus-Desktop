import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProxies,
  importProxiesFromFile,
  importProxiesFromContent,
  testProxy,
  deleteProxy,
  clearAllProxies,
  deleteProxiesByIds
} from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { toast } from "@/hooks/useToast";
import type { Proxy as ProxyType, ProxyTestResult } from "@/types";
import {
  Trash2, RefreshCw, Play, CheckCircle2, XCircle, AlertCircle,
  Loader2, Upload, FileText, Check, Activity, Search, Copy, Globe, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const electronAPI = (window as any).electronAPI;

export default function Proxies() {
  const navigate = useNavigate();
  const [proxies, setProxies] = useState<ProxyType[]>([]);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isTestingAll, setIsTestingAll] = useState(false);
  
  // Drag and drop state
  const [dragOver, setDragOver] = useState(false);
  
  // Test execution state
  const [testingProxyId, setTestingProxyId] = useState<string | null>(null);
  const [testingCount, setTestingCount] = useState(0);
  const [testingTotal, setTestingTotal] = useState(0);
  const [proxyTestResults, setProxyTestResults] = useState<Record<string, ProxyTestResult>>({});
  
  // Filter & selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = await getProxies();
      setProxies(p || []);
      // Reset selected ids on reload to avoid referencing deleted/missing items
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load proxies', variant: 'default' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Compute status counts based on loaded proxies and current session test results
  const stats = React.useMemo(() => {
    let total = proxies.length;
    let working = 0;
    let failed = 0;
    let untested = 0;

    proxies.forEach((p) => {
      const res = proxyTestResults[p.id];
      if (!res) {
        untested++;
      } else if (res.working) {
        working++;
      } else {
        failed++;
      }
    });

    return { total, working, failed, untested };
  }, [proxies, proxyTestResults]);

  // Handle Drag & Drop File Import
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const res = await importProxiesFromContent(text);
      const n = res?.count || 0;
      const desc = n === 0 ? 'No proxies imported' : n === 1 ? '1 proxy imported' : `${n} proxies imported`;
      toast({ title: 'Import complete', description: desc, variant: 'default' });
      await load();
      setPasteValue("");
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Import failed', description: err?.message || 'Failed to import proxies', variant: 'default' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFile = async () => {
    setIsImporting(true);
    try {
      let res;
      if (electronAPI) {
        const dialogResult = await electronAPI.dialogOpenFile({
          properties: ['openFile'],
          filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (dialogResult.canceled || !dialogResult.filePaths?.length) {
          return;
        }

        res = await importProxiesFromFile(dialogResult.filePaths[0]);
      } else {
        fileInputRef.current?.click();
        return;
      }

      const n = res?.count || 0;
      const desc = n === 0 ? 'No proxies imported' : n === 1 ? '1 proxy imported' : `${n} proxies imported`;
      toast({ title: 'Import complete', description: desc, variant: 'default' });
      await load();
      setPasteValue("");
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Import failed', description: err?.message || 'Failed to import proxies', variant: 'default' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const res = await importProxiesFromContent(text);
      const n = res?.count || 0;
      const desc = n === 0 ? 'No proxies imported' : n === 1 ? '1 proxy imported' : `${n} proxies imported`;
      toast({ title: 'Import complete', description: desc, variant: 'default' });
      await load();
      setPasteValue("");
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Import failed', description: err?.message || 'Failed to import proxies', variant: 'default' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportPaste = async () => {
    if (!pasteValue.trim()) {
      toast({ title: 'Nothing to import', description: 'Paste proxy text before importing.', variant: 'default' });
      return;
    }

    setIsImporting(true);
    try {
      const res = await importProxiesFromContent(pasteValue);
      const n = res?.count || 0;
      const desc = n === 0 ? 'No proxies imported' : n === 1 ? '1 proxy imported' : `${n} proxies imported`;
      toast({ title: 'Import complete', description: desc, variant: 'default' });
      await load();
      setPasteValue("");
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Import failed', description: err?.message || 'Failed to import proxies', variant: 'default' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleScrapeFree = async () => {
    if (!electronAPI) {
      toast({ title: 'Not available', description: 'Free proxy scraping is only available in the desktop app.', variant: 'default' });
      return;
    }

    const confirmed = window.confirm(
      '⚠️ Warning: Free public proxies are not safe for sensitive use!\n\n' +
      'They may log your traffic, be operated by malicious actors, or be blocked by many websites. ' +
      'This feature will fetch, test, and import only working proxies from a public list. ' +
      'Do you want to continue?'
    );
    if (!confirmed) return;

    setIsScraping(true);
    try {
      const res = await electronAPI.proxiesScrapeFree(null, { maxProxies: 30, minUptimePercent: 60, maxLatencyMs: 3000 });
      if (res.success) {
        const n = res.count || 0;
        const desc = n === 0 ? 'No working proxies found' : n === 1 ? '1 working proxy imported' : `${n} working proxies imported`;
        toast({ title: 'Scraping complete', description: desc, variant: 'default' });
        await load();
      } else {
        toast({ title: 'Scraping failed', description: res.error || 'Failed to scrape proxies', variant: 'default' });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Scraping failed', description: err?.message || 'Failed to scrape proxies', variant: 'default' });
    } finally {
      setIsScraping(false);
    }
  };

  // Proxy actions
  const handleTest = async (proxy: ProxyType) => {
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
    } catch (error) {
      console.error(error);
      toast({ title: 'Proxy test failed', description: 'Unable to test proxy', variant: 'default' });
    } finally {
      setTestingProxyId(null);
    }
  };

  const handleTestAll = async () => {
    const listToTest = selectedIds.size > 0 
      ? proxies.filter(p => selectedIds.has(p.id))
      : proxies;

    if (listToTest.length === 0) {
      toast({ title: 'No proxies to test', description: 'Please add or select proxies first.', variant: 'default' });
      return;
    }

    setIsTestingAll(true);
    setTestingTotal(listToTest.length);
    setTestingCount(0);
    let working = 0;
    let failed = 0;

    for (let i = 0; i < listToTest.length; i++) {
      const proxy = listToTest[i];
      setTestingProxyId(proxy.id);
      setTestingCount(i + 1);
      
      try {
        const result = await testProxy(proxy);
        if (result) {
          setProxyTestResults((prev) => ({ ...prev, [proxy.id]: result }));
          if (result.working) working++;
          else failed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(error);
        failed++;
      }
    }

    setTestingProxyId(null);
    setIsTestingAll(false);
    toast({ title: 'Test complete', description: `${working} working, ${failed} failed`, variant: 'default' });
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await deleteProxy(id);
      await load();
      setProxyTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: 'Deleted', description: 'Proxy removed', variant: 'default' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Delete failed', description: 'Failed to remove proxy', variant: 'default' });
    }
  };

  // Bulk actions
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredProxies.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.size} selected proxies?`);
    if (!confirmed) return;

    try {
      const ids = Array.from(selectedIds);
      await deleteProxiesByIds(ids);
      toast({ title: 'Deleted', description: `${ids.length} proxies removed`, variant: 'default' });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete selected proxies', variant: 'default' });
    }
  };

  const handleDeleteFailed = async () => {
    // Collect IDs of failed proxies
    const failedIds = proxies
      .filter((p) => proxyTestResults[p.id] && !proxyTestResults[p.id].working)
      .map((p) => p.id);

    if (failedIds.length === 0) {
      toast({ title: 'No failed proxies', description: 'There are no failed proxies to delete.', variant: 'default' });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete all ${failedIds.length} failed proxies?`);
    if (!confirmed) return;

    try {
      await deleteProxiesByIds(failedIds);
      toast({ title: 'Deleted', description: `${failedIds.length} failed proxies removed`, variant: 'default' });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete failed proxies', variant: 'default' });
    }
  };

  const handleClearAll = async () => {
    if (proxies.length === 0) return;
    const confirmed = window.confirm('Are you sure you want to delete ALL proxies from storage? This cannot be undone.');
    if (!confirmed) return;

    try {
      await clearAllProxies();
      toast({ title: 'Cleared', description: 'All proxies removed', variant: 'default' });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to clear proxies', variant: 'default' });
    }
  };

  const handleCopyList = async () => {
    const listToCopy = selectedIds.size > 0 
      ? proxies.filter(p => selectedIds.has(p.id))
      : proxies;

    if (listToCopy.length === 0) {
      toast({ title: 'No proxies to copy', variant: 'default' });
      return;
    }

    const raw = listToCopy
      .map((p) => `${p.host}:${p.port}${p.username ? `:${p.username}:${p.password || ''}` : ''}`)
      .join("\n");
      
    try {
      await navigator.clipboard.writeText(raw);
      toast({ title: 'Copied', description: `${listToCopy.length} proxies copied to clipboard`, variant: 'default' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Copy failed', description: 'Unable to copy proxy list', variant: 'default' });
    }
  };

  const handleExportSelected = () => {
    const listToExport = selectedIds.size > 0
      ? proxies.filter((p) => selectedIds.has(p.id))
      : proxies;

    if (listToExport.length === 0) return;

    const raw = listToExport
      .map((p) => `${p.host}:${p.port}${p.username ? `:${p.username}:${p.password || ''}` : ''}`)
      .join("\n");

    const blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `proxies-export-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `Saved ${listToExport.length} proxies to file`, variant: 'default' });
  };

  // Filter the proxy list based on search query
  const filteredProxies = React.useMemo(() => {
    return proxies.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.host.toLowerCase().includes(q) ||
        p.port.toString().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.username && p.username.toLowerCase().includes(q))
      );
    });
  }, [proxies, searchQuery]);

  return (
    <DashboardLayout title="Proxies" subtitle="Import, paste, and test your proxy list.">
      <div 
        className="space-y-6 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Highlight Backdrop */}
        {dragOver && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-2xl flex flex-col items-center justify-center gap-3 z-50 backdrop-blur-sm pointer-events-none transition-all">
            <Upload className="w-12 h-12 text-primary animate-bounce" />
            <h3 className="text-xl font-bold text-primary">Drop to Import</h3>
            <p className="text-sm text-muted-foreground">Release to import txt or csv proxy list</p>
          </div>
        )}

        {/* Top summary cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Proxies</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Working</p>
              <p className="text-2xl font-bold text-emerald-500">{stats.working}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Untested</p>
              <p className="text-2xl font-bold">{stats.untested}</p>
            </div>
          </div>
        </div>

        {/* Progress Bar for Testing All */}
        {isTestingAll && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Testing proxies in progress...
              </div>
              <span className="text-muted-foreground">
                {testingCount} of {testingTotal} ({Math.round((testingCount / testingTotal) * 100)}%)
              </span>
            </div>
            <Progress value={(testingCount / testingTotal) * 100} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <div className="space-y-6">
            {/* Import / Paste section */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Import Proxies</h2>
                  <p className="text-sm text-muted-foreground">Drag & drop files, choose from disk, or paste directly.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleImportFile} disabled={isImporting} size="sm">
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Choose file
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.csv,text/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  {electronAPI && (
                    <Button onClick={handleScrapeFree} disabled={isScraping} variant="secondary" size="sm">
                      {isScraping ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                      Scrape free proxies
                    </Button>
                  )}
                </div>
              </div>

              <div className="border border-dashed border-border rounded-xl p-4 bg-muted/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/30 transition-all py-8" onClick={handleImportFile}>
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium">Click to select file or drag it here</span>
                <span className="text-xs text-muted-foreground mt-1">Supports TXT, CSV, JSON (ip:port or host:port:user:pass)</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm font-semibold">Or paste raw text</Label>
                  <Button onClick={handleImportPaste} disabled={isImporting || !pasteValue.trim()} size="sm">
                    Import pasted
                  </Button>
                </div>
                <Textarea
                  value={pasteValue}
                  onChange={(e) => setPasteValue(e.target.value)}
                  placeholder="One proxy per line, e.g.&#10;203.0.113.5:8080&#10;203.0.113.5:8080:username:password&#10;socks5://user:pass@192.0.2.1:1080"
                  className="min-h-[140px] font-mono text-xs"
                />
              </div>
            </div>

            {/* List / Table Section */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Loaded Proxies ({filteredProxies.length})</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Manage and test your active proxy credentials.</p>
                </div>
                
                {/* Search */}
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search host, port, country..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>

              {/* Bulk actions toolbar */}
              <div className="flex flex-wrap items-center gap-2 p-2 border border-border bg-muted/30 rounded-xl justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button 
                    onClick={handleTestAll} 
                    disabled={isTestingAll || proxies.length === 0} 
                    variant="primary" 
                    size="sm"
                  >
                    {isTestingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    {selectedIds.size > 0 ? `Test Selected (${selectedIds.size})` : 'Test All'}
                  </Button>
                  <Button 
                    onClick={handleCopyList} 
                    disabled={proxies.length === 0} 
                    variant="outline" 
                    size="sm"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy {selectedIds.size > 0 ? 'Selected' : 'All'}
                  </Button>
                  <Button 
                    onClick={handleExportSelected} 
                    disabled={proxies.length === 0} 
                    variant="outline" 
                    size="sm"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Export {selectedIds.size > 0 ? 'Selected' : 'All'}
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedIds.size > 0 && (
                    <Button 
                      onClick={handleDeleteSelected} 
                      variant="outline"
                      size="sm" 
                      className="text-red-500 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete Selected ({selectedIds.size})
                    </Button>
                  )}
                  {stats.failed > 0 && (
                    <Button 
                      onClick={handleDeleteFailed} 
                      variant="outline"
                      size="sm" 
                      className="text-red-500 hover:text-red-500"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Delete Failed
                    </Button>
                  )}
                  <Button 
                    onClick={handleClearAll} 
                    disabled={proxies.length === 0}
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:bg-red-500/10"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Table */}
              {proxies.length === 0 ? (
                <div className="text-center p-8 border border-border border-dashed rounded-xl py-12">
                  <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-semibold text-base">No proxies loaded</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Import proxies from a file, paste them above, or scrape free ones to get started.</p>
                </div>
              ) : filteredProxies.length === 0 ? (
                <div className="text-center p-8 border border-border border-dashed rounded-xl">
                  <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-semibold text-sm">No match found</h3>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase border-b border-border">
                      <tr>
                        <th className="p-3 w-10">
                          <Checkbox 
                            checked={filteredProxies.length > 0 && selectedIds.size === filteredProxies.length}
                            onCheckedChange={(checked) => handleToggleSelectAll(!!checked)}
                          />
                        </th>
                        <th className="p-3 font-semibold">Host / Port</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Auth</th>
                        <th className="p-3 font-semibold">Country</th>
                        <th className="p-3 font-semibold">Status / Result</th>
                        <th className="p-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredProxies.map((p) => {
                        const isSelected = selectedIds.has(p.id);
                        const result = proxyTestResults[p.id];
                        const isTesting = testingProxyId === p.id;
                        
                        return (
                          <tr 
                            key={p.id} 
                            className={cn(
                              "hover:bg-muted/40 transition-colors",
                              isSelected && "bg-primary/5 hover:bg-primary/10"
                            )}
                          >
                            <td className="p-3">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(checked) => handleToggleSelect(p.id, !!checked)}
                              />
                            </td>
                            <td className="p-3 font-mono font-medium">
                              {p.host}:{p.port}
                            </td>
                            <td className="p-3">
                              <Badge variant="primary" className="text-[10px] uppercase">
                                {p.type}
                              </Badge>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {p.username ? (
                                <span className="font-mono text-[11px]" title={`User: ${p.username}`}>
                                  {p.username}
                                </span>
                              ) : (
                                "No Auth"
                              )}
                            </td>
                            <td className="p-3 text-xs">
                              {p.country || "Unknown"}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {isTesting ? (
                                  <Badge variant="muted" className="text-[10px]">
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    Testing
                                  </Badge>
                                ) : result ? (
                                  result.working ? (
                                    <div className="flex flex-col gap-0.5">
                                      <Badge variant="success" className="text-[10px]">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Working
                                      </Badge>
                                      {result.speed && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                          <Activity className="w-2.5 h-2.5" />
                                          {result.speed}ms
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-0.5 max-w-[140px]">
                                      <Badge variant="danger" className="text-[10px]">
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Failed
                                      </Badge>
                                      {result.error && (
                                        <span className="text-[9px] text-red-500 truncate" title={result.error}>
                                          {result.error}
                                        </span>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <Badge variant="muted" className="text-[10px] bg-muted/50">
                                    Untested
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleTest(p)}
                                  disabled={isTestingAll || isTesting}
                                  title="Test Proxy"
                                >
                                  {isTesting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Activity className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                                  onClick={() => handleDeleteSingle(p.id)}
                                  disabled={isTestingAll || isTesting}
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Quick Launch Panel */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-bold">Quick Launch</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ready to start browsing? Take your verified proxy list straight into the surfing rotation engine.
              </p>
              
              <div className="rounded-xl border border-border p-4 bg-muted/20 text-xs text-muted-foreground flex gap-3">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-card-foreground">How proxies are allocated</span>
                  <p>In "Rotate" proxy mode, the Surf Engine will assign a unique proxy to each individual concurrent slot, automatically switching them to maximize browser session safety and mimic human activity.</p>
                </div>
              </div>

              <Button 
                onClick={() => navigate("/surf")} 
                className="w-full justify-center gradient-primary text-white shadow-md font-semibold h-11"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Surfing Now
              </Button>
            </div>

            {/* Help / Proxy Format info */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm">Supported File Formats</h3>
              <div className="space-y-3 font-mono">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Standard (HTTP/HTTPS):</div>
                  <div className="bg-muted p-2 rounded text-[10px]">192.168.1.1:8080</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Auth Protected:</div>
                  <div className="bg-muted p-2 rounded text-[10px]">192.168.1.1:8080:user:pass</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Protocol Prefix:</div>
                  <div className="bg-muted p-2 rounded text-[10px]">socks5://user:pass@192.168.1.1:1080</div>
                </div>
                <div className="space-y-1 text-sans text-muted-foreground">
                  JSON and CSV export/imports are automatically parsed if they contain standard "host", "port", "type" and "username"/"password" fields.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
