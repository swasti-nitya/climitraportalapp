import { useLocation } from "wouter";
import { Wallet, FileText, ArrowRight } from "lucide-react";
import { useUser } from "@/hooks/use-auth";

export default function PortalSelection() {
  const [, setLocation] = useLocation();
  const { data: user } = useUser();

  return (
    <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center p-4 selection:bg-primary/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
            <span className="text-3xl font-bold text-white">C</span>
          </div>
          <h1 className="text-3xl font-bold font-display text-foreground tracking-tight mb-2">
            Climitra Employee Portal
          </h1>
          <p className="text-muted-foreground">Welcome, {user?.name}</p>
        </div>

        <div className="space-y-4">
          {/* Expense Tracker Card */}
          <button
            onClick={() => setLocation('/expenses')}
            className="w-full group relative overflow-hidden bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:border-primary/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative flex items-start justify-between">
              <div className="text-left flex-1">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-emerald-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold font-display text-foreground mb-1">
                  Expense Tracker
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage and track your expense reimbursements
                </p>
              </div>
              <div className="text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </button>

          {/* Leave Tracker Card */}
          <button
            onClick={() => setLocation('/leaves')}
            className="w-full group relative overflow-hidden bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:border-blue-500/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative flex items-start justify-between">
              <div className="text-left flex-1">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold font-display text-foreground mb-1">
                  Leave Tracker
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage your leave requests and work from home
                </p>
              </div>
              <div className="text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Secure access for Climitra employees
        </p>
      </div>
    </div>
  );
}
