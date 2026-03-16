import { useUser } from "@/hooks/use-auth";
import { useExpensesList } from "@/hooks/use-expenses";
import { ExpenseCard } from "@/components/ExpenseCard";
import { Loader2, Receipt, Filter, User as UserIcon, Calendar, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { api, buildUrl } from "@shared/routes";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export default function Dashboard() {
  const { data: user } = useUser();
  const { data: expenses, isLoading, error } = useExpensesList();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<'expenses' | 'stats'>('expenses');
  const [expenseTypeTab, setExpenseTypeTab] = useState<'non-operational' | 'operational'>('non-operational');
  const [reviewFilter, setReviewFilter] = useState<'All' | 'Flagged'>('All');
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  useEffect(() => {
    const container = document.querySelector("main");
    if (!container) return;

    const onScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
    };

    container.addEventListener("scroll", onScroll);
    onScroll();

    return () => container.removeEventListener("scroll", onScroll);
  }, []);
  
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
    const isOperational = e.category.startsWith('Operational');
    const matchesType = isAdmin
      ? (expenseTypeTab === 'operational' ? isOperational : !isOperational)
      : true;
    const matchesReview = isAdmin && adminSubTab === 'expenses'
      ? (reviewFilter === 'Flagged' ? e.isFlagged : true)
      : true;
    const matchesStatus = isAdmin && adminSubTab === 'stats'
      ? true
      : statusFilter === 'All' || e.status === statusFilter;
    const matchesUser = isAdmin && adminSubTab === 'stats'
      ? true
      : userFilter === 'All' || e.user?.name === userFilter;
    
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
    
    return matchesType && matchesReview && matchesStatus && matchesUser && matchesDateRange;
  }).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

  const handleApproveAllNormal = async () => {
    if (!isAdmin) return;

    const pendingNormal = (filteredExpenses || []).filter(
      (e) => !e.isFlagged && e.status === 'Pending'
    );

    if (pendingNormal.length === 0) {
      toast({
        title: 'Nothing to approve',
        description: 'No pending non-flagged expenses in the current filters.',
      });
      return;
    }

    setIsBulkApproving(true);
    try {
      await Promise.all(
        pendingNormal.map(async (expense) => {
          const url = buildUrl(api.expenses.updateStatus.path, { id: expense.id });
          const res = await fetch(url, {
            method: api.expenses.updateStatus.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Approved' }),
            credentials: 'include',
          });

          if (!res.ok) {
            throw new Error(`Failed on expense #${expense.id}`);
          }
        })
      );

      await queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      toast({
        title: 'Bulk approval complete',
        description: `${pendingNormal.length} expense(s) approved.`,
      });
    } catch (err: any) {
      toast({
        title: 'Bulk approval failed',
        description: err?.message || 'Some expenses could not be approved.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkApproving(false);
    }
  };

  const totalAmount = filteredExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

  const categorySpendData = Object.entries(
    (filteredExpenses || []).reduce<Record<string, number>>((acc, expense) => {
      const bucket = expenseTypeTab === 'operational'
        ? (() => {
            if (!expense.category.startsWith('Operational')) return expense.category;
            const sub = expense.category.replace(/^Operational\s*-\s*/i, '').trim();
            return sub && sub.toLowerCase() !== 'operational' ? sub : 'General';
          })()
        : expense.category.split(' - ')[0].trim();

      acc[bucket] = (acc[bucket] || 0) + Number(expense.amount || 0);
      return acc;
    }, {})
  )
    .map(([category, amount]) => ({
      category,
      shortCategory: category.length > 16 ? `${category.slice(0, 16)}…` : category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const userSpendData = Object.entries(
    (filteredExpenses || []).reduce<Record<string, number>>((acc, expense) => {
      const name = expense.user?.name || 'Unknown';
      acc[name] = (acc[name] || 0) + Number(expense.amount || 0);
      return acc;
    }, {})
  )
    .map(([userName, amount]) => ({
      userName,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const pieColors = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1'];

  const maxCategoryAmount = Math.max(...categorySpendData.map((item) => item.amount), 0);
  const categoryAxis = (() => {
    if (maxCategoryAmount <= 0) {
      return { max: 1000, ticks: [0, 250, 500, 750, 1000] };
    }

    const paddedMax = maxCategoryAmount * 1.1;
    const roughStep = paddedMax / 4;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / magnitude;

    let niceStep = 1;
    if (normalized <= 1) niceStep = 1;
    else if (normalized <= 2) niceStep = 2;
    else if (normalized <= 2.5) niceStep = 2.5;
    else if (normalized <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;
    const max = step * 4;

    return {
      max,
      ticks: [0, step, step * 2, step * 3, max],
    };
  })();

  const expenseOwnerLabel = isAdmin ? 'Company' : 'My';
  const typeLabel = isAdmin
    ? (expenseTypeTab === 'operational' ? 'Operational' : 'Non-Operational')
    : '';
  const reviewLabel = isAdmin && adminSubTab === 'expenses'
    ? (reviewFilter === 'Flagged' ? 'Flagged ' : '')
    : '';
  const baseLabel = isAdmin ? `${typeLabel} ${reviewLabel}Expenses` : 'Expenses';
  const expenseHeading =
    isAdmin && adminSubTab === 'stats'
      ? `${expenseOwnerLabel} Total ${typeLabel} Spend`
      : statusFilter === 'All'
      ? `${expenseOwnerLabel} Total ${baseLabel}`
      : `${expenseOwnerLabel} Total ${statusFilter} ${baseLabel}`;

  const handleScrollTop = () => {
    const container = document.querySelector("main");
    container?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pb-8">
      {/* Overview Card */}
      <div className="bg-gradient-to-br from-primary to-emerald-500 rounded-3xl p-6 text-white mb-6 shadow-lg shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <p className="text-emerald-50 font-medium mb-1 relative z-10">
          {expenseHeading}
        </p>
        <h2 className="text-4xl font-bold font-display relative z-10">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAdminSubTab('expenses')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              adminSubTab === 'expenses' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setAdminSubTab('stats')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              adminSubTab === 'stats' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Stats
          </button>
        </div>
      )}

      {isAdmin && adminSubTab === 'stats' && (
        <div className="space-y-4 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {expenseTypeTab === 'operational' ? 'Spend by Operational Subcategory' : 'Spend by Category'}
            </h3>
            {categorySpendData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No data for current filters</p>
            ) : (
              <ChartContainer
                className="h-[340px] w-full !aspect-auto"
                config={{ amount: { label: 'Amount', color: '#10b981' } }}
              >
                <BarChart data={categorySpendData} margin={{ left: 0, right: 10, top: 10, bottom: 44 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="shortCategory"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`}
                    width={80}
                    domain={[0, categoryAxis.max]}
                    ticks={categoryAxis.ticks}
                  />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => [`₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Amount']} />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
            <h3 className="text-sm font-semibold text-foreground mb-3">Spend by User</h3>
            {userSpendData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No data for current filters</p>
            ) : (
              <>
                <ChartContainer
                  className="h-[320px] w-full !aspect-auto"
                  config={{ amount: { label: 'Amount', color: '#10b981' } }}
                >
                  <PieChart>
                    <Pie
                      data={userSpendData}
                      dataKey="amount"
                      nameKey="userName"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={52}
                      paddingAngle={userSpendData.length > 1 ? 2 : 0}
                    >
                      {userSpendData.map((entry, index) => (
                        <Cell key={entry.userName} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => [`₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, String(name)]} />} />
                  </PieChart>
                </ChartContainer>
                <div className="mt-3 space-y-1.5">
                  {userSpendData.map((item, index) => (
                    <div key={item.userName} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-[3px]"
                          style={{ backgroundColor: pieColors[index % pieColors.length] }}
                        />
                        <span className="text-muted-foreground truncate">{item.userName}</span>
                      </div>
                      <span className="font-medium text-foreground">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-3 mb-6 border-b border-border/40 space-y-4">
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setExpenseTypeTab('non-operational')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                expenseTypeTab === 'non-operational'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Non-Operational
            </button>
            <button
              onClick={() => setExpenseTypeTab('operational')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                expenseTypeTab === 'operational'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Operational
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h3 className="text-lg font-bold font-display text-foreground">
              {isAdmin
                ? adminSubTab === 'stats'
                  ? `${expenseTypeTab === 'operational' ? 'Operational' : 'Non-Operational'} Spend Stats`
                  : `${expenseTypeTab === 'operational' ? 'Operational' : 'Non-Operational'} ${reviewFilter === 'Flagged' ? 'Flagged ' : ''}Expenses`
                : 'Recent Activity'}
            </h3>

            {isAdmin && adminSubTab === 'expenses' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewFilter('All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    reviewFilter === 'All'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setReviewFilter('Flagged')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    reviewFilter === 'Flagged'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Flagged
                </button>
              </div>
            )}
          </div>

          {isAdmin && adminSubTab === 'expenses' && reviewFilter === 'All' && (
            <button
              onClick={handleApproveAllNormal}
              disabled={isBulkApproving}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
            >
              {isBulkApproving ? 'Approving...' : 'Approve All'}
            </button>
          )}

          {isAdmin && adminSubTab === 'expenses' && reviewFilter === 'Flagged' && (filteredExpenses?.filter(e => e.status === 'Pending').length ?? 0) > 0 && (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors"
            >
              ⚠️ {filteredExpenses!.filter(e => e.status === 'Pending').length} flagged
            </button>
          )}
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
        
        {(!isAdmin || adminSubTab === 'expenses') && (
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
                <option value="Paid">Paid</option>
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
        )}
      </div>

      {/* Expenses List */}
      {(!isAdmin || adminSubTab === 'expenses') && (
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
              <ExpenseCard key={expense.id} expense={expense as any} isAdmin={isAdmin} />
            ))
          )}
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={handleScrollTop}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-xl shadow-primary/50 hover:bg-primary/90 hover:scale-110 transition-all flex items-center justify-center"
          title="Back to top"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
