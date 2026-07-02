import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CampaignCard } from "@/components/features/CampaignCard";
import { FREELANCE_PLATFORMS, FREELANCING_SORT_OPTIONS, SEARCH_ENGINES } from "@/lib/mock-data";
import type { Campaign, CampaignMode } from "@/types";
import { Plus, X, Loader2, Copy } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import {
  onDataChange, addCampaign, deleteCampaign, getCampaigns, updateCampaign, addActivity
} from "@/lib/storage";

type CampaignTemplate = {
  title: string;
  url: string;
  dailyLimit: number;
  category: string;
  credits: number;
  mode: CampaignMode;
  searchEngine?: string;
  searchKeywords?: string;
  searchPlatform?: string;
  sellerName?: string;
  gigTitle?: string;
};

// Demo templates for each campaign mode
const DEMO_TEMPLATES: Record<CampaignMode, CampaignTemplate> = {
  direct: {
    title: "Demo: Wikipedia Homepage",
    url: "https://www.wikipedia.org/",
    dailyLimit: 100,
    category: "Reference",
    credits: 1000000,
    mode: "direct",
  },
  search: {
    title: "Demo: Find Best AI Tools",
    url: "https://www.producthunt.com/",
    dailyLimit: 150,
    category: "Technology",
    credits: 1000000,
    mode: "search",
    searchEngine: "Google",
    searchKeywords: "best AI tools 2024",
    searchPlatform: "Fiverr",
    sellerName: "",
    gigTitle: "",
  },
  freelancing: {
    title: "Demo: Find Fiverr Seller",
    url: "https://www.fiverr.com/",
    dailyLimit: 100,
    category: "Freelance",
    credits: 1000000,
    mode: "freelancing",
    searchEngine: "Google",
    searchKeywords: "logo design",
    searchPlatform: "Fiverr",
    sellerName: "LogoMaster99",
    gigTitle: "I will design a professional logo for your business",
  },
};

