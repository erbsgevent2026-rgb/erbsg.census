import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import { AuditLogRecord } from "../types";
import { exportToExcel } from "../utils/excelExport";
import { useAuth } from "../context/AuthContext";
import { getFirestoreAuditLogs } from "../services/firestoreAudit";
import {
  History,
  Search,
  Download,
  Filter,
  ShieldAlert,
  Clock,
  User,
  Building2,
  Calendar
} from "lucide-react";

export const AuditLogsView: React.FC = () => {
  const { districts, syncEventTimestamp } = useAuth();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterDistrict, setFilterDistrict] = useState("ALL");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [apiData, firestoreLogs] = await Promise.allSettled([
        api.getAuditLogs(),
        getFirestoreAuditLogs()
      ]);

      const mergedMap = new Map<string, AuditLogRecord>();

      if (apiData.status === "fulfilled" && Array.isArray(apiData.value)) {
        apiData.value.forEach((log) => mergedMap.set(log.id, log));
      }

      if (firestoreLogs.status === "fulfilled" && Array.isArray(firestoreLogs.value)) {
        firestoreLogs.value.forEach((log) => mergedMap.set(log.id, log));
      }

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setLogs(combined);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [syncEventTimestamp]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.bsg_id && log.bsg_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchAction = filterAction === "ALL" || log.action === filterAction;
      const matchDistrict = filterDistrict === "ALL" || log.district_id === filterDistrict;

      return matchSearch && matchAction && matchDistrict;
    });
  }, [logs, searchQuery, filterAction, filterDistrict]);

  const handleExport = () => {
    const rows = filteredLogs.map((l, i) => ({
      "SL No": i + 1,
      "Timestamp": new Date(l.timestamp).toLocaleString(),
      "BSG ID": l.bsg_id || "SYSTEM",
      "User Name": l.user_name || "System Automated",
      "Action": l.action,
      "Module": l.module,
      "District": l.district_name || "State Headquarters",
      "IP Address": l.ip_address || "Internal",
      "Details": l.details,
    }));
    exportToExcel(rows, `ERBSG_Audit_Logs_${new Date().toISOString().slice(0, 10)}`, "Audit Trail");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Security Compliance
            </span>
            <span className="text-xs font-semibold text-slate-500">Immutable Activity Records</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            System Audit Trail & Security Logs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cryptographically tracked audit logs recording logins, data edits, and statutory document operations
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Audit Trail</span>
        </button>
      </div>

      {/* Filter and Table Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by user, action, details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN_FAILED</option>
              <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
              <option value="PASSWORD_RESET_REQUEST">PASSWORD_RESET_REQUEST</option>
              <option value="ADMIN_RESET_PASSWORD">ADMIN_RESET_PASSWORD</option>
              <option value="UPDATE_MEMBERS_DATA">UPDATE_MEMBERS_DATA</option>
              <option value="UPLOAD_ANNUAL_REPORT">UPLOAD_ANNUAL_REPORT</option>
              <option value="UPLOAD_AUDITED_STATEMENT">UPLOAD_AUDITED_STATEMENT</option>
            </select>

            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value="ALL">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading audit trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No audit records found matching current criteria.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5">TIMESTAMP</th>
                  <th className="px-3 py-2.5">USER / BSG ID</th>
                  <th className="px-3 py-2.5">ACTION</th>
                  <th className="px-3 py-2.5">MODULE</th>
                  <th className="px-3 py-2.5">DISTRICT</th>
                  <th className="px-3 py-2.5">IP</th>
                  <th className="px-3 py-2.5">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="px-3 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {l.user_name || "System"}
                      </div>
                      <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                        {l.bsg_id || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.action.includes("SUCCESS") ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                        l.action.includes("FAILED") ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                        l.action.includes("PASSWORD") ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        l.action.includes("UPLOAD") ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                        "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-semibold">
                      {l.module}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {l.district_name || "State Headquarters"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">
                      {l.ip_address || "127.0.0.1"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={l.details}>
                      {l.details}
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
