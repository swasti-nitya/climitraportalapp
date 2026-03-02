import { useUser } from "@/hooks/use-auth";
import { useExpensesList } from "@/hooks/use-expenses";
import { ExpenseCard } from "@/components/ExpenseCard";
import { Loader2, Receipt, Filter } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { data: user } = useUser();
  const { data: expenses, isLoading, error } = useExpensesList();
  const [filter, setFilter] = useState<string>('All');
  
  const isAdmin = user?.role === 'Super Admin';

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
    if (filter === 'All') return true;
    return e.status === filter;
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
        <h2 className="text-4xl font-bold font-display relative z-10">${totalAmount.toFixed(2)}</h2>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold font-display text-foreground">Recent Activity</h3>
        <div className="relative">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none bg-secondary/50 text-foreground text-sm font-semibold pl-4 pr-8 py-2 rounded-full border-none focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <Filter className="w-3.5 h-3.5 text-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              {filter !== 'All' ? `You don't have any ${filter.toLowerCase()} expenses.` : "Start by adding a new expense."}
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
