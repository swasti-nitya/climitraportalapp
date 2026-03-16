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
import CAExpensesPage from "./pages/ca-expenses";
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
        {user ? (user.role === 'CA' ? <Redirect to="/ca-expenses" /> : <PortalSelection />) : <Redirect to="/login" />}
      </Route>

      <Route path="/expenses">
        {user?.role === 'CA' ? <Redirect to="/ca-expenses" /> : <ProtectedRoute component={Dashboard} />}
      </Route>
      
      <Route path="/expenses/add">
        {user?.role === 'CA' ? <Redirect to="/ca-expenses" /> : <ProtectedRoute component={AddExpense} />}
      </Route>

      <Route path="/leaves">
        {user?.role === 'CA' ? <Redirect to="/ca-expenses" /> : <ProtectedRoute component={LeavesDashboard} />}
      </Route>

      <Route path="/profile">
        {user?.role === 'CA' ? <Redirect to="/ca-expenses" /> : <ProtectedRoute component={Profile} />}
      </Route>

      <Route path="/ca-expenses">
        {user?.role === 'CA' ? <ProtectedRoute component={CAExpensesPage} /> : <Redirect to="/" />}
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
