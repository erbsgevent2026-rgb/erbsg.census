import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, setStoredToken } from "../services/api";
import { Shield, KeyRound, Check, X, AlertCircle, Loader2 } from "lucide-react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  isFirstLogin?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  isFirstLogin = false,
  onSuccess,
  onCancel,
}) => {
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time password complexity checklist
  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const isFormValid =
    currentPassword.length > 0 &&
    checks.length &&
    checks.upper &&
    checks.lower &&
    checks.number &&
    checks.special &&
    checks.match;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.token) {
        setStoredToken(res.token);
      }
      setSuccess(res.message || "Password changed successfully!");
      await refreshUser();

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center relative">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/20">
            <Shield className="w-6 h-6 text-amber-300" />
          </div>
          <h2 className="text-lg font-bold">
            {isFirstLogin ? "Welcome to ERBSG Data Control Portal" : "Change Account Password"}
          </h2>
          <p className="text-xs text-blue-100 mt-1 max-w-xs mx-auto">
            {isFirstLogin
              ? "For security, please change your default password before accessing your district dashboard."
              : "Ensure your account remains safe with an official high-complexity password."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{success} Redirecting to dashboard...</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current / Default Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={isFirstLogin ? "Enter default password (Test@1234)" : "Enter current password"}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create strong new password"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Real-time complexity requirements */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password Requirements:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <span className={`flex items-center gap-1.5 ${checks.length ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {checks.length ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} At least 8 characters
              </span>
              <span className={`flex items-center gap-1.5 ${checks.upper ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {checks.upper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} One uppercase (A-Z)
              </span>
              <span className={`flex items-center gap-1.5 ${checks.lower ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {checks.lower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} One lowercase (a-z)
              </span>
              <span className={`flex items-center gap-1.5 ${checks.number ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {checks.number ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} One number (0-9)
              </span>
              <span className={`flex items-center gap-1.5 ${checks.special ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {checks.special ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Special character (!@#$)
              </span>
              <span className={`flex items-center gap-1.5 ${checks.match ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {checks.match ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Passwords match
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            {!isFirstLogin && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Save New Password & Continue</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
