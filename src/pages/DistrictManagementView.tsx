import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { District } from "../types";
import { exportToExcel } from "../utils/excelExport";
import { updateDistrictFirestore } from "../services/firestoreData";
import {
  ShieldCheck,
  Building2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Download,
  Power,
  Users,
  Search,
  Loader2,
  X
} from "lucide-react";

export const DistrictManagementView: React.FC = () => {
  const { user, districts, refreshDistricts, selectedYear, syncEventTimestamp } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Modal State
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });
  const [saving, setSaving] = useState(false);

  const fetchDistrictStats = async () => {
    if (!user || user.role !== "STATE_ADMIN") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await api.getDashboardStats(selectedYear);
      if (data && data.districtBreakdown) {
        setStats(data.districtBreakdown);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistrictStats();
  }, [selectedYear, syncEventTimestamp, user?.role]);

  if (user && user.role !== "STATE_ADMIN") {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 dark:border-amber-800 mx-auto">
          <ShieldCheck className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          State Administrator Access Required
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          District Management is restricted to Eastern Railway State Administrators.
        </p>
      </div>
    );
  }

  const filteredDistricts = districts.filter((d) => {
    return (
      searchQuery.trim() === "" ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.email && d.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleOpenEdit = (d: District) => {
    setEditingDistrict(d);
    setEditForm({
      name: d.name,
      address: d.address || "",
      email: d.email || "",
      phone: d.phone || "",
      status: d.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDistrict) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      await api.updateDistrict(editingDistrict.id, {
        name: editForm.name,
        address: editForm.address,
        email: editForm.email,
        phone: editForm.phone,
      });
      if (editForm.status !== editingDistrict.status) {
        await api.updateDistrictStatus(editingDistrict.id, editForm.status);
      }

      // Sync and intercept write in Firestore
      updateDistrictFirestore(editingDistrict.id, {
        name: editForm.name,
        address: editForm.address,
        email: editForm.email,
        phone: editForm.phone,
        status: editForm.status as "ACTIVE" | "INACTIVE"
      }, user).catch(() => {});

      setStatusMessage({ type: "success", text: `District ${editForm.name} updated successfully.` });
      setEditingDistrict(null);
      await refreshDistricts();
      await fetchDistrictStats();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update district." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (d: District) => {
    const newStatus = d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await api.updateDistrictStatus(d.id, newStatus);
      updateDistrictFirestore(d.id, { status: newStatus }, user).catch(() => {});
      setStatusMessage({
        type: "success",
        text: `District ${d.name} marked as ${newStatus}.`,
      });
      await refreshDistricts();
      await fetchDistrictStats();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to toggle status." });
    }
  };

  const handleExport = () => {
    const rows = districts.map((d, i) => {
      const breakdown = stats.find((s) => s.district_id === d.id);
      return {
        "SL No": i + 1,
        "District Name": d.name,
        "District Code": d.code,
        "Status": d.status,
        "Total Members": breakdown ? breakdown.grand_total : 0,
        "Annual Report": breakdown?.has_annual_report ? "Submitted" : "Pending",
        "Audited Statement": breakdown?.has_audited_statement ? "Submitted" : "Pending",
        "Official Email": d.email,
        "Official Phone": d.phone,
        "HQ Address": d.address,
      };
    });

    exportToExcel(rows, `ERBSG_Districts_List_${new Date().toISOString().slice(0, 10)}`, "Districts");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              State Control Authority
            </span>
            <span className="text-xs font-semibold text-slate-500">Eastern Railway Zone</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            District Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure the 9 operational railway district divisions and monitor organizational readiness
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Districts</span>
        </button>
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

      {/* District Cards / Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search district name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            {districts.length} Official Divisions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">DISTRICT NAME</th>
                <th className="px-4 py-3">CODE</th>
                <th className="px-4 py-3 text-right">MEMBERS</th>
                <th className="px-4 py-3 text-center">ANNUAL REPORT</th>
                <th className="px-4 py-3 text-center">AUDITED STMT</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredDistricts.map((dist) => {
                const breakdown = stats.find((s) => s.district_id === dist.id);
                return (
                  <tr key={dist.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{dist.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {dist.address || "Headquarters address on file"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400 font-bold">
                      {dist.code}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                      {breakdown ? breakdown.grand_total.toLocaleString() : 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        breakdown?.has_annual_report ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}>
                        {breakdown?.has_annual_report ? "Uploaded" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        breakdown?.has_audited_statement ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}>
                        {breakdown?.has_audited_statement ? "Uploaded" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        dist.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
                      }`}>
                        {dist.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(dist)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          title="Edit District Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(dist)}
                          className={`p-1.5 rounded ${
                            dist.status === "ACTIVE" ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={dist.status === "ACTIVE" ? "Deactivate District" : "Activate District"}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit District Modal */}
      {editingDistrict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold">Edit District: {editingDistrict.name}</h3>
              <button
                onClick={() => setEditingDistrict(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">District Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">HQ Address</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDistrict(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-sm"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
