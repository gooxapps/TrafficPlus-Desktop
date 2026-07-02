import { useState, useEffect } from "react";
import { useSiteSettings } from '@/hooks/useSiteSettings';
import ComingSoon from '@/components/ui/ComingSoon';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { Bookmark, Plus, Trash2, Globe, Link } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { useNavigate } from "react-router-dom";
import { SEARCH_ENGINES } from "@/lib/mock-data";

interface SavedCampaign {
  id: string;
  userId: string;
  name: string;
  title: string;
  url: string;
  category?: string;
  creditsAllocated?: number;
  dailyLimit?: number;
  targetCountries?: string;
  mode?: "direct" | "search";
  searchEngine?: string;
  searchKeywords?: string;
  createdAt: string;
}

export default function SavedCampaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    url: "",
    dailyLimit: 100,
    mode: "direct" as "direct" | "search",
    searchEngine: SEARCH_ENGINES[0],
    searchKeywords: "",
    category: "",
    creditsAllocated: 100,
    targetCountries: "",
  });

  const electronAPI = (window as any).electronAPI;

  const { settings } = useSiteSettings();

  if (settings.featurePages && settings.featurePages.savedCampaigns === false) {
    return <ComingSoon />;
  }

  const fetchSavedCampaigns = async () => {
    if (!user?.id || !electronAPI) return;
    try {
      const data = await electronAPI.savedCampaignsGet(user.id);
      setSavedCampaigns(data);
    } catch (error) {
      console.error("Failed to fetch saved campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!electronAPI) return;

    try {
      const newCampaign = await electronAPI.savedCampaignsCreate(
        user.id,
        formData.name,
        formData.title,
        formData.url,
        formData.category || undefined,
        formData.creditsAllocated,
        formData.dailyLimit,
        formData.targetCountries ? formData.targetCountries.split(",").map((c) => c.trim()) : undefined,
        formData.mode,
        formData.mode === "search" ? formData.searchEngine : undefined,
        formData.mode === "search" ? formData.searchKeywords : undefined
      );
      setSavedCampaigns((prev) => [newCampaign, ...prev]);
      toast({ title: "Campaign saved", description: "Your campaign template has been saved successfully." });
      setIsAddDialogOpen(false);
      setFormData({ name: "", title: "", url: "", category: "", creditsAllocated: 100, dailyLimit: 100, targetCountries: "", mode: "direct", searchEngine: SEARCH_ENGINES[0], searchKeywords: "" });
    } catch (error) {
      console.error("Failed to save campaign:", error);
      toast({ title: "Error", description: "Failed to save campaign.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!electronAPI) return;
    try {
      await electronAPI.savedCampaignsDelete(id);
      setSavedCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Saved campaign deleted", description: "Your saved campaign has been deleted successfully." });
    } catch (error) {
      console.error("Failed to delete saved campaign:", error);
      toast({ title: "Error", description: "Failed to delete saved campaign.", variant: "destructive" });
    }
  };

  const handleUseTemplate = (campaign: SavedCampaign) => {
    navigate("/campaigns", {
      state: {
        template: {
          title: campaign.title,
          url: campaign.url,
          category: campaign.category,
          creditsAllocated: campaign.creditsAllocated,
          dailyLimit: campaign.dailyLimit,
          targetCountries: campaign.targetCountries ? campaign.targetCountries.split(",").map((c) => c.trim()) : [],
          mode: campaign.mode,
          searchEngine: campaign.searchEngine,
          searchKeywords: campaign.searchKeywords,
        },
      },
    });
  };

  useEffect(() => {
    fetchSavedCampaigns();
  }, [user?.id]);

  return (
    <DashboardLayout title="Saved Campaigns" subtitle="Save and reuse your campaign templates">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your saved campaigns</CardTitle>
              <CardDescription>{savedCampaigns.length} templates</CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Save campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Loading saved campaigns...</p>
            </div>
          ) : savedCampaigns.length === 0 ? (
            <div className="py-12 text-center">
              <Bookmark className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No saved campaigns yet</p>
              <p className="text-xs text-muted-foreground mt-1">Save your favorite campaign templates here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedCampaigns.map((campaign) => (
            <Card key={campaign.id} className="border border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                      <Badge variant="muted" className="flex-shrink-0">{campaign.mode === "search" ? "Search" : "Direct"}</Badge>
                    </div>
                    <CardDescription className="line-clamp-1">{campaign.title}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(campaign.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Globe className="w-3.5 h-3.5" />
                  <span className="truncate">{campaign.url}</span>
                </div>
                {campaign.mode === "search" && (
                  <div className="bg-muted/30 p-2 rounded-md mb-3 text-xs">
                    <p className="text-muted-foreground">Search engine: {campaign.searchEngine}</p>
                    {campaign.searchKeywords && <p className="text-muted-foreground">Keywords: {campaign.searchKeywords}</p>}
                  </div>
                )}
                      <div className="bg-muted/50 p-2 rounded-md mb-4">
                        <p className="text-muted-foreground">Daily limit</p>
                        <p className="font-medium">{campaign.dailyLimit}</p>
                      </div>
                <Button className="w-full" variant="default" onClick={() => handleUseTemplate(campaign)}>
                  Use template
                </Button>
              </CardContent>
            </Card>
          ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Save campaign template</DialogTitle>
              <DialogDescription>Save a campaign template to reuse later.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My campaign template"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Campaign title"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Website URL</label>
                <Input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://wikipedia.org"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Campaign mode</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mode: "direct" })}
                    className={`flex-1 h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      formData.mode === "direct" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                    }`}
                  >
                    Direct Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mode: "search" })}
                    className={`flex-1 h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      formData.mode === "search" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
                    }`}
                  >
                    Search Mode
                  </button>
                </div>
              </div>
              {formData.mode === "search" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="savedSearchEngine">Search engine</Label>
                    <select 
                      id="savedSearchEngine" 
                      value={formData.searchEngine} 
                      onChange={(e) => setFormData({ ...formData, searchEngine: e.target.value })} 
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {SEARCH_ENGINES.map((e) => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="savedSearchKeywords">Search keywords</Label>
                    <Input 
                      id="savedSearchKeywords" 
                      value={formData.searchKeywords} 
                      onChange={(e) => setFormData({ ...formData, searchKeywords: e.target.value })} 
                      placeholder="e.g., best productivity tools" 
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily limit</Label>
                  <Input
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: Number(e.target.value) })}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  {/* Credits/category/targeting removed from saved templates */}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
