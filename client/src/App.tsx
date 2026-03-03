import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Pages & Components
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import PortalSelection from "@/pages/portal-selection";
import Dashboard from "@/pages/dashboard";
import AddExpense from "@/pages/add-expense";
import LeavesDashboard from "@/pages/leaves-dashboard";
import Profile from "@/pages/profile";
import { MobileLayout } from "@/components/MobileLayout";

// Auth Guard Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-primary font-medium">Authenticating...</p>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <MobileLayout>
      <Component />
    </MobileLayout>
  );
}

function Router() {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>
      
      <Route path="/">
        {user ? <PortalSelection /> : <Redirect to="/login" />}
      </Route>

      <Route path="/expenses">
        <ProtectedRoute component={Dashboard} />
      </Route>
      
      <Route path="/expenses/add">
        <ProtectedRoute component={AddExpense} />
      </Route>

      <Route path="/leaves">
        <ProtectedRoute component={LeavesDashboard} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
