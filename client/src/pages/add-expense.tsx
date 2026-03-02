import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useUpload, fileToBase64 } from "@/hooks/use-upload";
import { Loader2, UploadCloud, File as FileIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  "Travel", "Meals", "Office Supplies", "Software/Subscriptions", "Hardware", "Other"
];

export default function AddExpense() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutateAsync: createExpense } = useCreateExpense();
  const { mutateAsync: uploadFile } = useUpload();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    paidTo: "",
    category: CATEGORIES[0],
    description: "",
    remarks: "",
  });

  const [files, setFiles] = useState<{
    proof: File | null;
    invoice: File | null;
  }>({ proof: null, invoice: null });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'proof' | 'invoice') => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const removeFile = (type: 'proof' | 'invoice') => {
    setFiles(prev => ({ ...prev, [type]: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let paymentProofUrl = null;
      let invoiceUrl = null;

      // Handle Uploads first
      if (files.proof) {
        const base64 = await fileToBase64(files.proof);
        const res = await uploadFile({ filename: files.proof.name, content: base64 });
        paymentProofUrl = res.url;
      }

      if (files.invoice) {
        const base64 = await fileToBase64(files.invoice);
        const res = await uploadFile({ filename: files.invoice.name, content: base64 });
        invoiceUrl = res.url;
      }

      // Create Expense
      await createExpense({
        ...formData,
        amount: formData.amount, // Schema expects string/numeric
        paymentProofUrl,
        invoiceUrl,
      });

      toast({
        title: "Success!",
        description: "Your expense has been submitted for approval.",
      });
      setLocation("/");
      
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const FileInputBox = ({ title, type, file }: { title: string, type: 'proof' | 'invoice', file: File | null }) => (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-foreground/80 mb-2">{title}</label>
      {file ? (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FileIcon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium truncate">{file.name}</span>
          </div>
          <button type="button" onClick={() => removeFile(type)} className="p-2 text-muted-foreground hover:text-rose-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border/80 rounded-xl cursor-pointer hover:bg-secondary/30 transition-colors bg-background">
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground group-hover:text-primary transition-colors">
            <UploadCloud className="w-6 h-6 mb-2" />
            <p className="text-xs font-medium">Click to upload or take photo</p>
          </div>
          <input type="file" className="hidden" accept="image/*,.pdf" capture="environment" onChange={(e) => handleFileChange(e, type)} />
        </label>
      )}
    </div>
  );

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display text-foreground">Add Expense</h2>
        <p className="text-muted-foreground text-sm">Submit a new reimbursement request</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card p-5 rounded-3xl shadow-sm border border-border/50">
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">Date</label>
            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">Amount (₹)</label>
            <input
              type="number"
              name="amount"
              step="0.01"
              required
              placeholder="0.00"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground/80 mb-2">Paid To (Vendor/Merchant)</label>
          <input
            type="text"
            name="paidTo"
            required
            placeholder="e.g. Amazon, Uber, Local Cafe"
            value={formData.paidTo}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground/80 mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm appearance-none"
          >
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground/80 mb-2">Description</label>
          <textarea
            name="description"
            required
            rows={2}
            placeholder="Briefly describe the expense..."
            value={formData.description}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground/80 mb-2">Remarks (Optional)</label>
          <input
            type="text"
            name="remarks"
            placeholder="Any additional notes for admin"
            value={formData.remarks}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="pt-2 border-t border-border/50">
          <FileInputBox title="Payment Proof" type="proof" file={files.proof} />
          <FileInputBox title="Invoice (Optional)" type="invoice" file={files.invoice} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-70 disabled:scale-100 flex justify-center items-center gap-2 mt-4"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Request"
          )}
        </button>

      </form>
    </div>
  );
}
