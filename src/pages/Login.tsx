import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { signInOrSignUp } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { Zap, Mail, Phone, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || (contactType === "email" && !email) || (contactType === "phone" && !phone)) return;
    setLoading(true);
    try {
      await signInOrSignUp({
        name,
        email: contactType === "email" ? email : undefined,
        phone: contactType === "phone" ? phone : undefined,
      });
      toast({ title: "Welcome back!", description: "You're signed in.", variant: "success" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Sign-in failed", description: err.message ?? "Try again.", variant: "error" });
      setLoading(false);
    }
  };

  const guestLogin = async () => {
    setLoading(true);
    try {
      await signInOrSignUp({ name: `Guest ${Math.floor(Math.random() * 9000) + 1000}` });
      toast({ title: 'Guest access', description: 'Signed in as guest', variant: 'default' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Guest login failed', description: err.message ?? 'Try again.', variant: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col flex-1 gradient-hero relative overflow-hidden p-12 border-r border-border">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center"><Zap className="w-5 h-5 text-primary-foreground" /></div>
          <span className="font-bold text-lg">TrafficPlus</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-bold tracking-tight">Welcome back to your traffic command center.</h2>
          <p className="text-muted-foreground mt-3">
            Pick up where you left off — surf, send visitors, and grow your campaigns.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["A","M","J","P"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-xs font-bold border-2 border-background text-accent-foreground">{c}</div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">50,000+ marketers using TrafficPlus</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center"><Zap className="w-4 h-4 text-primary-foreground" /></div>
            <span className="font-bold">TrafficPlus</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back. Let's get you back to earning.</p>

          <div className="flex gap-2 mb-6 mt-6">
            <Button 
              variant={contactType === "email" ? "default" : "outline"} 
              type="button" 
              className="flex-1" 
              onClick={() => setContactType("email")}
            >
              Email
            </Button>
            <Button 
              variant={contactType === "phone" ? "default" : "outline"} 
              type="button" 
              className="flex-1" 
              onClick={() => setContactType("phone")}
            >
              Phone
            </Button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <div className="relative">
                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Carter"
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">{contactType === "email" ? "Email" : "Phone number"}</Label>
              <div className="relative">
                {contactType === "email" ? (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                ) : (
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                )}
                <Input
                  id="contact"
                  type={contactType === "email" ? "email" : "tel"}
                  value={contactType === "email" ? email : phone}
                  onChange={(e) => contactType === "email" ? setEmail(e.target.value) : setPhone(e.target.value)}
                  placeholder={contactType === "email" ? "you@company.com" : "+1 234 567 8900"}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            New to TrafficPlus?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
          </p>
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={guestLogin} disabled={loading}>Continue as Guest</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
