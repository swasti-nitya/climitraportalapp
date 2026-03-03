import { Link, useLocation } from "wouter";
import { Home, PlusCircle, LogOut } from "lucide-react";
import { useUser, useLogout } from "@/hooks/use-auth";

export function MobileLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();

  return (
    <div className="min-h-screen bg-background flex justify-center">
      {/* Mobile constraint wrapper for desktop viewing */}
      <div className="w-full max-w-md bg-background flex flex-col relative md:border-x border-border/50">
        
        {/* Header */}
        <header className="glass-card sticky top-0 z-40 px-6 py-4 flex justify-between items-center rounded-b-[2rem] flex-shrink-0">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Hello,</p>
            <h1 className="text-xl font-bold font-display text-foreground">{user?.name}</h1>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold hover:bg-primary/20 transition-colors cursor-pointer"
          >
            {user?.name.charAt(0)}
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="glass-card fixed md:absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md pb-safe rounded-t-[2rem] px-6 py-4 flex justify-between items-center z-50">
          <Link href="/expenses" className="flex-1">
            <div className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${location === '/expenses' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Home className="w-6 h-6" />
              <span className="text-[10px] font-medium">Home</span>
            </div>
          </Link>
          
          <div className="flex-1 flex justify-center relative -top-6">
            <Link href="/expenses/add">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-primary/30 cursor-pointer hover:scale-105 active:scale-95 transition-transform">
                <PlusCircle className="w-7 h-7" />
              </div>
            </Link>
          </div>

          <div className="flex-1 flex justify-end">
            <button 
              onClick={() => logout()}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-rose-500 transition-colors"
            >
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-medium">Logout</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
