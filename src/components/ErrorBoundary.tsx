import React, { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-2 text-sm">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Error has been logged. Please try again or refresh the page.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh
              </Button>
              <Button onClick={this.reset}>Go Home</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
