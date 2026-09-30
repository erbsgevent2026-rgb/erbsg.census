import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { SessionSummaryRecord } from "../types";
import {
  Calendar,
  PlusCircle,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  Users,
  AlertCircle,
  Loader2,
  ArrowRight,
  Star,
  RefreshCw,
  Sparkles,
  FileCheck,
  Building2,
  Lock,
  X
} from "lucide-react";

interface SessionManagementViewProps {
  onNavigate: (view: string) => void;
}

export const SessionManagementView: React.FC<SessionManagementViewProps> = ({ onNavigate }) => {
  const { user, selectedYear, setSelectedYear, availableYears, refreshYears, syncEventTimestamp } = useAuth();
  const [sessions, setSessions] = useState<SessionSummaryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newSessionLabel, setNewSessionLabel] = useState<string>("");
  const [setAsCurrent, setSetAsCurrent] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  // Active switch loading
  const [switchingYearId, setSwitchingYearId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await api.getSessionsSummary();
      setSessions(data);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load session summary." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [syncEventTimestamp]);

  // Compute next recommended session year (e.g. highest end_year -> next year)
  const computeNextSession = (): string => {
    let maxEndYear = 2027;
    for (const s of availableYears) {
      const parts = s.label.split("-");
      if (parts.length === 2) {
        const eYear = parseInt(parts[1]);
        if (!isNaN(eYear) && eYear > maxEndYear) {
          maxEndYear = eYear;
        }
      }
    }
    return `${maxEndYear}-${maxEndYear + 1}`;
  };

  const handleOpenCreateModal = (suggestedLabel?: string) => {
    setNewSessionLabel(suggestedLabel || computeNextSession());
    setSetAsCurrent(false);
    setShowCreateModal(true);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionLabel.trim()) return;

    try {
      setCreating(true);
      setStatusMessage(null);

      const res = await api.createSessionYear({
        label: newSessionLabel.trim(),
        set_as_current: setAsCurrent,
      });

      setShowCreateModal(false);
      setStatusMessage({
        type: "success",
        text: res.message || `Session Year ${newSessionLabel} created and initialized for all 9 districts.`
      });

      await refreshYears();
      await fetchSessions();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to create session year."
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSetActiveSession = async (yearId: string, label: string) => {
    try {
      setSwitchingYearId(yearId);
      setStatusMessage(null);

      const res = await api.setActiveSessionYear(yearId);
      setStatusMessage({
        type: "success",
        text: res.message || `Session Year ${label} is now set as the active official session.`
      });

      await refreshYears();
      await fetchSessions();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to set active session."
      });
    } finally {
      setSwitchingYearId(null);
    }
  };

  const handleSelectAndNavigate = (yearId: string) => {
    setSelectedYear(yearId);
    onNavigate("dashboard");
  };

  const currentActiveSession = availableYears.find((y) => y.is_current === 1);
  const nextRecommended = computeNextSession();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Session Year Management
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                Multi-Session Isolated
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Create and manage annual session cycles for all Eastern Railway districts with guaranteed historical data preservation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Session Year</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Sessions
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {availableYears.length}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Managed session years in portal</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" /> Active Session
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
            {currentActiveSession?.label || "2026-2027"}
          </div>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">Current official operational cycle</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Districts Initialized
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            9 of 9
          </div>
          <p className="text-[10px] text-slate-400 mt-1">All divisions & workshops synchronized</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Data Preservation
          </span>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-100 mt-1">
            100% Safe
          </div>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-1">Zero overwriting across sessions</p>
        </div>
      </div>

      {/* 1-Click Quick Create Banner */}
      <div className="bg-linear-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="font-extrabold text-sm sm:text-base">
              One-Click Next Session Provisioning
            </span>
          </div>
          <p className="text-xs text-blue-200/90 max-w-xl">
            Create the upcoming Session Year <strong>{nextRecommended}</strong> with a single click. It will automatically initialize base records across all 9 districts without altering any existing data.
          </p>
        </div>

        <button
          onClick={() => handleOpenCreateModal(nextRecommended)}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg shadow-sm transition shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-slate-950" />
          <span>Provision {nextRecommended}</span>
        </button>
      </div>

      {/* Sessions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Configured Session Years
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each session operates with independent, isolated data for Members, Statutory Documents, and Returns
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {availableYears.length} Sessions Available
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Session Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Registered Strength</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-center">Census Confirmed</th>
                <th className="px-4 py-3 text-center">Deadline</th>
                <th className="px-4 py-3 text-right">Management Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading session records...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No session years found.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const isCurrent = Boolean(s.is_current);
                  const isSelected = s.id === selectedYear;

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-750 transition ${
                        isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {s.label}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              <Star className="w-2.5 h-2.5 fill-emerald-500" /> Current Active
                            </span>
                          )}
                          {isSelected && !isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              Currently Viewing
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">ID: {s.id}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isCurrent
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}>
                          {isCurrent ? "Active Cycle" : "Historical Archive"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 dark:text-white">
                        {s.total_members ? s.total_members.toLocaleString() : "0"}
                        <span className="block text-[10px] font-normal text-slate-400">
                          Youth: {s.youth_members} • Staff: {s.professionals_staff}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">
                        {s.total_units || 0}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          s.confirmed_districts > 0
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                        }`}>
                          <FileCheck className="w-3 h-3" />
                          {s.confirmed_districts} of {s.total_districts} Districts
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                          {s.deadline_date ? new Date(s.deadline_date).toLocaleDateString() : "31 Jul"}
                        </span>
                        <span className={`text-[10px] font-bold uppercase ${
                          s.deadline_status === "OPEN"
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}>
                          {s.deadline_status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleSelectAndNavigate(s.id)}
                            className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Load all portal data for this session"
                          >
                            <span>View Data</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {!isCurrent && (
                            <button
                              onClick={() => handleSetActiveSession(s.id, s.label)}
                              disabled={switchingYearId === s.id}
                              className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Set as the default operational session for all users"
                            >
                              {switchingYearId === s.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Star className="w-3 h-3" />
                              )}
                              <span>Set Active</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Data Preservation Guarantee Card */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-sm">
          <Shield className="w-5 h-5 text-blue-600" />
          <span>Historical Data Isolation & Preservation Architecture</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="font-bold block text-slate-900 dark:text-white mb-1">
              1. Composite Partitioning
            </span>
            <span>
              All member figures, census returns, and statutory documents are indexed by <code className="text-blue-600 dark:text-blue-400 font-mono">(district_id, year_id)</code>. Data from one session cannot bleed into another.
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="font-bold block text-slate-900 dark:text-white mb-1">
              2. Immutable Historical Records
            </span>
            <span>
              Finalized and locked submissions in historical sessions (e.g. 2025–2026) remain locked and preserved permanently, even when new future sessions are created.
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="font-bold block text-slate-900 dark:text-white mb-1">
              3. Independent District Status
            </span>
            <span>
              Each district completes and finalizes their session returns independently. One district’s submission status never impacts any other division or workshop.
            </span>
          </div>
        </div>
      </div>

      {/* Create New Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                    Create New Session Year
                  </h3>
                  <p className="text-xs text-slate-500">
                    Provisions session for all 9 districts simultaneously
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Session Year Label (YYYY-YYYY)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2027-2028"
                  value={newSessionLabel}
                  onChange={(e) => setNewSessionLabel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Consecutive April–March financial years (e.g. 2027-2028, 2028-2029)
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <span className="font-bold block">Automatic District Provisioning:</span>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300">
                  Creating this session will automatically initialize deadlines, baseline member counts, and unit details for all 9 districts. All previous session data will remain untouched.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={setAsCurrent}
                  onChange={(e) => setSetAsCurrent(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>Set as Active / Current Session immediately upon creation</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Session...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Create Session Year</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
