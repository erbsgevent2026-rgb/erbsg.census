import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Menu,
  LogOut,
  User,
  Shield,
  RefreshCw,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown
} from "lucide-react";

interface HeaderProps {
  onOpenMobileNav: () => void;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileNav, onNavigate }) => {
  const { user, logout, selectedYear, setSelectedYear, availableYears, syncEventTimestamp } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Hamburger + Welcome Banner */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <img
            src="/erbsg-official-logo.svg"
            alt="Eastern Railway Bharat Scouts and Guides"
            className="w-8 h-8 object-contain rounded-full shrink-0 shadow-sm"
          />

          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 leading-none">
              Welcome
            </span>
            <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
              EASTERN RAILWAY BHARAT SCOUTS AND GUIDES
            </h1>
          </div>
        </div>

        {/* Center: Portal Name (hidden on small mobile, visible on tablet/desktop) */}
        <div className="hidden md:flex flex-col items-center text-center">
          <span className="text-sm lg:text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            Data Control Portal
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Synchronized • Eastern Railway State</span>
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Year Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mr-1.5 shrink-0" />
            <span className="hidden xl:inline text-slate-500 dark:text-slate-400 mr-1 text-[11px]">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              aria-label="Select session year"
            >
              {availableYears.map((yr) => (
                <option key={yr.id} value={yr.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {yr.label}
                </option>
              ))}
            </select>
          </div>

          {/* User Role Badge */}
          {user && (
            <div className="hidden sm:flex flex-col text-right">
              {user.role === "STATE_ADMIN" ? (
                <>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center justify-end gap-1">
                    <Shield className="w-3 h-3 text-blue-600" /> STATE ADMIN
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    EASTERN RAILWAY
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-end gap-1">
                    <Building2 className="w-3 h-3 text-emerald-600" /> {user.districtName || "DISTRICT"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    BSG ID: {user.bsgId}
                  </span>
                </>
              )}
            </div>
          )}

          {/* User Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-1.5 p-1 rounded-full border-2 border-blue-600 hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-800 transition"
              aria-label="User profile menu"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block mr-1" />
            </button>

            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 text-xs"
                onMouseLeave={() => setProfileDropdownOpen(false)}
              >
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    <span>{user?.role === "STATE_ADMIN" ? "State Administrator" : "District Officer"}</span>
                    {user?.districtName && <span>• {user.districtName}</span>}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onNavigate("profile");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    <span>Profile & Security</span>
                  </button>

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
