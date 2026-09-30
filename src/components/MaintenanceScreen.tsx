import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Wrench,
  ShieldCheck,
  RefreshCw,
  LogOut,
  AlertTriangle,
  Building2,
  Clock,
  CheckCircle2,
  Lock
} from "lucide-react";

export const MaintenanceScreen: React.FC = () => {
  const { user, logout, refreshMaintenanceMode, maintenanceMessage } = useAuth();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>("Just now");

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshMaintenanceMode();
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      // Ignore
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-between text-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <img
            src="/erbsg-official-logo.svg"
            alt="Eastern Railway Bharat Scouts and Guides"
            className="w-11 h-11 object-contain rounded-full shadow-lg border border-white/20 bg-white/5 p-0.5"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-wide text-white">ERBSG</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SYSTEM NOTICE
              </span>
            </div>
            <p className="text-xs text-blue-200/80 font-medium">
              Eastern Railway Bharat Scouts and Guides • Data Control Portal
            </p>
          </div>
        </div>

        {user && (
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition border border-white/10"
            title="Sign out of current account"
          >
            <LogOut className="w-3.5 h-3.5 text-red-300" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        )}
      </header>

      {/* Main Content Card */}
      <main className="w-full max-w-2xl mx-auto my-auto py-8 relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/60 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Animated Icon Badge */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Wrench className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-slate-900"></span>
            </span>
          </div>

          {/* Titles */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Website Under Maintenance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Website Under Maintenance
            </h1>
            <p className="text-base sm:text-lg text-amber-200 font-semibold max-w-xl mx-auto">
              {maintenanceMessage || "ERBSG Data Control Portal is currently under maintenance. Please try again later."}
            </p>
          </div>

          {/* Detailed Reassurance Box */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 sm:p-5 text-left text-xs sm:text-sm text-slate-300 space-y-3">
            <p className="leading-relaxed">
              The Eastern Railway Bharat Scouts and Guides State Headquarters is performing routine system updates, statutory compliance alignments, and database maintenance. District User operations are temporarily suspended to maintain data consistency.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-700/60 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>All District data is safe &amp; intact</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-400" />
                <span>State Admin oversight active</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Auto-checks every few seconds</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
                <span>Eastern Railway State HQ</span>
              </div>
            </div>
          </div>

          {/* User Context & Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Checking Portal..." : "Check Portal Status"}</span>
            </button>

            {user && (
              <button
                onClick={logout}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition border border-slate-700 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Sign Out ({user.bsgId})</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            Last checked: <span className="text-slate-300 font-mono">{lastChecked}</span> • The dashboard will reopen automatically once maintenance is deactivated.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto pt-4 border-t border-white/10 text-center text-xs text-slate-400 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>
          © {new Date().getFullYear()} Eastern Railway Bharat Scouts and Guides • State Headquarters
        </p>
        <p className="text-[11px] text-slate-400">
          Official Support: <span className="text-blue-300 font-mono">erbsgevent2026@gmail.com</span>
        </p>
      </footer>
    </div>
  );
};
