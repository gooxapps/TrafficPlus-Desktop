import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useStoredAsync } from '@/hooks/useStoredAsync';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { getActivities, getCampaigns, updateCampaign } from '@/lib/storage';
import { StatCard } from '@/components/features/StatCard';
import { Users, Megaphone, ShieldAlert, DollarSign, Check, X, Inbox, Settings, Globe, Activity } from 'lucide-react';
import { toast } from '@/hooks/useToast';

export default function Admin() {
  const { user, upgrade } = useAuth();
  const campaigns = useStoredAsync(getCampaigns, []);
  const activities = useStoredAsync(getActivities, []);
  const { settings, updateSettings } = useSiteSettings();
  const [activeTab, setActiveTab] = useState('overview');
  const [formData, setFormData] = useState(() => ({ ...settings }));

  if (user?.role !== 'admin') {
    return (
      <DashboardLayout title="Admin Panel">
        <Card className="p-8 text-center max-w-md mx-auto">
          <ShieldAlert className="w-10 h-10 text-accent mx-auto mb-3" />
          <h3 className="font-semibold">Admin access only</h3>
          <p className="text-sm text-muted-foreground mt-2">This area is restricted. Switch to admin role to preview.</p>
          <Button className="mt-4" onClick={() => void upgrade('admin')}>Switch to admin (demo)</Button>
        </Card>
      </DashboardLayout>
    );
  }

  const pending = campaigns.filter((c) => c.status === 'pending');
  const active = campaigns.filter((c) => c.status === 'active');
  const totalVisits = campaigns.reduce((s, c) => s + c.visitsReceived, 0);
  const totalEarned = activities.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);

  const approve = (id: string) => {
    void updateCampaign(id, { status: 'active' });
    toast({ title: 'Campaign approved', variant: 'success' });
  };
  const reject = (id: string) => {
    void updateCampaign(id, { status: 'rejected' });
    toast({ title: 'Campaign rejected', variant: 'default' });
  };

  const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'muted' =>
    s === 'active' ? 'success' : s === 'pending' ? 'warning' : s === 'rejected' ? 'danger' : 'muted';

  const handleSettingChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFeatureChange = (index: number, field: string, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const saveSettings = async () => {
    await updateSettings(formData);
    toast({ title: 'Settings saved', variant: 'success' });
  };

  return (
    <DashboardLayout title="Admin Panel" subtitle="Platform-wide management and monitoring.">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="site-settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Site Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total campaigns" value={campaigns.length} icon={Users} accent="primary" />
            <StatCard label="Active campaigns" value={active.length} icon={Megaphone} accent="accent" />
            <StatCard label="Total visits" value={totalVisits} icon={DollarSign} accent="info" />
            <StatCard label="Credits issued" value={totalEarned} icon={ShieldAlert} accent="primary" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Campaign moderation</CardTitle>
                <CardDescription>{campaigns.length} total campaign(s) submitted</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {campaigns.length === 0 ? (
                  <div className="py-12 text-center">
                    <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium">No campaigns yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Submitted campaigns appear here for moderation.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground border-b border-border">
                        <tr><th className="py-3">Campaign</th><th>Status</th><th>Visits</th><th>Submitted</th><th></th></tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {campaigns.map((c) => (
                          <tr key={c.id}>
                            <td className="py-3">
                              <p className="font-medium truncate max-w-[200px]">{c.title}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.url}</p>
                            </td>
                            <td><Badge variant={statusVariant(c.status)}>{c.status}</Badge></td>
                            <td className="font-medium">{c.visitsReceived}</td>
                            <td className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td>
                              {c.status === 'pending' || c.status === 'paused' || c.status === 'rejected' ? (
                                <Button size="sm" variant="ghost" onClick={() => approve(c.id)}>Activate</Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => reject(c.id)}>Reject</Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending approval</CardTitle>
                <CardDescription>{pending.length} campaign(s) awaiting review</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {pending.length === 0 && <p className="text-sm text-muted-foreground">All clear. No pending campaigns.</p>}
                {pending.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border border-border">
                    <p className="font-medium text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.url}</p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="primary" className="flex-1" onClick={() => approve(c.id)}>
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => reject(c.id)}>
                        <X className="w-3 h-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity log</CardTitle>
              <CardDescription>Most recent events across the platform</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No activity yet. As users surf and run campaigns, events will appear here.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {activities.slice(0, 10).map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium">{a.description}</p>
                        <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
                      </div>
                      <span className={`font-bold ${a.amount > 0 ? 'text-primary' : 'text-accent'}`}>
                        {a.amount > 0 ? '+' : ''}{a.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="site-settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" /> Site Content
              </CardTitle>
              <CardDescription>Edit all the text, copy, and content on your site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Basic Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name</Label>
                    <Input
                      id="siteName"
                      value={formData.siteName}
                      onChange={(e) => handleSettingChange('siteName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siteLogo">Site Logo URL</Label>
                    <Input
                      id="siteLogo"
                      value={formData.siteLogo || ''}
                      onChange={(e) => handleSettingChange('siteLogo', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteDescription">Site Description</Label>
                  <Textarea
                    id="siteDescription"
                    value={formData.siteDescription}
                    onChange={(e) => handleSettingChange('siteDescription', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Authentication</h4>
                <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-background">
                  <div>
                    <p className="font-medium">Require login</p>
                    <p className="text-sm text-muted-foreground">When turned off, the main app opens directly without requiring sign in.</p>
                  </div>
                  <Switch
                    checked={formData.authRequired ?? false}
                    onCheckedChange={(checked) => handleSettingChange('authRequired', checked)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Hero Section</h4>
                <div className="space-y-2">
                  <Label htmlFor="heroTitle">Hero Title</Label>
                  <Input
                    id="heroTitle"
                    value={formData.heroTitle}
                    onChange={(e) => handleSettingChange('heroTitle', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                  <Textarea
                    id="heroSubtitle"
                    value={formData.heroSubtitle}
                    onChange={(e) => handleSettingChange('heroSubtitle', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="heroButtonText">Primary Button Text</Label>
                    <Input
                      id="heroButtonText"
                      value={formData.heroButtonText}
                      onChange={(e) => handleSettingChange('heroButtonText', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heroSecondaryButtonText">Secondary Button Text</Label>
                    <Input
                      id="heroSecondaryButtonText"
                      value={formData.heroSecondaryButtonText}
                      onChange={(e) => handleSettingChange('heroSecondaryButtonText', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Features</h4>
                {formData.features.map((feature, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Icon (globe, shield, zap, etc.)</Label>
                        <Input
                          value={feature.icon}
                          onChange={(e) => handleFeatureChange(index, 'icon', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={feature.title}
                          onChange={(e) => handleFeatureChange(index, 'title', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      <Label>Description</Label>
                      <Textarea
                        value={feature.description}
                        onChange={(e) => handleFeatureChange(index, 'description', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Footer</h4>
                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Textarea
                    id="footerText"
                    value={formData.footerText}
                    onChange={(e) => handleSettingChange('footerText', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copyrightText">Copyright Notice</Label>
                  <Input
                    id="copyrightText"
                    value={formData.copyrightText}
                    onChange={(e) => handleSettingChange('copyrightText', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Feature flags</h4>
                <p className="text-sm text-muted-foreground">Toggle availability of platform pages for regular users.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">Saved Campaigns</p>
                      <p className="text-sm text-muted-foreground">Allow users to access saved campaign templates.</p>
                    </div>
                    <Switch
                      checked={!!formData.featurePages?.savedCampaigns}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, featurePages: { ...(prev.featurePages || {}), savedCampaigns: !!v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">Credits</p>
                      <p className="text-sm text-muted-foreground">Show the credits purchase and history page.</p>
                    </div>
                    <Switch
                      checked={!!formData.featurePages?.credits}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, featurePages: { ...(prev.featurePages || {}), credits: !!v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">Referrals</p>
                      <p className="text-sm text-muted-foreground">Enable the referrals dashboard for users.</p>
                    </div>
                    <Switch
                      checked={!!formData.featurePages?.referrals}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, featurePages: { ...(prev.featurePages || {}), referrals: !!v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">Contacts</p>
                      <p className="text-sm text-muted-foreground">Allow users to manage contacts.</p>
                    </div>
                    <Switch
                      checked={!!formData.featurePages?.contacts}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, featurePages: { ...(prev.featurePages || {}), contacts: !!v } }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">Premium</p>
                      <p className="text-sm text-muted-foreground">Show subscription and premium features page.</p>
                    </div>
                    <Switch
                      checked={!!formData.featurePages?.premium}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, featurePages: { ...(prev.featurePages || {}), premium: !!v } }))}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={saveSettings} className="w-full md:w-auto">
                Save Site Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
