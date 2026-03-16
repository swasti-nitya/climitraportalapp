import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/use-auth";
import { useChangePassword } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, User as UserIcon, Mail, Shield, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { mutateAsync: changePassword, isPending } = useChangePassword();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive"
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      
      toast({
        title: "Success",
        description: "Password updated successfully"
      });
      
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Redirect back to the correct portal
      const currentPortal = sessionStorage.getItem('currentPortal') || 'expenses';
      const redirectPath = currentPortal === 'leaves' ? '/leaves' : '/expenses';
      navigate(redirectPath);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive"
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2FBF5] pb-20">
      <div className="bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 pt-8 pb-12 rounded-b-[2rem] shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
        <p className="text-primary-foreground/90 text-sm">Manage your account settings</p>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        {/* User Info Card */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Account Information
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{user.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium text-foreground">{user.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Joining Date</p>
                <p className="text-sm font-medium text-foreground">
                  {user.joiningDate ? format(new Date(user.joiningDate), "MMM d, yyyy") : "Not set"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                placeholder="Enter current password"
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Enter new password (min 6 characters)"
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
