import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateExpense, useExpensesList } from "@/hooks/use-expenses";
import { useUpload, fileToBase64 } from "@/hooks/use-upload";
import { Loader2, File as FileIcon, X, Sparkles, CheckCircle2, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUsersList } from "@/hooks/use-users";
import { api } from "@shared/routes";

const MAIN_CATEGORIES = [
  { key: "Travel",                  label: "Travel" },
  { key: "Meals - Travel related",   label: "Meals - Travel related" },
  { key: "Stay",                    label: "Stay" },
  { key: "Team Outings",            label: "Team Outings" },
  { key: "Operational",             label: "Operational" },
  { key: "Office Supplies",         label: "Office Supplies" },
  { key: "Software/Subscriptions",  label: "Software/Subscriptions" },
  { key: "Hardware",                label: "Hardware" },
  { key: "Other",                   label: "Other" },
];

const TRAVEL_SUBS = ["Flights", "Trains", "Cabs", "Car Rental", "Petrol"];
const OPERATIONAL_SUBS = ["Material Purchase", "Transport", "Fuel", "Labour", "Machine Purchase", "Machine Rental", "Misc"];

export default function AddExpense() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { mutateAsync: createExpense } = useCreateExpense();
  const { mutateAsync: uploadFile } = useUpload();
  const { data: users = [] } = useUsersList();
  const { data: existingExpenses = [] } = useExpensesList();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrVerified, setOcrVerified] = useState(false);
  const [ocrUnreadable, setOcrUnreadable] = useState(false);
  const [mainCategory, setMainCategory] = useState("Travel");
  const [subCategory, setSubCategory] = useState("Flights");
  const [hasMultipleMealPeople, setHasMultipleMealPeople] = useState(false);
  const [mealParticipantCount, setMealParticipantCount] = useState(1);
  const [mealParticipants, setMealParticipants] = useState<Array<{ type: "user" | "other"; value: string; otherName: string }>>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    paidTo: "",
    category: "Travel - Flights",
    description: "",
    remarks: "",
    stayParticipantCount: "1",
    stayCheckIn: "",
    stayCheckOut: "",
  });

  const [files, setFiles] = useState<File[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleMainCategoryChange = (cat: string) => {
    setMainCategory(cat);
    const firstSub = cat === "Travel" ? TRAVEL_SUBS[0] : cat === "Operational" ? OPERATIONAL_SUBS[0] : "";
    setSubCategory(firstSub);
    const fullCat = (cat === "Travel" || cat === "Operational") ? `${cat} - ${firstSub}` : cat;
    setFormData(prev => ({ ...prev, category: fullCat }));
  };

  const handleSubCategoryChange = (sub: string) => {
    setSubCategory(sub);
    setFormData(prev => ({ ...prev, category: `${mainCategory} - ${sub}` }));
  };

  const syncMealParticipants = (nextCount: number) => {
    const extraPeopleCount = Math.max(0, nextCount - 1);
    setMealParticipants((prev) => {
      const next = [...prev];
      while (next.length < extraPeopleCount) {
        next.push({ type: "user", value: "", otherName: "" });
      }
      return next.slice(0, extraPeopleCount);
    });
  };

  const handleMealParticipantCountChange = (value: string) => {
    const parsed = Math.max(1, Number.parseInt(value || "1", 10) || 1);
    setMealParticipantCount(parsed);
    syncMealParticipants(parsed);
  };

  const updateMealParticipant = (index: number, patch: Partial<{ type: "user" | "other"; value: string; otherName: string }>) => {
    setMealParticipants((prev) => prev.map((participant, participantIndex) => (
      participantIndex === index ? { ...participant, ...patch } : participant
    )));
  };

  const effectiveMealCap = 1000 * Math.max(1, mealParticipantCount);
  const currentMealAmount = Number(formData.amount) || 0;
  const sameDayMealTotal = existingExpenses
    .filter((expense) => (
      expense.category === "Meals - Travel related" &&
      expense.date === formData.date &&
      expense.status !== "Rejected"
    ))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const projectedMealTotal = sameDayMealTotal + currentMealAmount;
  const isProjectedMealCapExceeded = projectedMealTotal > effectiveMealCap;
  const resolvedMealParticipantNames = mealParticipants
    .map((participant) => participant.type === "other" ? participant.otherName.trim() : participant.value)
    .filter(Boolean);
  const currentSubCategories = mainCategory === "Travel"
    ? TRAVEL_SUBS
    : mainCategory === "Operational"
      ? OPERATIONAL_SUBS
      : [];
  const categoryGuidance = (() => {
    if (mainCategory === "Meals - Travel related") {
      return {
        emoji: "🍽️",
        className: "bg-emerald-50 border-emerald-200 text-emerald-800",
        message: "Meals cap is ₹1,000 per person per day. The system checks cumulative same-day total (all meal entries for that date), not just one transaction.",
      };
    }

    if (formData.category === "Travel - Flights" || formData.category === "Travel - Trains") {
      return {
        emoji: "✈️",
        className: "bg-amber-50 border-amber-200 text-amber-800",
        message: "For flights and train bookings, upload the booking invoice/e-ticket along with payment proof whenever available.",
      };
    }

    if (mainCategory === "Stay") {
      return {
        emoji: "🏨",
        className: "bg-blue-50 border-blue-200 text-blue-800",
        message: "Stay cap is ₹3,000 per night (per person). Add check-in/check-out correctly so cap is calculated from the stay duration.",
      };
    }

    if (mainCategory === "Operational") {
      return {
        emoji: "🏭",
        className: "bg-violet-50 border-violet-200 text-violet-800",
        message: "Operational expenses are tracked against a ₹50,000 weekly cap per person. Entries above the weekly limit are flagged for review.",
      };
    }

    return null;
  })();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    const selectedFiles = Array.from(e.target.files);
    const remainingSlots = Math.max(0, 2 - files.length);

    if (remainingSlots === 0) {
      toast({
        title: "Maximum Files Reached",
        description: "You can upload up to 2 attachments.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }

    const validFiles: File[] = [];

    for (const file of selectedFiles) {
      if (validFiles.length >= remainingSlots) break;

      if (file.size > maxSize) {
        toast({
          title: "File Size Exceeded",
          description: `${file.name} is too large. Maximum file size is 5MB.`,
          variant: "destructive"
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);

    // Process OCR on the first accepted file
    const ocrFile = validFiles[0];
    const isOcrSupported =
      ocrFile.type === 'image/jpeg' ||
      ocrFile.type === 'image/png' ||
      ocrFile.type === 'image/jpg' ||
      ocrFile.type === 'application/pdf';

    if (isOcrSupported) {
      await processOCR(ocrFile);
    }

    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setOcrVerified(false);
  };

  const processOCR = async (file: File) => {
    setIsProcessingOCR(true);
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch(api.ocr.extractAmount.path, {
        method: api.ocr.extractAmount.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: file.name, content: base64 }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.message || "OCR request failed");
      }

      const result: { amount: number | null; confidence?: "high" | "medium" | "low" } = await response.json();
      const amount = result.amount;

      if (amount !== null) {
        setFormData(prev => ({ ...prev, amount: amount.toString() }));
        setOcrVerified(true);
        setOcrUnreadable(false);
        toast({
          title: "Amount Detected!",
          description: `AI OCR found ₹${amount.toFixed(2)}${result.confidence ? ` (${result.confidence} confidence)` : ""}. Please verify it's correct.`,
        });
      } else {
        setOcrVerified(false);
        setOcrUnreadable(true);
        toast({
          title: "No Amount Found",
          description: "Please enter the amount manually.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('OCR Error:', error);
      setOcrVerified(false);
      setOcrUnreadable(true);
      toast({
        title: "OCR Processing Failed",
        description: error instanceof Error ? `${error.message}. Please enter the amount manually.` : "Please enter the amount manually.",
        variant: "default"
      });
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      toast({
        title: "Missing Files",
        description: "Please upload the mandatory attachment (payment proof).",
        variant: "destructive"
      });
      return;
    }

    if (mainCategory === 'Stay' && (!formData.stayCheckIn || !formData.stayCheckOut)) {
      toast({
        title: "Missing Stay Dates",
        description: "Please enter check-in and check-out dates for stay expenses.",
        variant: "destructive"
      });
      return;
    }

    if (mainCategory === 'Meals - Travel relatd' && hasMultipleMealPeople) {
      const hasInvalidParticipant = mealParticipants.some((participant) => (
        participant.type === 'other'
          ? !participant.otherName.trim()
          : !participant.value.trim()
      ));

      if (mealParticipantCount < 2 || hasInvalidParticipant) {
        toast({
          title: "Incomplete Meal Participants",
          description: "Add the total people count and all participant names for shared meals.",
          variant: "destructive"
        });
        return;
      }
    }
    
    setIsSubmitting(true);

    try {
      let paymentProofUrl = null;
      let invoiceUrl = null;

      // Handle Uploads first
      if (files[0]) {
        const base64 = await fileToBase64(files[0]);
        const res = await uploadFile({ filename: files[0].name, content: base64 });
        paymentProofUrl = res.url;
      }

      if (files[1]) {
        const base64 = await fileToBase64(files[1]);
        const res = await uploadFile({ filename: files[1].name, content: base64 });
        invoiceUrl = res.url;
      }

      // Create Expense
      const result = await createExpense({
        ...formData,
        amount: formData.amount,
        paymentProofUrl,
        invoiceUrl,
        flagReason: ocrUnreadable ? 'Receipt unreadable — OCR not verified for the uploaded proof.' : null,
        mealParticipantCount: mainCategory === 'Meals - Travel relatd' ? mealParticipantCount : 1,
        mealParticipants: mainCategory === 'Meals - Travel relatd' && hasMultipleMealPeople
          ? JSON.stringify(resolvedMealParticipantNames)
          : null,
        stayParticipantCount: mainCategory === 'Stay' ? Math.max(1, Number.parseInt(formData.stayParticipantCount || '1', 10) || 1) : 1,
        stayCheckIn: formData.stayCheckIn || null,
        stayCheckOut: formData.stayCheckOut || null,
      });

      if (result?.isFlagged) {
        toast({
          title: "Expense Submitted — Flagged ⚠️",
          description: result.flagReason || "This expense has been flagged for founder review.",
        });
      } else {
        toast({
          title: "Success!",
          description: "Your expense has been submitted for approval.",
        });
      }
      setLocation("/expenses");
      
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

  const FileInputBox = ({ files }: { files: File[] }) => (
    <div className="mb-4">
      <label className="block cursor-pointer">
        <input
          type="file"
          className="hidden"
          accept="image/jpeg,image/jpg,image/png,application/pdf"
          multiple
          onChange={handleFileChange}
        />
        <div className="rounded-2xl border-2 border-dashed border-border/70 bg-secondary/10 p-8 text-center hover:bg-secondary/20 hover:border-primary/30 transition-all">
          <Paperclip className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-base font-semibold text-primary">Upload receipt / invoice</p>
          <p className="text-xs text-muted-foreground mt-1">JPEG, PNG or PDF</p>
        </div>
      </label>

      {files.length > 0 && (
        <div className="space-y-2 mt-3">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <FileIcon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium truncate">{file.name}</span>
              </div>
              <button type="button" onClick={() => removeFile(index)} className="p-2 text-muted-foreground hover:text-rose-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
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
            <label className="text-sm font-semibold text-foreground/80 mb-2 flex items-center gap-2">
              Amount (₹)
              {isProcessingOCR && (
                <span className="flex items-center gap-1 text-xs text-blue-600">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Processing OCR...
                </span>
              )}
              {ocrVerified && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  OCR Verified
                </span>
              )}
            </label>
            <input
              type="number"
              name="amount"
              step="0.01"
              required
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => {
                handleChange(e);
                setOcrVerified(false); // Clear verification if manually edited
              }}
              className={`w-full px-4 py-3 bg-background border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium ${
                ocrVerified ? 'border-emerald-500/50 bg-emerald-50/50' : 'border-border/80'
              }`}
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
          <div className="space-y-3">
            <select
              value={mainCategory}
              onChange={(e) => handleMainCategoryChange(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            >
              {MAIN_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>

            {currentSubCategories.length > 0 && (
              <select
                value={subCategory}
                onChange={(e) => handleSubCategoryChange(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              >
                {currentSubCategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* Show selected category as tag */}
          <p className="text-xs text-muted-foreground mt-2">Selected: <span className="font-semibold text-foreground">{formData.category}</span></p>

          {categoryGuidance && (
            <div className={`mt-3 flex gap-2 rounded-xl border p-3 ${categoryGuidance.className}`}>
              <span className="text-base">{categoryGuidance.emoji}</span>
              <p className="text-xs">
                <strong>Reminder:</strong> {categoryGuidance.message}
              </p>
            </div>
          )}
        </div>

        {/* Stay check-in / check-out */}
        {mainCategory === 'Stay' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-2">No. of People <span className="text-rose-500">*</span></label>
              <input
                type="number"
                name="stayParticipantCount"
                min={1}
                value={formData.stayParticipantCount}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-2">Check-in Date <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  name="stayCheckIn"
                  value={formData.stayCheckIn}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-2">Check-out Date <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  name="stayCheckOut"
                  value={formData.stayCheckOut}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
              </div>
            </div>
            {formData.stayCheckIn && formData.stayCheckOut && (() => {
              const stayPeople = Math.max(1, Number.parseInt(formData.stayParticipantCount || '1', 10) || 1);
              const nights = Math.max(1, Math.ceil((new Date(formData.stayCheckOut as string).getTime() - new Date(formData.stayCheckIn as string).getTime()) / 86400000));
              const cap = 3000 * nights * stayPeople;
              const over = Number(formData.amount) > cap;
              return (
                <p className="text-xs text-muted-foreground">
                  {nights} night{nights > 1 ? 's' : ''} · {stayPeople} person{stayPeople > 1 ? 's' : ''} · Cap:{' '}
                  <span className={`font-semibold ${over ? 'text-rose-500' : 'text-emerald-600'}`}>₹{cap.toLocaleString('en-IN')}</span>
                  {over && <span className="text-rose-500 font-medium ml-1">⚠️ Exceeds cap — will be flagged</span>}
                </p>
              );
            })()}
          </div>
        )}

        {/* Meals cap indicator */}
        {mainCategory === 'Meals' && (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Shared meal?</p>
                <p className="text-xs text-muted-foreground">Add collaborators if the meal was split across multiple people.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !hasMultipleMealPeople;
                  setHasMultipleMealPeople(next);
                  const nextCount = next ? Math.max(2, mealParticipantCount) : 1;
                  setMealParticipantCount(nextCount);
                  syncMealParticipants(nextCount);
                }}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${hasMultipleMealPeople ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${hasMultipleMealPeople ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {hasMultipleMealPeople && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground/80 mb-2">Total People (including you)</label>
                  <input
                    type="number"
                    min={2}
                    value={mealParticipantCount}
                    onChange={(e) => handleMealParticipantCountChange(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground/80">Other participants</p>
                  {mealParticipants.map((participant, index) => (
                    <div key={index} className="space-y-2 rounded-xl border border-border/60 bg-background p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={participant.type}
                          onChange={(e) => updateMealParticipant(index, { type: e.target.value as 'user' | 'other', value: '', otherName: '' })}
                          className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground text-sm"
                        >
                          <option value="user">Climitra user</option>
                          <option value="other">Other</option>
                        </select>

                        {participant.type === 'user' ? (
                          <select
                            value={participant.value}
                            onChange={(e) => updateMealParticipant(index, { value: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground text-sm"
                          >
                            <option value="">Select user</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.name}>{user.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={participant.otherName}
                            onChange={(e) => updateMealParticipant(index, { otherName: e.target.value })}
                            placeholder="Enter name"
                            className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground text-sm"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentMealAmount > 0 && (
              <div className={`flex gap-2 rounded-xl p-3 border ${
                isProjectedMealCapExceeded ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className="text-base">{isProjectedMealCapExceeded ? '⚠️' : '✅'}</span>
                <p className={`text-xs ${isProjectedMealCapExceeded ? 'text-rose-800' : 'text-emerald-800'}`}>
                  {isProjectedMealCapExceeded
                    ? <><strong>Cap Exceeded:</strong> Daily meals total after this entry will be ₹{projectedMealTotal.toLocaleString('en-IN')}, above the ₹{effectiveMealCap.toLocaleString('en-IN')} cap.</>
                    : <><strong>Within Cap:</strong> Daily meals total after this entry will be ₹{projectedMealTotal.toLocaleString('en-IN')} out of ₹{effectiveMealCap.toLocaleString('en-IN')}.</>
                  }
                </p>
              </div>
            )}

            {ocrUnreadable && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>Receipt unreadable:</strong> OCR could not confidently read the receipt. If submitted like this, it may be flagged for manual review.
              </div>
            )}
          </div>
        )}

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

        <div className="pt-2 border-t border-border/50 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Attachments <span className="text-rose-500">*</span></h4>
              <p className="text-xs text-muted-foreground mt-0.5">Invoice or payment proof — at least one required.</p>
            </div>
            <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full">
              {files.length}/2 uploaded
            </span>
          </div>

          <FileInputBox files={files} />
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
