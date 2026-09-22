import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { OfficialMember } from "../types";
import { exportToExcel } from "../utils/excelExport";
import {
  Users,
  Plus,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  Shield,
  Loader2,
  X
} from "lucide-react";

interface OfficialsViewProps {
  mode: "state" | "district";
}

export const OfficialsView: React.FC<OfficialsViewProps> = ({ mode }) => {
  const { user, selectedYear, availableYears, districts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const [targetDistrictId, setTargetDistrictId] = useState<string>(
    mode === "state" ? "dist_cen" : user?.districtId || "dist_cen"
  );

  useEffect(() => {
    if (mode === "district" && user?.districtId) {
      setTargetDistrictId(user.districtId);
    }
  }, [mode, user]);

  const [officials, setOfficials] = useState<OfficialMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State for Add
  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: "",
    designation: "",
    bsg_uid: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOfficials = async () => {
    try {
      setLoading(true);
      if (mode === "state") {
        const data = await api.getStateMembers(selectedYear);
        setOfficials(data);
      } else {
        const data = await api.getDistrictMembers(targetDistrictId, selectedYear);
        setOfficials(data);
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load officials." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficials();
  }, [mode, targetDistrictId, selectedYear, syncEventTimestamp]);

  const filteredOfficials = useMemo(() => {
    return officials.filter((o) => {
      return (
        searchQuery.trim() === "" ||
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.bsg_uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.email && o.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.phone && o.phone.includes(searchQuery))
      );
    });
  }, [officials, searchQuery]);

  const handleOpenAdd = () => {
    setModalForm({
      name: "",
      designation: "",
      bsg_uid: `BSG-${mode === "state" ? "STATE" : "DIST"}-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: "",
      email: "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      if (mode === "state") {
        await api.addStateMember({
          name: modalForm.name,
          designation: modalForm.designation,
          bsg_uid: modalForm.bsg_uid,
          phone: modalForm.phone,
          email: modalForm.email,
          year_id: selectedYear,
        });
      } else {
        await api.addDistrictMember({
          district_id: targetDistrictId,
          name: modalForm.name,
          designation: modalForm.designation,
          bsg_uid: modalForm.bsg_uid,
          phone: modalForm.phone,
          email: modalForm.email,
          year_id: selectedYear,
        });
      }

      setStatusMessage({ type: "success", text: "Official personnel added successfully." });
      setModalOpen(false);
      await fetchOfficials();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save official." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    try {
      if (mode === "state") {
        await api.deleteStateMember(id);
      } else {
        await api.deleteDistrictMember(id);
      }
      setStatusMessage({ type: "success", text: `Official ${name} removed.` });
      await fetchOfficials();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to delete official." });
    }
  };

  const handleExport = () => {
    const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;
    const districtObj = districts.find((d) => d.id === targetDistrictId);
    const scopeLabel = mode === "state" ? "Eastern Railway State" : districtObj?.name || "District";

    const rows = filteredOfficials.map((o, i) => ({
      "SL No": i + 1,
      "Name": o.name,
      "Designation": o.designation,
      "BSG UID": o.bsg_uid,
      "Mobile Number": o.phone || "—",
      "Email Address": o.email || "—",
      "Jurisdiction": scopeLabel,
      "Session": yearLabel,
    }));

    exportToExcel(
      rows,
      `ERBSG_${mode === "state" ? "State" : "District"}_Officials_${yearLabel}`,
      "Officials"
    );
  };

  const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;
  const districtObj = districts.find((d) => d.id === targetDistrictId);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {mode === "state" ? "State Leadership" : "District Office Bearers"}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {mode === "state" ? "Eastern Railway State Council" : `${districtObj?.name || "District"} Division`} • Session {yearLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {mode === "state" ? "State Officials & Office Bearers" : "District Council & Committee Officials"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === "state"
              ? "Official list of state commissioners, presidents, and secretaries for Eastern Railway"
              : "Registered office bearers, district commissioners, and executive committee members"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {mode === "district" && isStateAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              <select
                value={targetDistrictId}
                onChange={(e) => setTargetDistrictId(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id} className="text-slate-900 bg-white dark:bg-slate-800">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>

          {(mode === "district" || isStateAdmin) && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Official</span>
            </button>
          )}
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

      {/* Officials Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search by name, designation, BSG UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            {filteredOfficials.length} Registered Officials
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading officials...</div>
          ) : filteredOfficials.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No officials found. Click "Add Official" to register new members.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">NAME & DESIGNATION</th>
                  <th className="px-4 py-3">BSG UID</th>
                  <th className="px-4 py-3">PHONE</th>
                  <th className="px-4 py-3">EMAIL</th>
                  <th className="px-4 py-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {filteredOfficials.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">{o.name}</div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        {o.designation}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                      {o.bsg_uid}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {o.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {o.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(o.id, o.name)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded"
                        title="Remove official"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold">
                Add Official ({mode === "state" ? "State Council" : "District Council"})
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={modalForm.name}
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                  placeholder="e.g. Sri Rajesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Official Designation</label>
                <input
                  type="text"
                  required
                  value={modalForm.designation}
                  onChange={(e) => setModalForm({ ...modalForm, designation: e.target.value })}
                  placeholder="e.g. District Commissioner / State Secretary"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">BSG Unique Identifier</label>
                <input
                  type="text"
                  required
                  value={modalForm.bsg_uid}
                  onChange={(e) => setModalForm({ ...modalForm, bsg_uid: e.target.value })}
                  placeholder="BSG-ER-XXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Mobile Contact</label>
                <input
                  type="text"
                  value={modalForm.phone}
                  onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={modalForm.email}
                  onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                  placeholder="official@erbsg.org"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-sm"
                >
                  {submitting ? "Adding..." : "Add Official"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
