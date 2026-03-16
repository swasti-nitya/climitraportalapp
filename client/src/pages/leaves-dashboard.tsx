import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useLeavesList, useLeaveCount, useCreateLeave, useUpdateLeaveStatus } from "@/hooks/use-leaves";
import { useHolidaysList, useCreateHoliday, useDeleteHoliday } from "@/hooks/use-holidays";
import { useUser } from "@/hooks/use-auth";
import { Loader2, Calendar, FileText, Filter, User as UserIcon, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight, Trash2, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import type { LeaveWithUser } from "@shared/schema";

export default function LeavesDashboard() {
  const { data: user } = useUser();
  const { data: leaves, isLoading, refetch } = useLeavesList();
  const { data: holidays, refetch: refetchHolidays } = useHolidaysList();
  const { data: leaveCount } = useLeaveCount(user?.id || 0);
  const { mutateAsync: createLeave } = useCreateLeave();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'my-leaves' | 'approve-leaves' | 'holidays'>('my-leaves');
  const [adminLeaveView, setAdminLeaveView] = useState<'planned-approvals' | 'auto-approved'>('planned-approvals');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [leaveRequestType, setLeaveRequestType] = useState<'Planned Leave' | 'Sick Leave' | 'Work From Home'>('Planned Leave');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLeaveHistory, setShowLeaveHistory] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  const isAdmin = user?.role === 'Super Admin';
  const uniqueUsers = leaves ? Array.from(new Set(leaves.map(l => l.user?.name).filter(Boolean))) as string[] : [];

  useEffect(() => {
    const container = document.querySelector("main");
    const onScroll = () => {
      const containerScrollTop = container ? container.scrollTop : 0;
      const windowScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      setShowScrollTop(Math.max(containerScrollTop, windowScrollTop) > 300);
    };

    container?.addEventListener("scroll", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      container?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Loading leaves...</p>
      </div>
    );
  }

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    return differenceInDays(end, start) + 1;
  };

  const resolvedLeaveType = leaveRequestType === 'Work From Home' ? 'Work From Home' : 'Leave';
  const resolvedLeaveCategory = leaveRequestType === 'Sick Leave' ? 'Sick' : leaveRequestType === 'Planned Leave' ? 'Planned' : undefined;
  const isSickExhausted = leaveRequestType === 'Sick Leave' && !!leaveCount && leaveCount.sickRemaining <= 0;
  const isWfhExhausted = leaveRequestType === 'Work From Home' && !!leaveCount && leaveCount.wfhRemaining <= 0;
  const exhaustedMessage = isSickExhausted
    ? 'sick leave exhausted'
    : isWfhExhausted
      ? 'wfh exhausted'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSickExhausted || isWfhExhausted) {
      toast({
        title: 'Cannot Submit',
        description: exhaustedMessage ?? 'Leave exhausted',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.startDate || !formData.endDate || !formData.reason) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (start > end) {
      toast({
        title: "Invalid Date Range",
        description: "End date must be after start date",
        variant: "destructive"
      });
      return;
    }

    const numberOfDays = calculateDays();
    
    if (resolvedLeaveType === 'Leave' && leaveCount) {
      const available = resolvedLeaveCategory === 'Sick' ? leaveCount.sickRemaining : leaveCount.plannedRemaining;
      if (numberOfDays > available) {
        toast({
          title: "Insufficient Leaves",
          description: `You only have ${available} ${resolvedLeaveCategory?.toLowerCase()} leave day${available !== 1 ? 's' : ''} remaining in this cycle.`,
          variant: "destructive"
        });
        return;
      }
    }

    if (resolvedLeaveType === 'Work From Home' && leaveCount && numberOfDays > leaveCount.wfhRemaining) {
      toast({
        title: "WFH Limit Exceeded",
        description: `You only have ${leaveCount.wfhRemaining} Work From Home day${leaveCount.wfhRemaining !== 1 ? 's' : ''} remaining this month.`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createLeave({
        startDate: formData.startDate,
        endDate: formData.endDate,
        type: resolvedLeaveType,
        leaveCategory: resolvedLeaveType === 'Leave' ? resolvedLeaveCategory : undefined,
        reason: formData.reason,
        numberOfDays,
      });

      toast({
        title: "Success",
        description: resolvedLeaveType === 'Work From Home'
          ? `Work From Home auto-approved successfully`
          : resolvedLeaveType === 'Leave' && resolvedLeaveCategory === 'Sick'
            ? `Sick leave auto-approved successfully`
            : `${leaveRequestType} request submitted successfully`,
      });

      setFormData({ startDate: '', endDate: '', reason: '' });
      setLeaveRequestType('Planned Leave');
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit leave request",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const myLeaves = leaves?.filter(leave => leave.userId === user?.id) || [];
  const otherLeaves = leaves?.filter(leave => leave.userId !== user?.id) || [];
  const allLeaves = leaves || [];

  let filteredMyLeaves = myLeaves;
  if (statusFilter !== 'All') {
    filteredMyLeaves = filteredMyLeaves.filter(leave => leave.status === statusFilter);
  }

  const approvalRequiredLeaves = otherLeaves.filter((leave) => leave.type === 'Leave' && (leave.leaveCategory ?? 'Planned') === 'Planned');
  const autoApprovedInfoLeaves = allLeaves.filter((leave) => (
    leave.type === 'Work From Home' || (leave.type === 'Leave' && leave.leaveCategory === 'Sick')
  ));

  const applyAdminFilters = (items: typeof otherLeaves) => {
    let filtered = items;
    if (statusFilter !== 'All') {
      filtered = filtered.filter(leave => leave.status === statusFilter);
    }
    if (userFilter !== 'All') {
      filtered = filtered.filter(leave => leave.user?.name === userFilter);
    }
    return filtered;
  };

  const filteredPlannedApprovalLeaves = applyAdminFilters(approvalRequiredLeaves);
  const filteredAutoApprovedLeaves = applyAdminFilters(autoApprovedInfoLeaves);
  const filteredApprovalLeaves = adminLeaveView === 'planned-approvals'
    ? filteredPlannedApprovalLeaves
    : filteredAutoApprovedLeaves;

  const handleScrollTop = () => {
    const container = document.querySelector("main");
    container?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTopBarClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button,select,input,textarea,option,label,a')) return;
    handleScrollTop();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Admin Tabs */}
      {isAdmin && (
        <div onClick={handleTopBarClick} className="sticky top-0 z-10 bg-white border-b border-border/60 px-4 pt-4 cursor-pointer">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('my-leaves')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'my-leaves'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              My Leaves
            </button>
            <button
              onClick={() => setActiveTab('approve-leaves')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'approve-leaves'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approve Leaves
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'holidays'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Holidays
            </button>
          </div>
        </div>
      )}

      <div className="pb-4">
        {/* MY LEAVES TAB */}
        {(!isAdmin || activeTab === 'my-leaves') && (
          <div className="space-y-6 p-4">
            {/* Leave Balance Card */}
            {leaveCount && (
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
                <h2 className="text-lg font-bold text-foreground mb-4">Leave Balance</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">{leaveCount.plannedRemaining}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Planned Remaining</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-rose-500">{leaveCount.sickRemaining}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Sick Remaining</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-500">{leaveCount.wfhRemaining ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">WFH Remaining</p>
                  </div>
                </div>
              </div>
            )}

            {/* Application Form */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
              <h2 className="text-lg font-bold text-foreground mb-4">Apply for Leave</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Leave Type Selection */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase">Leave Type</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="leaveRequestType"
                        value="Planned Leave"
                        checked={leaveRequestType === 'Planned Leave'}
                        onChange={(e) => setLeaveRequestType(e.target.value as 'Planned Leave' | 'Sick Leave' | 'Work From Home')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-foreground">Planned Leave</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="leaveRequestType"
                        value="Sick Leave"
                        checked={leaveRequestType === 'Sick Leave'}
                        onChange={(e) => setLeaveRequestType(e.target.value as 'Planned Leave' | 'Sick Leave' | 'Work From Home')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-foreground">Sick Leave</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="leaveRequestType"
                        value="Work From Home"
                        checked={leaveRequestType === 'Work From Home'}
                        onChange={(e) => setLeaveRequestType(e.target.value as 'Planned Leave' | 'Sick Leave' | 'Work From Home')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-foreground">Work From Home</span>
                    </label>
                  </div>
                </div>

                {leaveRequestType === 'Planned Leave' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-800">
                      <strong>Disclaimer:</strong> Planned leaves should be approved at least 10 days before travel.
                    </p>
                  </div>
                )}

                {leaveRequestType === 'Work From Home' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs text-blue-800">
                      <strong>Info:</strong> Work From Home is auto-approved and limited to 2 days per month (resets monthly, no carry forward).
                    </p>
                  </div>
                )}

                {exhaustedMessage && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="text-xs font-semibold text-rose-700">
                      {exhaustedMessage}
                    </p>
                  </div>
                )}

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Days Count */}
                {formData.startDate && formData.endDate && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm text-foreground font-medium">
                      Duration: <span className="font-bold text-primary">{calculateDays()} day{calculateDays() !== 1 ? 's' : ''}</span>
                    </p>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase">Reason</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    required
                    rows={2}
                    placeholder="Briefly explain the reason for your request..."
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !!exhaustedMessage}
                  className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Request
                </button>
              </form>
            </div>

            {/* Status Filter - My Leaves */}
            <div onClick={handleTopBarClick} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-3 border-b border-border/40 cursor-pointer">
              <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Filter by Status</span>
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              </div>
            </div>

            {/* Leave History */}
            <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
              <button
                onClick={() => setShowLeaveHistory(!showLeaveHistory)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="text-lg font-bold text-foreground">Leave History</h3>
                <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showLeaveHistory ? 'rotate-90' : ''}`} />
              </button>

              {showLeaveHistory && (
                <div className="space-y-3 mt-4">
                  {filteredMyLeaves.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No leaves found
                    </p>
                  ) : (
                    filteredMyLeaves.map((leave) => (
                      <LeaveCard key={leave.id} leave={leave as any} isAdmin={isAdmin} currentUserId={user?.id} onRefresh={() => refetch()} />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Calendar Toggle */}
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60 flex items-center justify-between hover:bg-gray-50 transition-all"
            >
              <span className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                See My Leave Calendar
              </span>
              <ChevronRight className={`w-5 h-5 transition-transform ${showCalendar ? 'rotate-90' : ''}`} />
            </button>

            {/* Calendar */}
            {showCalendar && (
              <LeaveCalendar leaves={myLeaves as any} holidays={holidays || []} calendarDate={calendarDate} setCalendarDate={setCalendarDate} />
            )}
          </div>
        )}

        {/* APPROVE LEAVES TAB */}
        {isAdmin && activeTab === 'approve-leaves' && (
          <div className="space-y-6 p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAdminLeaveView('planned-approvals')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  adminLeaveView === 'planned-approvals'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Planned Approvals
              </button>
              <button
                onClick={() => setAdminLeaveView('auto-approved')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  adminLeaveView === 'auto-approved'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Auto-Approved Info
              </button>
            </div>

            {/* Filters */}
            <div onClick={handleTopBarClick} className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-3 border-b border-border/40 cursor-pointer">
              <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Filter by User</span>
                  </div>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  >
                    <option value="All">All Users</option>
                    {uniqueUsers.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Filter by Status</span>
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  >
                    <option value="All">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              </div>
            </div>

            {/* Approval List */}
            <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
              <h3 className="text-lg font-bold text-foreground mb-4">
                {adminLeaveView === 'planned-approvals' ? 'Planned Leaves Requiring Approval' : 'Auto-Approved Sick Leaves & WFH'}
              </h3>
              <div className="space-y-3">
                {filteredApprovalLeaves.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {adminLeaveView === 'planned-approvals' ? 'No planned leaves to review' : 'No auto-approved leave or WFH entries'}
                  </p>
                ) : (
                  filteredApprovalLeaves.map((leave) => (
                    <LeaveCard key={leave.id} leave={leave as any} isAdmin={isAdmin} currentUserId={user?.id} onRefresh={() => refetch()} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* HOLIDAYS TAB */}
        {isAdmin && activeTab === 'holidays' && (
          <HolidaysTab holidays={holidays || []} onRefresh={() => refetchHolidays()} />
        )}
      </div>

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

function LeaveCalendar({ leaves, holidays, calendarDate, setCalendarDate }: { leaves: LeaveWithUser[]; holidays: any[]; calendarDate: Date; setCalendarDate: (date: Date) => void }) {
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getApprovedLeaveForDate = (date: Date) => {
    const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const leave = leaves.find(l => {
      const startDate = new Date(l.startDate);
      const endDate = new Date(l.endDate);
      const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
      const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
      return currentDate >= startTime && currentDate <= endTime && l.status === 'Approved';
    });
    return leave;
  };

  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(h => h.date === dateStr);
  };

  const getDayColor = (date: Date) => {
    if (isHoliday(date)) return 'bg-yellow-100 border-yellow-300';
    const leave = getApprovedLeaveForDate(date);
    if (leave?.type === 'Work From Home') return 'bg-blue-100 border-blue-300';
    if (leave?.type === 'Leave' && (leave.leaveCategory ?? 'Planned') === 'Sick') return 'bg-rose-100 border-rose-300';
    if (leave?.type === 'Leave') return 'bg-amber-100 border-amber-300';
    return 'bg-white hover:bg-gray-50';
  };

  const getDayBadgeColor = (date: Date) => {
    if (isHoliday(date)) return 'text-yellow-600 font-bold';
    const leave = getApprovedLeaveForDate(date);
    if (leave?.type === 'Work From Home') return 'text-blue-600';
    if (leave?.type === 'Leave' && (leave.leaveCategory ?? 'Planned') === 'Sick') return 'text-rose-600';
    if (leave?.type === 'Leave') return 'text-amber-700';
    return 'text-foreground';
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDayOfWeek = monthStart.getDay();
  const paddedDays = [...Array(firstDayOfWeek).fill(null), ...daysInMonth];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">{format(calendarDate, 'MMMM yyyy')}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></div>
          <span className="text-xs font-medium text-foreground">Planned Leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-rose-100 border border-rose-300 rounded"></div>
          <span className="text-xs font-medium text-foreground">Sick Leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
          <span className="text-xs font-medium text-foreground">WFH</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
          <span className="text-xs font-medium text-foreground">Holiday</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, idx) => (
          <div
            key={idx}
            className={`aspect-square rounded-lg border transition-all flex items-center justify-center text-sm font-medium ${
              day ? `${getDayColor(day)}` : 'bg-transparent border-transparent'
            }`}
          >
            {day ? (
              <span className={getDayBadgeColor(day)}>
                {format(day, 'd')}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaveCard({ leave, isAdmin, currentUserId, onRefresh }: { leave: LeaveWithUser; isAdmin: boolean; currentUserId?: number; onRefresh?: () => void }) {
  const { toast } = useToast();
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [remark, setRemark] = useState("");
  const { mutateAsync: updateLeaveStatus } = useUpdateLeaveStatus();
  
  // Fetch leave balance for this user (only for admins viewing others' leaves)
  const { data: userLeaveCount } = useLeaveCount(leave.userId);

  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      await updateLeaveStatus({
        id: leave.id,
        status: "Approved",
        approvalRemark: "",
      });
      toast({
        title: "Leave Approved",
        description: `${leave.user?.name}'s leave has been approved.`,
      });
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to approve leave",
        variant: "destructive",
      });
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectClick = () => {
    setShowRemarkInput(!showRemarkInput);
    setRemark("");
  };

  const handleReject = async () => {
    setRejectLoading(true);
    try {
      await updateLeaveStatus({
        id: leave.id,
        status: "Rejected",
        approvalRemark: remark,
      });
      toast({
        title: "Leave Rejected",
        description: `${leave.user?.name}'s leave has been rejected.`,
      });
      setShowRemarkInput(false);
      setRemark("");
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to reject leave",
        variant: "destructive",
      });
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-foreground">{leave.type}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(leave.status)}`}>
              {getStatusIcon(leave.status)}
              {leave.status}
            </span>
          </div>
          {isAdmin && leave.user && (
            <div>
              <p className="text-sm text-muted-foreground">{leave.user.name}</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground/80">
            {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">{leave.numberOfDays} day{leave.numberOfDays !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <p className="text-sm text-foreground/80 mb-2">{leave.reason}</p>

      {/* Leave Balance Info for Admins */}
      {isAdmin && leave.userId !== currentUserId && userLeaveCount && (
        <p className="text-xs text-muted-foreground mb-3">
          {leave.type === 'Work From Home' ? (
            <>ℹ️ {leave.user?.name} has <strong>{userLeaveCount.wfhRemaining}</strong> Work From Home day{userLeaveCount.wfhRemaining !== 1 ? 's' : ''} remaining this month.</>
          ) : (leave.leaveCategory ?? 'Planned') === 'Sick' ? (
            <>ℹ️ {leave.user?.name} has <strong>{userLeaveCount.sickRemaining}</strong> sick leave day{userLeaveCount.sickRemaining !== 1 ? 's' : ''} remaining.</>
          ) : (
            <>ℹ️ {leave.user?.name} has <strong>{userLeaveCount.plannedRemaining}</strong> planned leave day{userLeaveCount.plannedRemaining !== 1 ? 's' : ''} remaining.</>
          )}
        </p>
      )}

      {leave.approvalRemark && (
        <div className="text-xs text-muted-foreground italic border-l-2 border-border/50 pl-2 mb-2">
          {leave.approvalRemark}
        </div>
      )}

      {leave.createdAt && (
        <p className="text-xs text-muted-foreground mb-3">
          Submitted: {format(new Date(leave.createdAt), "MMM d, yyyy")}
        </p>
      )}

      {isAdmin && leave.status === "Pending" && (
        <>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApprove}
              disabled={approveLoading}
              className="flex-1 px-3 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {approveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Approve
            </button>
            <button
              onClick={handleRejectClick}
              className="flex-1 px-3 py-2 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600 font-medium"
            >
              Reject
            </button>
          </div>

          {showRemarkInput && (
            <div className="mt-3 space-y-2 p-3 bg-rose-50 rounded-lg border border-rose-200">
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Enter rejection reason (optional)"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={rejectLoading}
                  className="flex-1 px-3 py-2 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {rejectLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Reject
                </button>
                <button
                  onClick={() => {
                    setShowRemarkInput(false);
                    setRemark("");
                  }}
                  className="flex-1 px-3 py-2 bg-gray-300 text-gray-900 text-sm rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HolidaysTab({ holidays, onRefresh }: { holidays: any[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ date: '', name: '', description: '' });
  const { mutateAsync: createHoliday, isPending: isCreating } = useCreateHoliday();
  const { mutateAsync: deleteHoliday } = useDeleteHoliday();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      await createHoliday({
        date: formData.date,
        name: formData.name,
        description: formData.description || undefined
      });
      toast({
        title: "Success",
        description: "Holiday added successfully"
      });
      setFormData({ date: '', name: '', description: '' });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add holiday",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteHoliday(id);
      toast({
        title: "Success",
        description: "Holiday deleted successfully"
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete holiday",
        variant: "destructive"
      });
    }
  };

  const sortedHolidays = [...holidays].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Add Holiday Form */}
      <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Add Holiday
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Holiday Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Christmas"
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Holiday
          </button>
        </form>
      </div>

      {/* Holidays List */}
      <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
        <h3 className="text-lg font-bold text-foreground mb-4">All Holidays</h3>
        <div className="space-y-3">
          {sortedHolidays.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No holidays declared yet
            </p>
          ) : (
            sortedHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200 hover:shadow-md transition-shadow"
              >
                <Calendar className="w-5 h-5 text-yellow-600 mt-1" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{holiday.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(holiday.date), 'MMMM dd, yyyy')}
                      </p>
                      {holiday.description && (
                        <p className="text-sm text-foreground mt-1">{holiday.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(holiday.id)}
                      className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                      title="Delete holiday"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Approved':
      return 'bg-emerald-100 text-emerald-700';
    case 'Rejected':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'Approved':
      return <CheckCircle className="w-4 h-4" />;
    case 'Rejected':
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}
