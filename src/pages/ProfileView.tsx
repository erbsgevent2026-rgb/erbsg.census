import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  User,
  Shield,
  KeyRound,
  Check,
  X,
  AlertCircle,
  Building2,
  Mail,
  Lock,
  Smartphone,
  CheckCircle2,
  Loader2
} from "lucide-react";

export const ProfileView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);
  const [passStatus, setPassStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password checklist
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoadingPass(true);
    setPassStatus(null);

    try {
      const res = await api.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPassStatus({
        type: "success",
        text: res.message || "Password updated successfully!",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshUser();
    } catch (err: any) {
      setPassStatus({
        type: "error",
        text: err.message || "Failed to update password. Please check current password.",
      });
    } finally {
      setLoadingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{user?.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {user?.role === "STATE_ADMIN" ? "STATE ADMIN" : "DISTRICT USER"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              BSG ID: {user?.bsgId} • {user?.districtName || "Eastern Railway State Headquarters"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Details & Security Attributes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Official Profile Credentials</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Official Email</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.role === "STATE_ADMIN" ? "erbsgevent2026@gmail.com" : user?.email}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Jurisdiction</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {user?.role === "STATE_ADMIN"
                  ? "Eastern Railway State (All 9 Districts)"
                  : user?.districtName || "District User"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Role Authority</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {user?.role === "STATE_ADMIN"
                  ? "State Administrator • Limited Access"
                  : "District Officer • Strict District Data Isolation"}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Two-Factor Authentication (MFA)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Require secondary 6-digit OTP during sign in
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>Update Account Password</span>
          </h3>

          {passStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
                passStatus.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
              }`}
            >
              {passStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{passStatus.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            {/* Checklist */}
            <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-1 text-[10px]">
              <span className={checks.length ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                ✓ 8+ Characters
              </span>
              <span className={checks.upper ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                ✓ Uppercase
              </span>
              <span className={checks.lower ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                ✓ Lowercase
              </span>
              <span className={checks.number ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                ✓ Number
              </span>
              <span className={checks.special ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                ✓ Special char
              </span>
              <span className={checks.match ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                ✓ Passwords match
              </span>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || loadingPass}
              className="w-full py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              {loadingPass ? "Updating Password..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
