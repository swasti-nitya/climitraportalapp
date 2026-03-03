import { format } from "date-fns";
import { FileText, Image as ImageIcon, Receipt, User as UserIcon, Download } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { useUpdateExpenseStatus } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseWithUser } from "@shared/schema";
import { useState } from "react";

interface ExpenseCardProps {
  expense: ExpenseWithUser;
  isAdmin: boolean;
}

export function ExpenseCard({ expense, isAdmin }: ExpenseCardProps) {
  const { mutate: updateStatus, isPending } = useUpdateExpenseStatus();
  const { toast } = useToast();
  const [expandedImages, setExpandedImages] = useState<{ proof?: boolean; invoice?: boolean }>({});

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
              ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attachments</p>
          
          <div className="flex flex-wrap gap-3">
            {expense.paymentProofUrl && (
              <button
                onClick={() => setExpandedImages(prev => ({ ...prev, proof: true }))}
                className="flex items-center gap-1.5 text-xs font-medium bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Payment Proof
              </button>
            )}

            {expense.invoiceUrl && (
              <button
                onClick={() => setExpandedImages(prev => ({ ...prev, invoice: true }))}
                className="flex items-center gap-1.5 text-xs font-medium bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
              >
                <Receipt className="w-3.5 h-3.5" />
                Invoice
              </button>
            )}
          </div>

          {/* Modal Backdrop */}
          {(expandedImages.proof || expandedImages.invoice) && (
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setExpandedImages({})}
            >
              <div 
                className="bg-background rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {expandedImages.proof && (
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-border/50">
                      <h3 className="font-semibold text-foreground">Payment Proof</h3>
                      <div className="flex gap-2">
                        <a 
                          href={expense.paymentProofUrl} 
                          download
                          className="text-xs text-primary hover:text-primary/80 px-3 py-1.5 bg-primary/5 rounded hover:bg-primary/10 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                        <button
                          onClick={() => setExpandedImages({})}
                          className="text-xl text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {expense.paymentProofUrl.toLowerCase().endsWith('.pdf') ? (
                      <iframe 
                        src={expense.paymentProofUrl} 
                        className="w-full h-[60vh] border border-border/50 rounded"
                        title="Payment Proof PDF"
                      />
                    ) : (
                      <img 
                        src={expense.paymentProofUrl} 
                        alt="Payment Proof"
                        className="w-full h-auto rounded"
                      />
                    )}
                  </div>
                )}

                {expandedImages.invoice && (
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-border/50">
                      <h3 className="font-semibold text-foreground">Invoice</h3>
                      <div className="flex gap-2">
                        <a 
                          href={expense.invoiceUrl} 
                          download
                          className="text-xs text-primary hover:text-primary/80 px-3 py-1.5 bg-primary/5 rounded hover:bg-primary/10 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                        <button
                          onClick={() => setExpandedImages({})}
                          className="text-xl text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {expense.invoiceUrl.toLowerCase().endsWith('.pdf') ? (
                      <iframe 
                        src={expense.invoiceUrl} 
                        className="w-full h-[60vh] border border-border/50 rounded"
                        title="Invoice PDF"
                      />
                    ) : (
                      <img 
                        src={expense.invoiceUrl} 
                        alt="Invoice"
                        className="w-full h-auto rounded"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