export default function Campaigns() {
  const { user, updateCredits } = useAuth();
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const loadCampaigns = useCallback(async () => {
    try {
      const campaigns = await getCampaigns();
      setAllCampaigns(campaigns);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    return onDataChange(loadCampaigns);
  }, [loadCampaigns]);

  // Initialize form from template if present
  useEffect(() => {
    const state = location.state as any;
    if (state?.template) {
      setForm({
        title: state.template.title,
        url: state.template.url,
        dailyLimit: state.template.dailyLimit,
        category: state.template.category || "",
        credits: state.template.creditsAllocated || 1000000,
        mode: state.template.mode || "direct",
        searchEngine: state.template.searchEngine || SEARCH_ENGINES[0],
        searchKeywords: state.template.searchKeywords || "",
        searchPlatform: state.template.searchPlatform || FREELANCE_PLATFORMS[0],
        sellerName: state.template.searchTargetName || "",
        gigTitle: state.template.searchGigTitle || "",
      });
      setOpen(true);
    }
  }, [location.state]);

  const campaigns = useMemo(
    () => allCampaigns.filter((c) => c.ownerId === user?.id),
    [allCampaigns, user?.id]
  );
  const [filter, setFilter] = useState<Campaign["status"] | "all">("all");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", url: "", dailyLimit: 100,
    category: "",
    credits: 1000000,
    mode: "direct" as "direct" | "search" | "freelancing",
    searchEngine: SEARCH_ENGINES[0], searchKeywords: "",
    searchPlatform: FREELANCE_PLATFORMS[0],
    sellerName: "",
    gigTitle: "",
  });

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [manageForm, setManageForm] = useState({ title: "", url: "", dailyLimit: 0, creditsToAllocate: 0 });
  const [updating, setUpdating] = useState(false);

  const loadDemoTemplate = (mode: "direct" | "search" | "freelancing") => {
    const template = DEMO_TEMPLATES[mode];
    setForm({
      title: template.title,
      url: template.url,
      dailyLimit: template.dailyLimit,
      category: template.category,
      credits: template.credits,
      mode: template.mode,
      searchEngine: template.searchEngine || SEARCH_ENGINES[0],
      searchKeywords: template.searchKeywords || "",
      searchPlatform: template.searchPlatform || FREELANCE_PLATFORMS[0],
      sellerName: template.sellerName || "",
      gigTitle: template.gigTitle || "",
    });
    toast({ title: "Demo loaded", description: `${mode === 'freelancing' ? 'Freelancing' : mode === 'search' ? 'Search' : 'Direct'} template loaded. Customize as needed!`, variant: "success" });
  };

  const handleManageClick = (c: Campaign) => {
    setSelectedCampaign(c);
    setManageForm({ title: c.title, url: c.url, dailyLimit: c.dailyLimit, creditsToAllocate: 0 });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    if (!/^https?:\/\//i.test(manageForm.url)) {
      toast({ title: "Invalid URL", description: "URL must start with http:// or https://", variant: "default" });
      return;
    }
    if (manageForm.creditsToAllocate > (user?.credits || 0)) {
      toast({ title: "Insufficient credits", description: "You don't have enough credits in your balance.", variant: "error" });
      return;
    }

    setUpdating(true);
    try {
      if (manageForm.creditsToAllocate > 0) {
        await updateCredits(-manageForm.creditsToAllocate);
      }
      await updateCampaign(selectedCampaign.id, {
        title: manageForm.title,
        url: manageForm.url,
        dailyLimit: manageForm.dailyLimit,
        creditsAllocated: selectedCampaign.creditsAllocated + manageForm.creditsToAllocate,
      });

      if (manageForm.creditsToAllocate > 0) {
        await addActivity({
          type: "spend",
          amount: -manageForm.creditsToAllocate,
          description: `Allocated ${manageForm.creditsToAllocate.toLocaleString()} credits to campaign: ${manageForm.title}`,
          campaignId: selectedCampaign.id,
          userId: user?.id
        });
      }

      setSelectedCampaign(null);
      toast({ title: "Campaign updated", description: "Your changes have been saved.", variant: "success" });
    } catch (err: any) {
      toast({ title: "Couldn't update campaign", description: err.message, variant: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);
  const counts = {
    all: campaigns.length,
    active: campaigns.filter((c) => c.status === "active").length,
    paused: campaigns.filter((c) => c.status === "paused").length,
    pending: campaigns.filter((c) => c.status === "pending").length,
  };

  const toggle = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    void updateCampaign(id, { status: c.status === "active" ? "paused" : "active" });
  };
  const remove = async (id: string) => {
    try {
      await deleteCampaign(id);
      toast({ title: "Campaign deleted", description: "Your campaign has been removed.", variant: "default" });
    } catch (err: any) {
      toast({ title: "Couldn't delete campaign", description: err.message || "Please try again.", variant: "error" });
    }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(form.url)) {
      toast({ title: "Invalid URL", description: "URL must start with http:// or https://", variant: "default" });
      return;
    }
    if (form.mode === "search" && (!form.searchKeywords || form.searchKeywords.trim() === "")) {
      toast({ title: "Missing search keywords", description: "Please enter search keywords for search mode.", variant: "default" });
      return;
    }
    if (form.mode === "freelancing" && (!form.searchKeywords || form.searchKeywords.trim() === "" || !form.sellerName || form.sellerName.trim() === "" || !form.gigTitle || form.gigTitle.trim() === "")) {
      toast({ title: "Missing freelancing details", description: "Please enter search keyword, seller name, and gig title for freelancing mode.", variant: "default" });
      return;
    }
    setSubmitting(true);
    try {
      await addCampaign({
        title: form.title,
        url: form.url,
        category: form.category,
        creditsAllocated: form.credits,
        dailyLimit: form.dailyLimit,
        targetCountries: ["US"],
        mode: form.mode,
        searchEngine: form.mode !== "direct" ? form.searchEngine : undefined,
        searchKeywords: form.mode !== "direct" ? form.searchKeywords : undefined,
        searchPlatform: form.mode === "freelancing" ? form.searchPlatform : undefined,
        searchTargetName: form.mode === "freelancing" ? form.sellerName : undefined,
        searchGigTitle: form.mode === "freelancing" ? form.gigTitle : undefined,
      });
      setOpen(false);
      setForm({ title: "", url: "", dailyLimit: 100, category: "", credits: 1000000, mode: "direct", searchEngine: SEARCH_ENGINES[0], searchKeywords: "", searchPlatform: FREELANCE_PLATFORMS[0], sellerName: "", gigTitle: "" });
      toast({ title: "Campaign live", description: "Your URL is now in the surf rotation.", variant: "success" });
    } catch (err: any) {
      toast({ title: "Couldn't create campaign", description: err.message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Campaigns" subtitle="Manage all your traffic campaigns in one place.">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Campaigns" subtitle="Manage all your traffic campaigns in one place.">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ["all", "All"], ["active", "Active"], ["paused", "Paused"], ["pending", "Pending"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k as Campaign["status"] | "all")}
              className={`h-9 px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filter === k ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}
            >
              {l} <Badge variant="muted" className="ml-0.5">{counts[k as keyof typeof counts]}</Badge>
            </button>
          ))}
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New campaign</Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 mx-auto flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold">{campaigns.length === 0 ? "No campaigns yet" : "No campaigns match this filter"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {campaigns.length === 0
              ? "Submit any website URL — popups bypass iframe restrictions so any site works."
              : "Try a different filter or create a new campaign."}
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>Create campaign</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} onToggle={toggle} onDelete={remove} onManage={handleManageClick} />
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Create new campaign</h3>
                <p className="text-xs text-muted-foreground">Submit any URL — popup engine works with iframe-blocked sites too.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={submitting}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={create} className="p-5 space-y-4 overflow-y-auto max-h-[74vh]">
              <div className="space-y-1.5">
                <Label htmlFor="title">Campaign title</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="My Website" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">Website URL</Label>
                <Input id="url" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://wikipedia.org" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="daily">Daily limit</Label>
                <Input id="daily" type="number" min={10} max={5000} value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Campaign mode</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mode: "direct" })}
                    className={`flex-1 h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      form.mode === "direct" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                    }`}
                  >
                    Direct Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mode: "search" })}
                    className={`flex-1 h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      form.mode === "search" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                    }`}
                  >
                    Search Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mode: "freelancing" })}
                    className={`flex-1 h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      form.mode === "freelancing" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                    }`}
                  >
                    Freelancing
                  </button>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => loadDemoTemplate(form.mode)}
                    className="w-full h-10 px-3 rounded-lg border border-dashed border-muted-foreground bg-muted/40 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Load {form.mode === 'freelancing' ? 'Freelancing' : form.mode === 'search' ? 'Search' : 'Direct'} Demo Template
                  </button>
                </div>
              </div>
              {form.mode === "search" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="searchEngine">Search engine</Label>
                    <select 
                      id="searchEngine" 
                      value={form.searchEngine} 
                      onChange={(e) => setForm({ ...form, searchEngine: e.target.value })} 
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {SEARCH_ENGINES.map((e) => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="searchKeywords">Search keywords</Label>
                    <Input 
                      id="searchKeywords" 
                      value={form.searchKeywords} 
                      onChange={(e) => setForm({ ...form, searchKeywords: e.target.value })} 
                      placeholder="e.g., best productivity tools" 
                      required
                    />
                  </div>
                </>
              )}
              {form.mode === "freelancing" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="searchKeywords">Search keyword</Label>
                    <Input
                      id="searchKeywords"
                      value={form.searchKeywords}
                      onChange={(e) => setForm({ ...form, searchKeywords: e.target.value })}
                      placeholder="e.g., substack promotion, logo design"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sellerName">Seller name</Label>
                    <Input
                      id="sellerName"
                      value={form.sellerName}
                      onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                      placeholder="e.g., Sylvanoley, JohnDoeDesigns"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gigTitle">Gig title</Label>
                    <Input
                      id="gigTitle"
                      value={form.gigTitle}
                      onChange={(e) => setForm({ ...form, gigTitle: e.target.value })}
                      placeholder="e.g., I will do substack promotion substack setup"
                      required
                    />
                  </div>
                </>
              )}
              {/* Country targeting, category and credits allocation removed per request */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setOpen(false)} className="flex-1" disabled={submitting}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit campaign"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedCampaign(null)}>
          <Card className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Manage Campaign: {selectedCampaign.title}</h3>
                <p className="text-xs text-muted-foreground">Modify settings or refill credits for this campaign.</p>
              </div>
              <button onClick={() => setSelectedCampaign(null)} disabled={updating}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleUpdate} className="p-5 space-y-4 overflow-y-auto max-h-[74vh]">
              <div className="space-y-1.5">
                <Label htmlFor="manage-title">Campaign title</Label>
                <Input id="manage-title" value={manageForm.title} onChange={(e) => setManageForm({ ...manageForm, title: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-url">Website URL</Label>
                <Input id="manage-url" type="url" value={manageForm.url} onChange={(e) => setManageForm({ ...manageForm, url: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Category removed */}
                <div className="space-y-1.5">
                  <Label htmlFor="manage-daily">Daily limit</Label>
                  <Input id="manage-daily" type="number" min={10} max={5000} value={manageForm.dailyLimit} onChange={(e) => setManageForm({ ...manageForm, dailyLimit: +e.target.value })} />
                </div>
              </div>

              {/* Credits allocation/ refill removed */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setSelectedCampaign(null)} className="flex-1" disabled={updating}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={updating}>
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
