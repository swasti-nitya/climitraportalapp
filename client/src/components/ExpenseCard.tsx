import { format } from "date-fns";
import { FileText, Image as ImageIcon, Receipt, User as UserIcon } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { useUpdateExpenseStatus } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithUser } from "@shared/schema";

interface ExpenseCardProps {
  expense: ExpenseWithUser;
  isAdmin: boolean;
}

export function ExpenseCard({ expense, isAdmin }: ExpenseCardProps) {
  const { mutate: updateStatus, isPending } = useUpdateExpenseStatus();
  const { toast } = useToast();

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

  return (
    <div className="bg-card rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60 mb-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold text-foreground font-display">
              ${Number(expense.amount).toFixed(2)}
            </span>
            <StatusBadge status={expense.status} />
          </div>
          <h3 className="text-lg font-semibold text-foreground/90">{expense.paidTo}</h3>
          <p className="text-sm text-muted-foreground">{expense.category}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground/80">
            {format(new Date(expense.date), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {isAdmin && expense.user && (
        <div className="flex items-center gap-2 py-2 px-3 bg-secondary/50 rounded-lg mb-4">
          <div className="bg-primary/10 p-1.5 rounded-full text-primary">
            <UserIcon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-foreground/80">{expense.user.name}</span>
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-foreground/80">{expense.description}</p>
        </div>
        
        {expense.remarks && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Remarks</p>
            <p className="text-sm text-foreground/80 italic">"{expense.remarks}"</p>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      {(expense.paymentProofUrl || expense.invoiceUrl) && (
        <div className="border-t border-border/50 pt-4 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attachments</p>
          <div className="flex flex-wrap gap-2">
            {expense.paymentProofUrl && (
              <a 
                href={expense.paymentProofUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium bg-primary/5 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Proof
              </a>
            )}
            {expense.invoiceUrl && (
              <a 
                href={expense.invoiceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium bg-primary/5 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                Invoice
              </a>
            )}
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
