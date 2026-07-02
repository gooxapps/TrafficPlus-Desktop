import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-6">
      <div className="text-center max-w-md">
        <p className="text-7xl font-black gradient-primary bg-clip-text text-transparent">404</p>
        <h1 className="text-2xl font-bold mt-4">Page not found</h1>
        <p className="text-muted-foreground mt-2">This route doesn't exist on TrafficPlus.</p>
        <Link to="/"><Button className="mt-6"><Home className="w-4 h-4" /> Back home</Button></Link>
      </div>
    </div>
  );
}
