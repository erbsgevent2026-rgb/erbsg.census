import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { DeadlineRecord } from "../types";
import { useAuth } from "../context/AuthContext";
import {
  CalendarDays,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar
} from "lucide-react";

export const DeadlinesView: React.FC = () => {
  const { availableYears, selectedYear, setSelectedYear, syncEventTimestamp } = useAuth();
  const [deadlines, setDeadlines] = useState<DeadlineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDeadlines = async () => {
    try {
      setLoading(true);
      const data = await api.getDeadlines();
      setDeadlines(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadlines();
  }, [syncEventTimestamp]);

  const handleUpdate = async (record: DeadlineRecord) => {
    setSavingId(record.id);
    setStatusMessage(null);
    try {
      await api.updateDeadline({
        year_id: record.year_id,
        deadline_date: record.deadline_date,
        status: record.status,
        notes: record.notes || null,
      });
      setStatusMessage({ type: "success", text: `Deadline for ${record.year_id} updated successfully.` });
      await fetchDeadlines();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save deadline." });
    } finally {
      setSavingId(null);
    }
  };

  const handleDateChange = (id: string, date: string) => {
    setDeadlines((prev) =>
      prev.map((d) => (d.id === id ? { ...d, deadline_date: date } : d))
    );
  };

  const handleStatusChange = (id: string, status: "OPEN" | "UPCOMING" | "EXPIRED") => {
    setDeadlines((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status } : d))
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              System Schedule
            </span>
            <span className="text-xs font-semibold text-slate-500">Academic Sessions Control</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Deadlines & Session Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure official cutoff dates and submission windows for district census and statutory filings
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Deadlines Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading session deadlines...</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">ACADEMIC SESSION</th>
                  <th className="px-4 py-3">DEADLINE DATE</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {deadlines.map((dl) => (
                  <tr key={dl.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {availableYears.find((y) => y.id === dl.year_id)?.label || dl.year_id}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={dl.deadline_date}
                        onChange={(e) => handleDateChange(dl.id, e.target.value)}
                        placeholder="e.g. 31-07-2026"
                        className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={dl.status}
                        onChange={(e) => handleStatusChange(dl.id, e.target.value as any)}
                        className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="UPCOMING">UPCOMING</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleUpdate(dl)}
                        disabled={savingId === dl.id}
                        className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-xs shadow-xs"
                      >
                        {savingId === dl.id ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
