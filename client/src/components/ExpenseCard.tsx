import { format } from "date-fns";
import { User as UserIcon, Download, Pencil, X, Paperclip, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { useUpdateExpenseStatus, useUpdateExpense } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithUser } from "@shared/schema";
import { useState } from "react";

const CATEGORY_GROUPS = [
  { group: "Travel",      options: ["Travel - Flights", "Travel - Trains", "Travel - Cabs", "Travel - Car Rental", "Travel - Petrol"] },
  { group: "General",    options: ["Meals", "Stay", "Team Outings"] },
  { group: "Operational", options: ["Operational - Material Purchase", "Operational - Transport", "Operational - Fuel", "Operational - Labour", "Operational - Machine Purchase", "Operational - Machine Rental", "Operational - Misc"] },
  { group: "Other",      options: ["Office Supplies", "Software/Subscriptions", "Hardware", "Other"] },
];

interface ExpenseCardProps {
  expense: ExpenseWithUser;
  isAdmin: boolean;
}

export function ExpenseCard({ expense, isAdmin }: ExpenseCardProps) {
  const { mutate: updateStatus, isPending } = useUpdateExpenseStatus();
  const { mutate: updateExpense, isPending: isUpdatingExpense } = useUpdateExpense();
  const { toast } = useToast();
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const paymentProofUrl = expense.paymentProofUrl ?? "";
  const invoiceUrl = expense.invoiceUrl ?? "";
  const attachments = [
    expense.paymentProofUrl ? { label: "Payment Proof", url: paymentProofUrl } : null,
    expense.invoiceUrl ? { label: "Invoice", url: invoiceUrl } : null,
  ].filter(Boolean) as Array<{ label: string; url: string }>;
  const activeAttachment = activeAttachmentIndex !== null ? attachments[activeAttachmentIndex] : null;
  const mealParticipantNames = expense.mealParticipants ? JSON.parse(expense.mealParticipants) as string[] : [];
  const flagReasonItems = expense.flagReason ? expense.flagReason.split(" | ").filter(Boolean) : [];
  const [editForm, setEditForm] = useState({
    date: expense.date,
    amount: String(expense.amount),
    paidTo: expense.paidTo,
    category: expense.category,
    description: expense.description,
    remarks: expense.remarks || "",
    paymentProofUrl: expense.paymentProofUrl || "",
    invoiceUrl: expense.invoiceUrl || "",
  });

  const handleStatusUpdate = (status: 'Approved' | 'Rejected') => {
    updateStatus(
      { id: expense.id, status },
      {
        onSuccess: () => {
          toast({
            title: `Expense ${status}`,
            description: `The expense has been successfully ${status.toLowerCase()}.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  const openEdit = () => {
    setEditForm({
      date: expense.date,
      amount: String(expense.amount),
      paidTo: expense.paidTo,
      category: expense.category,
      description: expense.description,
      remarks: expense.remarks || "",
      paymentProofUrl: expense.paymentProofUrl || "",
      invoiceUrl: expense.invoiceUrl || "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editForm.date || !editForm.amount || !editForm.paidTo || !editForm.category || !editForm.description) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    updateExpense(
      {
        id: expense.id,
        data: {
          date: editForm.date,
          amount: editForm.amount,
          paidTo: editForm.paidTo,
          category: editForm.category,
          description: editForm.description,
          remarks: editForm.remarks || null,
          paymentProofUrl: editForm.paymentProofUrl || null,
          invoiceUrl: editForm.invoiceUrl || null,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Expense updated",
            description: "Your pending expense has been updated.",
          });
          setIsEditing(false);
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60 mb-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <div className="mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold text-foreground font-display">
              ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <StatusBadge status={expense.status} />
            {expense.isFlagged && (
              <span className="relative inline-flex group">
                <span className="inline-flex items-center gap-1 whitespace-nowrap leading-none text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full">
                  <span className="text-[10px]">⚠</span>
                  <span>Flagged</span>
                </span>
                {isAdmin && (
                  <span className="pointer-events-none absolute z-30 right-0 top-full mt-1 hidden group-hover:block rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 shadow-md w-max max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal break-words text-xs text-amber-800">
                    <span className="font-semibold uppercase tracking-wider text-[11px]">Flag Reason</span>
                    <span className="block mt-1">
                      {(flagReasonItems.length > 0 ? flagReasonItems : ['Requires manual review.']).join(' • ')}
                    </span>
                  </span>
                )}
              </span>
            )}
            {!isAdmin && expense.status === 'Pending' && (
              <button
                onClick={openEdit}
                className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                title="Edit pending expense"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground/90 truncate">{expense.paidTo}</h3>
              <p className="text-sm text-muted-foreground truncate">{expense.category}</p>
            </div>
            <p className="text-sm font-medium text-foreground/70 whitespace-nowrap shrink-0 mt-0.5">
              {format(new Date(expense.date), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </div>

      {isAdmin && expense.user && (
        <div className="flex items-center gap-2 py-1.5 px-2.5 bg-secondary/50 rounded-lg mb-3">
          <div className="bg-primary/10 p-1.5 rounded-full text-primary">
            <UserIcon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-foreground/80">{expense.user.name}</span>
        </div>
      )}

      <div className="space-y-2 mb-3">
        {expense.category === 'Meals' && expense.mealParticipantCount > 1 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Meal Participants</p>
            <p className="text-sm text-foreground/80 truncate">
              {expense.mealParticipantCount} people total{mealParticipantNames.length > 0 ? ` · ${mealParticipantNames.join(', ')}` : ''}
            </p>
          </div>
        )}

        {expense.category === 'Stay' && expense.stayCheckIn && expense.stayCheckOut && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stay Period</p>
            <p className="text-sm text-foreground/80">
              {format(new Date(expense.stayCheckIn), "MMM d")} → {format(new Date(expense.stayCheckOut), "MMM d, yyyy")}
              {' · '}
              {Math.max(1, Math.ceil((new Date(expense.stayCheckOut).getTime() - new Date(expense.stayCheckIn).getTime()) / 86400000))} nights
              {' · Cap: ₹'}
              {(3000 * Math.max(1, Math.ceil((new Date(expense.stayCheckOut).getTime() - new Date(expense.stayCheckIn).getTime()) / 86400000))).toLocaleString('en-IN')}
            </p>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      {attachments.length > 0 && (
        <div className="border-t border-border/50 pt-3 mt-3">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setActiveAttachmentIndex(0)}
              className="relative inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 transition-colors"
              title="View attachments"
            >
              <Paperclip className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">
                {attachments.length}
              </span>
            </button>
          </div>

          {/* Modal Backdrop */}
          {activeAttachment && (
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setActiveAttachmentIndex(null)}
            >
              <div 
                className="bg-background rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{activeAttachment.label}</h3>
                      {attachments.length > 1 && (
                        <span className="text-xs text-muted-foreground">{(activeAttachmentIndex as number) + 1}/{attachments.length}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {attachments.length > 1 && (
                        <>
                          <button
                            onClick={() => setActiveAttachmentIndex((prev) => prev === null ? 0 : (prev - 1 + attachments.length) % attachments.length)}
                            className="w-8 h-8 rounded bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center"
                            title="Previous attachment"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveAttachmentIndex((prev) => prev === null ? 0 : (prev + 1) % attachments.length)}
                            className="w-8 h-8 rounded bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center"
                            title="Next attachment"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <a 
                        href={activeAttachment.url} 
                        download
                        className="text-xs text-primary hover:text-primary/80 px-3 py-1.5 bg-primary/5 rounded hover:bg-primary/10 transition-colors flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                      <button
                        onClick={() => setActiveAttachmentIndex(null)}
                        className="text-xl text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {activeAttachment.url.toLowerCase().endsWith('.pdf') ? (
                    <iframe 
                      src={activeAttachment.url} 
                      className="w-full h-[60vh] border border-border/50 rounded"
                      title={`${activeAttachment.label} PDF`}
                    />
                  ) : (
                    <img 
                      src={activeAttachment.url} 
                      alt={activeAttachment.label}
                      className="w-full h-auto rounded"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsEditing(false)}>
          <div className="bg-background rounded-2xl max-w-xl w-full max-h-[85vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Edit Pending Expense</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border/80 bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border/80 bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Paid To</label>
                <input
                  type="text"
                  value={editForm.paidTo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, paidTo: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border/80 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border/80 bg-background"
                >
                  {CATEGORY_GROUPS.map(({ group, options }) => (
                    <optgroup key={group} label={group}>
                      {options.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border/80 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Remarks (optional)</label>
                <input
                  type="text"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border/80 bg-background"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border/50 flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isUpdatingExpense}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60"
              >
                {isUpdatingExpense ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      {isAdmin && expense.status === 'Pending' && (
        <div className="flex gap-3 mt-5 pt-4 border-t border-border/50">
          <button
            onClick={() => handleStatusUpdate('Approved')}
            disabled={isPending}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => handleStatusUpdate('Rejected')}
            disabled={isPending}
            className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
