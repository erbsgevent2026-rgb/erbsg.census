import React from "react";
import { useAuth } from "../context/AuthContext";
import { useHealthCheck } from "../hooks/useHealthCheck";
import {
  LayoutDashboard,
  Building2,
  FileText,
  FileSpreadsheet,
  FileCheck,
  PhoneCall,
  UserCheck,
  ShieldCheck,
  UserCog,
  History,
  Mail,
  User as UserIcon,
  LogOut,
  X
} from "lucide-react";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const { status: healthStatus } = useHealthCheck();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const primaryNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "basic-details", label: "Basic Details", icon: Building2 },
    { id: "annual-reports", label: "Annual Report", icon: FileText },
    { id: "census-reports", label: "Census Report", icon: FileSpreadsheet },
    { id: "audited-statements", label: "Audited Statement", icon: FileCheck },
    { id: "official-contacts", label: "Official Contact Person", icon: PhoneCall },
    { id: "members", label: "Members", icon: UserCheck },
  ];

  const adminNavItems = [
    { id: "district-management", label: "District Management", icon: ShieldCheck },
    { id: "district-users", label: "District Users", icon: UserCog },
    { id: "audit-logs", label: "Audit Logs", icon: History },
    { id: "email-outbox", label: "Email Outbox", icon: Mail },
  ];

  const handleSelect = (viewId: string) => {
    onNavigate(viewId);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/erbsg-official-logo.svg"
            alt="Eastern Railway Bharat Scouts and Guides"
            className="w-10 h-10 object-contain rounded-full shadow-lg shadow-blue-950/50 shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-white tracking-wider">ERBSG</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-400/30">
                PORTAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-tight truncate">
              Eastern Railway State
            </p>
          </div>
        </div>

        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Link List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Main Operations
          </p>
          <div className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-amber-400 text-slate-950 shadow-md font-bold shadow-amber-400/20"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isStateAdmin && (
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-2">
              State Administration
            </p>
            <div className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-amber-400 text-slate-950 shadow-md font-bold shadow-amber-400/20"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-950" : "text-amber-400/70"}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Server Health Status Indicator */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {healthStatus === "connected" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                healthStatus === "connected"
                  ? "bg-emerald-500"
                  : healthStatus === "connecting"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            ></span>
          </span>
          <span className="text-[11px] font-medium text-slate-300">
            {healthStatus === "connected"
              ? "Server Connected"
              : healthStatus === "connecting"
              ? "Checking Server..."
              : "Server Disconnected"}
          </span>
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            healthStatus === "connected"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : healthStatus === "connecting"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {healthStatus === "connected" ? "Active" : healthStatus === "connecting" ? "Sync" : "Offline"}
        </span>
      </div>

      {/* User Section / Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-1">
        <button
          onClick={() => handleSelect("profile")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentView === "profile"
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <UserIcon className="w-4 h-4 text-slate-400" />
          <div className="flex-1 text-left truncate">
            <p className="truncate font-semibold leading-tight text-white">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.bsgId}</p>
          </div>
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 border-r border-slate-800 z-40">
        {navContent}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
