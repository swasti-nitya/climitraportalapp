import { useMemo, useState } from "react";
import { useExpensesList, useUpdateExpenseStatus } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { Loader2, IndianRupee, Building2, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default function CAExpensesPage() {
  const { data: expenses, isLoading, error } = useExpensesList();
  const { mutate: updateExpenseStatus, isPending } = useUpdateExpenseStatus();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"monthly" | "operational">("monthly");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<"all" | "this-month" | "last-30" | "last-90" | "this-year">("all");
  const [selectedStatus, setSelectedStatus] = useState<"paid" | "not-paid">("not-paid");

  const userOptions = useMemo(() => {
    const unique = new Map<number, string>();
    (expenses || []).forEach((expense) => {
      if (expense.user?.id && expense.user?.name) {
        unique.set(expense.user.id, expense.user.name);
      }
    });

    return Array.from(unique.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfThisYear = new Date(now.getFullYear(), 0, 1);
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);
    const last90Days = new Date(now);
    last90Days.setDate(now.getDate() - 90);

    return (expenses || [])
      .filter((expense) => {
        const isOperational = expense.category.startsWith("Operational");
        const matchesPayoutBucket = activeTab === "operational" ? isOperational : !isOperational;
        const matchesUser = selectedUserId === "all" || String(expense.user?.id) === selectedUserId;
        const matchesStatus = selectedStatus === "paid" ? expense.status === "Paid" : expense.status === "Approved";
        const expenseDate = new Date(expense.date);
        const matchesTime =
          selectedTimeRange === "all"
            ? true
            : selectedTimeRange === "this-month"
              ? expenseDate >= startOfThisMonth
              : selectedTimeRange === "last-30"
                ? expenseDate >= last30Days
                : selectedTimeRange === "last-90"
                  ? expenseDate >= last90Days
                  : expenseDate >= startOfThisYear;

          return matchesPayoutBucket && matchesUser && matchesStatus && matchesTime;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }, [expenses, activeTab, selectedUserId, selectedTimeRange, selectedStatus]);

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const handleMarkPaid = (expenseId: number) => {
    updateExpenseStatus(
      { id: expenseId, status: "Paid" },
      {
        onSuccess: () => {
          toast({
            title: "Marked as paid",
            description: "Expense payout status updated successfully.",
          });
        },
        onError: (err) => {
          toast({
            title: "Failed to update",
            description: err.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Loading payout expenses...</p>
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

  return (
    <div className="pb-8">
      <div className="bg-gradient-to-br from-primary to-emerald-500 rounded-3xl p-6 text-white mb-6 shadow-lg shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <p className="text-emerald-50 font-medium mb-1 relative z-10">
          {activeTab === "operational" ? "Operational Payouts" : "Monthly Payouts"}
        </p>
        <h2 className="text-4xl font-bold font-display relative z-10">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
      </div>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-3 mb-6 border-b border-border/40 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === "monthly" ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Monthly Expenses
          </button>
          <button
            onClick={() => setActiveTab("operational")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === "operational" ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Operational
          </button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="text-sm font-semibold text-foreground">
            {activeTab === "operational" ? "Operational payouts are processed every 10 days." : "Monthly expenses are processed in the regular monthly payout cycle."}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Filters</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ca-user-filter" className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                User
              </label>
              <select
                id="ca-user-filter"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              >
                <option value="all">All Users</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ca-time-filter" className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Time
              </label>
              <select
                id="ca-time-filter"
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value as "all" | "this-month" | "last-30" | "last-90" | "this-year")}
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              >
                <option value="all">All Time</option>
                <option value="this-month">This Month</option>
                <option value="last-30">Last 30 Days</option>
                <option value="last-90">Last 90 Days</option>
                <option value="this-year">This Year</option>
              </select>
            </div>

            <div>
              <label htmlFor="ca-status-filter" className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </label>
              <select
                id="ca-status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as "paid" | "not-paid")}
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              >
                <option value="paid">Paid</option>
                <option value="not-paid">Not Paid</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-border/60 rounded-3xl bg-white">
            <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <IndianRupee className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No expenses found</h3>
            <p className="text-muted-foreground text-sm">No approved or paid expenses in this payout bucket.</p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="bg-card rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-2xl font-bold text-foreground font-display">
                      ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <StatusBadge status={expense.status} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{expense.paidTo}</h3>
                  <p className="text-sm text-muted-foreground">{expense.category}</p>
                </div>
                <p className="text-sm font-medium text-foreground/80 whitespace-nowrap">
                  {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="rounded-xl bg-secondary/40 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Employee</p>
                  <p className="text-foreground font-medium flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />{expense.user?.name || 'Unknown'}</p>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cycle</p>
                  <p className="text-foreground font-medium flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />{activeTab === 'operational' ? '10-day payout' : 'Monthly payout'}</p>
                </div>
              </div>

              <p className="text-sm text-foreground/80 mb-4">{expense.description}</p>

              {expense.status === 'Approved' && (
                <button
                  onClick={() => handleMarkPaid(expense.id)}
                  disabled={isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60"
                >
                  Mark as Paid
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
