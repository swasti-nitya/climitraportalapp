import { useUser } from "@/hooks/use-auth";
import { useExpensesList } from "@/hooks/use-expenses";
import { ExpenseCard } from "@/components/ExpenseCard";
import { Loader2, Receipt, Filter, User as UserIcon, Calendar } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { data: user } = useUser();
  const { data: expenses, isLoading, error } = useExpensesList();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const isAdmin = user?.role === 'Super Admin';

  const uniqueUsers = Array.from(new Set(expenses?.map(e => e.user?.name).filter(Boolean))) as string[];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Loading expenses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 text-rose-600 rounded-2xl text-center">
        Failed to load expenses. Please try again.
      </div>
    );
  }

  const filteredExpenses = expenses?.filter(e => {
    const matchesStatus = statusFilter === 'All' || e.status === statusFilter;
    const matchesUser = userFilter === 'All' || e.user?.name === userFilter;
    
    let matchesDateRange = true;
    if (startDate || endDate) {
      const expenseDate = new Date(e.date).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        matchesDateRange = matchesDateRange && expenseDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        matchesDateRange = matchesDateRange && expenseDate <= end;
      }
    }
    
    return matchesStatus && matchesUser && matchesDateRange;
  }).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

  const totalAmount = filteredExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

  return (
    <div className="pb-8">
      {/* Overview Card */}
      <div className="bg-gradient-to-br from-primary to-emerald-500 rounded-3xl p-6 text-white mb-6 shadow-lg shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <p className="text-emerald-50 font-medium mb-1 relative z-10">
          {isAdmin ? "Total Company Expenses" : "My Total Expenses"}
        </p>
        <h2 className="text-4xl font-bold font-display relative z-10">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-display text-foreground">Recent Activity</h3>
        </div>
        
        {/* Date Range Filter */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 text-foreground text-xs font-semibold rounded-full border-none focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-secondary/50 text-foreground text-xs font-semibold rounded-full border-none focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          {(startDate || endDate) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-2 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-full transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none bg-secondary/50 text-foreground text-xs font-semibold pl-3 pr-8 py-2 rounded-full border-none focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <Filter className="w-3 h-3 text-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {isAdmin && (
            <div className="relative flex-1 min-w-[140px]">
              <select 
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full appearance-none bg-secondary/50 text-foreground text-xs font-semibold pl-3 pr-8 py-2 rounded-full border-none focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="All">All Users</option>
                {uniqueUsers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <UserIcon className="w-3 h-3 text-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-4">
        {filteredExpenses?.length === 0 ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-border/60 rounded-3xl">
            <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No expenses found</h3>
            <p className="text-muted-foreground text-sm">
              {statusFilter !== 'All' ? `You don't have any ${statusFilter.toLowerCase()} expenses.` : "Start by adding a new expense."}
            </p>
          </div>
        ) : (
          filteredExpenses?.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} isAdmin={isAdmin} />
          ))
        )}
      </div>
    </div>
  );
}
