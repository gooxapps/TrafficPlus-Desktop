import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { signInOrSignUp } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { Zap, User, Mail, Phone, ArrowRight, Gift, Loader2 } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";
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
        refCode,
      });
      toast({ title: "Welcome to TrafficPlus!", description: "You earned 250 starter credits.", variant: "success" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message ?? "Try again.", variant: "error" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-6 order-2 lg:order-1">
        <Card className="w-full max-w-md p-8">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center"><Zap className="w-4 h-4 text-primary-foreground" /></div>
            <span className="font-bold">TrafficPlus</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground mt-1">Start with 250 free credits — no card required.</p>

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
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Carter" className="pl-10" required disabled={loading} />
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            By signing up you agree to our Terms and Privacy Policy.
          </p>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </Card>
      </div>
      <div className="hidden lg:flex flex-col flex-1 gradient-hero relative overflow-hidden p-12 border-l border-border order-1 lg:order-2">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center"><Zap className="w-5 h-5 text-primary-foreground" /></div>
          <span className="font-bold text-lg">TrafficPlus</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <Card className="p-6 backdrop-blur bg-card/70">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center"><Gift className="w-6 h-6 text-accent-foreground" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Welcome bonus</p>
                <p className="font-bold text-2xl">250 credits</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary">●</span> Surf up to 4 sites at once</li>
              <li className="flex gap-2"><span className="text-primary">●</span> Submit unlimited campaigns</li>
              <li className="flex gap-2"><span className="text-primary">●</span> 2-tier referral commissions</li>
              <li className="flex gap-2"><span className="text-primary">●</span> Real-time analytics dashboard</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
