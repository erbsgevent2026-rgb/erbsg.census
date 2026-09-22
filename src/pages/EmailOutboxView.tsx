import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { EmailLogRecord } from "../types";
import { exportToExcel } from "../utils/excelExport";
import { useAuth } from "../context/AuthContext";
import {
  Mail,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  Eye,
  X
} from "lucide-react";

export const EmailOutboxView: React.FC = () => {
  const { syncEventTimestamp } = useAuth();
  const [emails, setEmails] = useState<EmailLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeEmail, setActiveEmail] = useState<EmailLogRecord | null>(null);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const data = await api.getEmailLogs();
      setEmails(data);
    } catch (err) {
      console.error("Failed to load email logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [syncEventTimestamp]);

  const filteredEmails = emails.filter((em) => {
    return (
      searchQuery.trim() === "" ||
      em.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      em.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      em.body.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleExport = () => {
    const rows = filteredEmails.map((em, i) => ({
      "SL No": i + 1,
      "Timestamp": new Date(em.created_at).toLocaleString(),
      "Recipient": em.recipient_email,
      "BSG ID": em.bsg_id,
      "Subject": em.subject,
      "Status": em.status,
      "Body": em.body,
    }));
    exportToExcel(rows, `ERBSG_Email_Outbox_${new Date().toISOString().slice(0, 10)}`, "Email Outbox");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Notification Dispatcher
            </span>
            <span className="text-xs font-semibold text-slate-500">Official Outbox Logs</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            Email Notifications Outbox
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit trail of all automated portal communications, password resets, and statutory confirmations
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Outbox</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="relative w-80">
            <input
              type="text"
              placeholder="Search recipient, subject, content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            {emails.length} Dispatched Messages
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading outbox logs...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">No email records found.</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">TIMESTAMP</th>
                  <th className="px-4 py-3">RECIPIENT</th>
                  <th className="px-4 py-3">SUBJECT</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {filteredEmails.map((em) => (
                  <tr key={em.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(em.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div>{em.recipient_name}</div>
                      <div className="text-[11px] text-slate-500">{em.recipient_email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {em.subject}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> {em.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setActiveEmail(em)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        title="View Email Message"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Email Content Modal */}
      {activeEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">
                  Notification Dispatch
                </span>
                <h3 className="text-base font-bold">{activeEmail.subject}</h3>
              </div>
              <button
                onClick={() => setActiveEmail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold">Recipient:</span>{" "}
                <span className="font-bold">{activeEmail.recipient_email}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">Dispatched At:</span>{" "}
                <span className="font-mono">{new Date(activeEmail.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold">Delivery Status:</span>{" "}
                <span className="text-emerald-600 font-bold">{activeEmail.status}</span>
              </div>

              <div className="pt-2">
                <span className="text-slate-400 font-semibold block mb-1">Message Body:</span>
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {activeEmail.body}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setActiveEmail(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
