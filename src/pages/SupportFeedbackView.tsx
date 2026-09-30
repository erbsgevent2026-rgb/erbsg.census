import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { SupportTicket, SupportCategory, SupportPriority, SupportStatus } from "../types";
import {
  LifeBuoy,
  Mail,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  User,
  Shield,
  Search,
  Filter,
  Eye,
  Loader2,
  X,
  ExternalLink,
  ChevronRight,
  MessageCircle,
  Check,
  Tag,
  AlertTriangle
} from "lucide-react";

export const SupportFeedbackView: React.FC = () => {
  const { user, districts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters for Admin
  const [filterDistrict, setFilterDistrict] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Submit Ticket Form State (District Users or Admin)
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [category, setCategory] = useState<SupportCategory>("SUPPORT");
  const [priority, setPriority] = useState<SupportPriority>("NORMAL");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Admin Review / Reply Modal State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [newStatus, setNewStatus] = useState<SupportStatus>("IN_PROGRESS");
  const [updating, setUpdating] = useState<boolean>(false);

  // Detail View Modal for District User
  const [viewTicket, setViewTicket] = useState<SupportTicket | null>(null);

  const officialEmail = "erbsgevent.2026@gmail.com";

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await api.getSupportTickets({
        district_id: isStateAdmin ? filterDistrict : user?.districtId || undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        search: searchQuery.trim() || undefined,
      });
      setTickets(data);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load support requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterDistrict, filterStatus, filterCategory, syncEventTimestamp]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const res = await api.submitSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        category,
        priority,
        district_id: user?.districtId || (isStateAdmin && districts[0]?.id ? districts[0].id : "dist_cen")
      });

      setShowSubmitModal(false);
      setSubject("");
      setMessage("");
      setCategory("SUPPORT");
      setPriority("NORMAL");

      setStatusMessage({
        type: "success",
        text: res.message || "Your support request has been submitted successfully."
      });

      await fetchTickets();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to submit support request."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReplyModal = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.admin_reply || "");
    setNewStatus(ticket.status === "NEW" ? "IN_PROGRESS" : ticket.status);
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setUpdating(true);
      setStatusMessage(null);

      const res = await api.updateSupportTicket(selectedTicket.id, {
        status: newStatus,
        admin_reply: replyText.trim(),
      });

      setSelectedTicket(null);
      setStatusMessage({
        type: "success",
        text: res.message || "Support ticket updated successfully."
      });

      await fetchTickets();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to update support ticket."
      });
    } finally {
      setUpdating(false);
    }
  };

  // Filtered tickets in memory
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchDistrict = filterDistrict === "ALL" || t.district_id === filterDistrict;
      const matchStatus = filterStatus === "ALL" || t.status === filterStatus;
      const matchCategory = filterCategory === "ALL" || t.category === filterCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.district_name.toLowerCase().includes(q) ||
        t.user_name.toLowerCase().includes(q) ||
        t.bsg_id.toLowerCase().includes(q);

      return matchDistrict && matchStatus && matchCategory && matchSearch;
    });
  }, [tickets, filterDistrict, filterStatus, filterCategory, searchQuery]);

  // Statistics for Admin
  const stats = useMemo(() => {
    const total = tickets.length;
    const newCount = tickets.filter((t) => t.status === "NEW").length;
    const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;
    return { total, newCount, inProgressCount, resolvedCount };
  }, [tickets]);

  // Pre-filled mailto link for direct support
  const districtName = user?.districtName || "Eastern Railway District";
  const mailtoSubject = encodeURIComponent(`[ERBSG Support Request] ${districtName} - ${user?.bsgId || ""}`);
  const mailtoBody = encodeURIComponent(
    `Official ERBSG Data Control Portal Support Request\n\nDistrict: ${districtName}\nSubmitter: ${user?.name || ""}\nBSG ID: ${user?.bsgId || ""}\nDate: ${new Date().toLocaleDateString()}\n\nDetails of Issue / Support Request:\n`
  );
  const mailtoUrl = `mailto:${officialEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  const renderStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case "NEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
            <Clock className="w-3 h-3" /> New / Awaiting Review
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
            <Loader2 className="w-3 h-3 animate-spin text-purple-600" /> In Progress
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
        );
      default:
        return null;
    }
  };

  const renderCategoryBadge = (cat: SupportCategory) => {
    switch (cat) {
      case "SUPPORT":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Support Request</span>;
      case "ISSUE":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Technical Issue</span>;
      case "DATA_AMENDMENT":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Data Amendment</span>;
      case "FEEDBACK":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">Feedback</span>;
      default:
        return null;
    }
  };

  const renderPriorityBadge = (p: SupportPriority) => {
    switch (p) {
      case "URGENT":
        return <span className="text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400">● Urgent</span>;
      case "HIGH":
        return <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">● High</span>;
      case "NORMAL":
        return <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Normal</span>;
      case "LOW":
        return <span className="text-[10px] text-slate-400">Low</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Support & Feedback Desk
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                Official Helpdesk
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isStateAdmin
                ? "Review and resolve support tickets, data amendment requests, and feedback submitted by district users"
                : "Submit support tickets, report technical issues, request census corrections, or contact Eastern Railway State HQ"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={mailtoUrl}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="Open email client with pre-filled support address"
          >
            <Mail className="w-4 h-4 text-blue-600" />
            <span>Contact Support ({officialEmail})</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {!isStateAdmin && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Submit New Request</span>
            </button>
          )}
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

      {/* Official Direct Support Email Banner */}
      <div className="bg-linear-to-r from-blue-900 to-indigo-950 text-white p-5 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-300" />
            <span className="font-extrabold text-sm sm:text-base">
              Official Eastern Railway State Support Contact
            </span>
          </div>
          <p className="text-xs text-blue-200/90 max-w-xl">
            For direct inquiries, formal communication, or emergency escalation, reach the State Administration directly at:{" "}
            <a
              href={`mailto:${officialEmail}`}
              className="text-amber-300 font-bold underline hover:text-amber-200"
            >
              {officialEmail}
            </a>
          </p>
        </div>

        <a
          href={mailtoUrl}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg shadow-sm transition shrink-0 cursor-pointer"
        >
          <Mail className="w-4 h-4 text-slate-950" />
          <span>Email State HQ</span>
        </a>
      </div>

      {/* Admin Metric Cards */}
      {isStateAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Requests
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {stats.total}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Across all 9 districts</p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              New / Awaiting Review
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-100 mt-1">
              {stats.newCount}
            </div>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1">Needs admin response</p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              In Progress
            </span>
            <div className="text-2xl sm:text-3xl font-black text-purple-900 dark:text-purple-100 mt-1">
              {stats.inProgressCount}
            </div>
            <p className="text-[10px] text-purple-700/80 dark:text-purple-400/80 mt-1">Currently being processed</p>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Resolved Tickets
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
              {stats.resolvedCount}
            </div>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">Successfully completed</p>
          </div>
        </div>
      )}

      {/* Tickets List Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {/* Card Header & Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isStateAdmin ? "District Support & Feedback Submissions" : `Support Requests for ${districtName}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isStateAdmin
                  ? "Manage, review, and reply to all support tickets and feedback submitted by district users"
                  : "Track the status and official State Headquarters response for your district's requests"}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {filteredTickets.length} {filteredTickets.length === 1 ? "Request" : "Requests"} Found
            </span>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by subject, message, BSG ID, or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isStateAdmin && (
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Districts (9)</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New / Awaiting Review</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="SUPPORT">Support Request</option>
              <option value="ISSUE">Technical Issue</option>
              <option value="DATA_AMENDMENT">Data Amendment</option>
              <option value="FEEDBACK">Feedback</option>
            </select>
          </div>
        </div>

        {/* Tickets Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Subject / Request</th>
                {isStateAdmin && <th className="px-4 py-3">District</th>}
                <th className="px-4 py-3">Submitter</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted At</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={isStateAdmin ? 7 : 6} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={isStateAdmin ? 7 : 6} className="px-4 py-10 text-center text-slate-500">
                    <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No support requests found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition">
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white truncate block">
                          {t.subject}
                        </span>
                        {renderPriorityBadge(t.priority)}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {t.message}
                      </p>
                      {t.admin_reply && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-400 font-semibold">
                          <MessageCircle className="w-3 h-3" />
                          <span>Admin Response Available</span>
                        </div>
                      )}
                    </td>

                    {isStateAdmin && (
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold">
                          <Building2 className="w-3 h-3" />
                          {t.district_name}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {t.user_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {t.bsg_id}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {renderCategoryBadge(t.category)}
                    </td>

                    <td className="px-4 py-3.5">
                      {renderStatusBadge(t.status)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {isStateAdmin ? (
                        <button
                          onClick={() => handleOpenReplyModal(t)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                        >
                          Review & Reply
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewTicket(t)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUBMIT TICKET MODAL (District User Only)                  */}
      {/* ======================================================== */}
      {showSubmitModal && !isStateAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-lg">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Submit Support Request / Feedback
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct submission from {districtName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Request Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportCategory)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="SUPPORT">General Support</option>
                    <option value="DATA_AMENDMENT">Census Data Amendment</option>
                    <option value="ISSUE">Technical Issue / Bug</option>
                    <option value="FEEDBACK">Feedback & Suggestion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as SupportPriority)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Request to correct Cub Pack count in Annual Census Return"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Message / Request <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Please provide full details of your request, including relevant financial year, affected sections, or steps to reproduce if reporting a technical issue..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Submitter Details (Auto-Associated):</span>
                <p>District: <strong>{districtName}</strong> • Submitter: <strong>{user?.name}</strong> • BSG ID: <strong>{user?.bsgId}</strong></p>
                <p>Support Notification Email: <strong>{officialEmail}</strong></p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADMIN REVIEW & REPLY MODAL                               */}
      {/* ======================================================== */}
      {selectedTicket && isStateAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400">
                  Ticket #{selectedTicket.id}
                </span>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {selectedTicket.subject}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Information Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-blue-700 dark:text-blue-300">
                  {selectedTicket.district_name}
                </span>
                <span className="text-slate-400 text-[11px]">
                  Submitted on {new Date(selectedTicket.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                Submitter: <strong>{selectedTicket.user_name}</strong> (BSG ID: {selectedTicket.bsg_id}) • Email: {selectedTicket.user_email || "N/A"}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-slate-800 dark:text-slate-200 font-medium bg-white dark:bg-slate-900 p-3 rounded-lg">
                {selectedTicket.message}
              </div>
            </div>

            <form onSubmit={handleUpdateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Update Ticket Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as SupportStatus)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="NEW">New / Awaiting Review</option>
                  <option value="IN_PROGRESS">In Progress (Under Review / Processing)</option>
                  <option value="RESOLVED">Resolved (Completed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  State Administrator Response / Reply Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter response or instructions for the district user. This will be visible on the district panel and sent via email notification..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Status & Send Reply</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DISTRICT USER VIEW TICKET DETAILS MODAL                  */}
      {/* ======================================================== */}
      {viewTicket && !isStateAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400">
                  Ticket #{viewTicket.id}
                </span>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  {viewTicket.subject}
                </h3>
              </div>
              <button
                onClick={() => setViewTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                {renderStatusBadge(viewTicket.status)}
                {renderCategoryBadge(viewTicket.category)}
              </div>
              <span className="text-slate-400 text-[11px]">
                {new Date(viewTicket.created_at).toLocaleString()}
              </span>
            </div>

            {/* User Message */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Your Submitted Request:
              </span>
              <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
                {viewTicket.message}
              </p>
            </div>

            {/* Admin Reply (if present) */}
            {viewTicket.admin_reply ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    State Administration Response:
                  </span>
                  {viewTicket.admin_replied_at && (
                    <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80">
                      {new Date(viewTicket.admin_replied_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-blue-950 dark:text-blue-200 whitespace-pre-wrap font-medium pt-1">
                  {viewTicket.admin_reply}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>State Administration has received your ticket and will provide a resolution response soon.</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewTicket(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
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
