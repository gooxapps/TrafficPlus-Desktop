import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { Mail, User as UserIcon, Bell, LogOut, Loader2, Camera, Key, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const electronAPI = (window as any).electronAPI;

export default function Settings() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [email] = useState(user?.email ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [saving, setSaving] = useState(false);
  const [storeRawIps, setStoreRawIps] = useState<boolean>((user as any)?.storeRawIps ?? false);
  const [captcha2ApiKey, setCaptcha2ApiKey] = useState("");
  const [captcha2Configured, setCaptcha2Configured] = useState(false);
  const [savingCaptcha2, setSavingCaptcha2] = useState(false);

  useEffect(() => {
    // Check if 2Captcha is configured
    const checkCaptcha2Config = async () => {
      try {
        const result = await electronAPI.captcha2CaptchaIsConfigured?.();
        if (result?.configured) {
          setCaptcha2Configured(true);
        }
      } catch (e) {
        console.error('Failed to check 2Captcha config:', e);
      }
    };
    checkCaptcha2Config();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile({ name, bio, avatar, storeRawIps });
    setSaving(false);
    toast({ title: "Profile saved", description: "Your changes have been applied.", variant: "success" });
  };

  const saveCaptcha2Key = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha2ApiKey.trim()) {
      toast({ title: "Error", description: "Please enter a 2Captcha API key", variant: "destructive" });
      return;
    }
    
    setSavingCaptcha2(true);
    try {
      const result = await electronAPI.captchaSet2CaptchaKey?.(captcha2ApiKey);
      if (result?.success) {
        setCaptcha2Configured(true);
        setCaptcha2ApiKey("");
        toast({ title: "2Captcha configured", description: "Your API key has been saved.", variant: "success" });
      } else {
        toast({ title: "Error", description: result?.error || "Failed to save API key", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save API key", variant: "destructive" });
    } finally {
      setSavingCaptcha2(false);
    }
  };

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setAvatar(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <DashboardLayout title="Settings" subtitle="Manage your profile, preferences, and security.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full gradient-accent flex items-center justify-center text-2xl font-bold text-accent-foreground">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full cursor-pointer hover:bg-primary/90">
                  <Camera className="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
              <div>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant={user?.role === "premium" ? "accent" : user?.role === "admin" ? "primary" : "muted"}>
                    {user?.role}
                  </Badge>
                  <Badge variant={user?.emailVerified ? "success" : "warning"}>
                    {user?.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
              </div>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} readOnly className="pl-10 opacity-70" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us a little about yourself..."
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="referral">Referral code</Label>
                <Input id="referral" readOnly value={user?.referralCode ?? ""} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-ips">Store raw visitor IPs</Label>
                <div className="flex items-center gap-3">
                  <input id="store-ips" type="checkbox" checked={storeRawIps} onChange={(e) => setStoreRawIps(e.target.checked)} className="w-4 h-4" />
                  <p className="text-xs text-muted-foreground">Enable only if you have consent and lawful basis. Storing raw IPs has privacy implications.</p>
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Campaign updates", true],
                ["Daily bonus reminder", true],
                ["Referral activity", false],
                ["Marketing emails", false],
              ].map(([label, on]) => (
                <label key={label as string} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><Bell className="w-4 h-4 text-muted-foreground" /> {label}</span>
                  <input type="checkbox" defaultChecked={on as boolean} className="w-4 h-4 accent-[hsl(var(--primary))]" />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                2Captcha Setup
              </CardTitle>
              <CardDescription>Solve captchas automatically during surfing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {captcha2Configured ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                  <Check className="w-4 h-4" />
                  <span>2Captcha is configured and active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-md text-sm">
                  <X className="w-4 h-4" />
                  <span>2Captcha not configured</span>
                </div>
              )}
              
              <form onSubmit={saveCaptcha2Key} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="captcha2-key">API Key</Label>
                  <Input
                    id="captcha2-key"
                    type="password"
                    placeholder="Enter your 2Captcha API key"
                    value={captcha2ApiKey}
                    onChange={(e) => setCaptcha2ApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a href="https://2captcha.com/api" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                      2captcha.com/api
                    </a>
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={savingCaptcha2}>
                  {savingCaptcha2 ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save API Key"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button variant="outline" className="w-full text-red-500 hover:text-red-500" onClick={onLogout}>
                <LogOut className="w-4 h-4" /> Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
