import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "Approved":
        return {
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        };
      case "Rejected":
        return {
          bg: "bg-rose-100 text-rose-800 border-rose-200",
          icon: <XCircle className="w-3.5 h-3.5 mr-1" />
        };
      default:
        return {
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          icon: <Clock className="w-3.5 h-3.5 mr-1" />
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
      styles.bg,
      className
    )}>
      {styles.icon}
      {status}
    </span>
  );
}
