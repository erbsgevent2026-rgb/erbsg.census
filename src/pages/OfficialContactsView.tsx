import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { OfficialContact } from "../types";
import { exportToExcel } from "../utils/excelExport";
import {
  Building2,
  CheckCircle2,
  Save,
  Download,
  AlertCircle,
  Loader2,
  UserPlus,
  Trash2,
  UserCheck,
  ShieldAlert
} from "lucide-react";

export const OfficialContactsView: React.FC = () => {
  const { user, selectedYear, availableYears, districts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const [targetDistrictId, setTargetDistrictId] = useState<string>(
    user?.districtId || (districts[0]?.id || "dist_asn")
  );

  useEffect(() => {
    if (user?.districtId) {
      setTargetDistrictId(user.districtId);
    } else if (districts.length > 0 && !districts.some((d) => d.id === targetDistrictId)) {
      setTargetDistrictId(districts[0].id);
    }
  }, [user, districts, targetDistrictId]);

  const [contacts, setContacts] = useState<OfficialContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getOfficialContacts(targetDistrictId, selectedYear);
      if (data.length === 0 && !isStateAdmin) {
        // Provide the two initial slots if completely empty
        const defaultSlots: OfficialContact[] = [
          {
            id: `temp_1_${Date.now()}`,
            state_id: "state_er",
            district_id: targetDistrictId,
            year_id: selectedYear,
            name: "",
            railway_designation: "",
            scouting_rank: "District Commissioner (Scout)",
            bsg_id: "",
            phone: "",
            email: "",
            is_selected: 1,
          },
          {
            id: `temp_2_${Date.now()}`,
            state_id: "state_er",
            district_id: targetDistrictId,
            year_id: selectedYear,
            name: "",
            railway_designation: "",
            scouting_rank: "District Secretary",
            bsg_id: "",
            phone: "",
            email: "",
            is_selected: 1,
          },
        ];
        setContacts(defaultSlots);
      } else {
        setContacts(data);
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load contacts." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [targetDistrictId, selectedYear, syncEventTimestamp]);

  const handleFieldChange = (index: number, field: keyof OfficialContact, value: string) => {
    setContacts((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      if (field === "scouting_rank") {
        updated.designation = value;
      }
      if (field === "bsg_id") {
        updated.bsg_uid = value;
      }
      next[index] = updated;
      return next;
    });
  };

  const handleAddRepresentative = () => {
    const newRep: OfficialContact = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      state_id: "state_er",
      district_id: targetDistrictId,
      year_id: selectedYear,
      name: "",
      railway_designation: "",
      scouting_rank: "",
      bsg_id: "",
      phone: "",
      email: "",
      is_selected: 1,
    };
    setContacts((prev) => [...prev, newRep]);
    setStatusMessage({ type: "success", text: "New Authorized Representative slot added. Please fill in details and save." });
  };

  const handleConfirmDelete = async () => {
    if (deleteIndex === null) return;
    const target = contacts[deleteIndex];

    if (target.id && !target.id.startsWith("temp_")) {
      try {
        setSaving(true);
        await api.deleteOfficialContact(target.id, targetDistrictId);
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Failed to delete representative." });
        setDeleteIndex(null);
        setSaving(false);
        return;
      }
    }

    const updated = contacts.filter((_, idx) => idx !== deleteIndex);
    setContacts(updated);
    setDeleteIndex(null);
    setSaving(false);
    setStatusMessage({ type: "success", text: "Authorized Representative deleted successfully." });

    // Persist changes
    try {
      await api.saveOfficialContacts(targetDistrictId, selectedYear, updated);
    } catch {
      // Ignored
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await api.saveOfficialContacts(targetDistrictId, selectedYear, contacts);
      setStatusMessage({ type: "success", text: res.message || "Authorized Representatives saved successfully." });
      await fetchContacts();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save contacts." });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
    const districtName = activeDistrictObj?.name || user?.districtName || "District";
    const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;

    const rows = contacts.map((c, i) => ({
      "SL No": i + 1,
      "Representative Name": c.name || "Not specified",
      "Railway Designation": c.railway_designation || "Not specified",
      "Scouting Rank": c.scouting_rank || c.designation || "Not specified",
      "BSG ID": c.bsg_id || c.bsg_uid || "—",
      "Mobile Number": c.phone || "—",
      "Email Address": c.email || "—",
      "District": districtName,
      "Financial Year": yearLabel,
    }));

    exportToExcel(rows, `ERBSG_Authorized_Representatives_${districtName}_${yearLabel}`, "Authorized Representatives");
  };

  const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
  const districtName = activeDistrictObj?.name || user?.districtName || "District";
  const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 tracking-wide">
              Statutory Governance
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {districtName} • Session {yearLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>Authorized Representatives</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Designate authorized contact persons representing Eastern Railway Bharat Scouts and Guides
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {isStateAdmin && (
            <div className="flex items-center bg-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              <select
                value={targetDistrictId}
                onChange={(e) => setTargetDistrictId(e.target.value)}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer pr-2"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id} className="text-slate-900 bg-white">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isStateAdmin && (
            <button
              type="button"
              onClick={handleAddRepresentative}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Authorized Representative</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
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

      {/* Representatives Container */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Official Representatives ({contacts.length})
              </span>
              {isStateAdmin ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  State Admin (View-Only)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  Editable District Record
                </span>
              )}
            </div>

            {!isStateAdmin ? (
              <span className="text-[11px] text-slate-500 font-medium">
                Add, edit, or remove representatives as needed. Click "Save Official Contacts" to persist.
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-medium">
                Viewing official representatives submitted by {districtName}.
              </span>
            )}
          </div>

          <div className="p-5 space-y-4">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Loading authorized representatives...</span>
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <p className="font-semibold text-slate-700">No authorized representatives found.</p>
                <p className="mt-1">
                  {isStateAdmin
                    ? `No official representatives registered by ${districtName} for this financial year yet.`
                    : "Click \"+ Add Authorized Representative\" above to add your district's first representative."}
                </p>
                {!isStateAdmin && (
                  <button
                    type="button"
                    onClick={handleAddRepresentative}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Representative</span>
                  </button>
                )}
              </div>
            ) : (
              contacts.map((c, index) => (
                <div
                  key={c.id || index}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
                >
                  {/* Card Subheader */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Authorized Representative #{index + 1}
                      </span>
                    </div>

                    {!isStateAdmin && (
                      <button
                        type="button"
                        id={`btn-delete-rep-${index}`}
                        onClick={() => setDeleteIndex(index)}
                        className="flex items-center gap-1 px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold transition border border-red-200 cursor-pointer"
                        title="Delete this representative"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  {/* Form Fields: 6 Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {/* 1. Full Name */}
                    <div>
                      <label htmlFor={`rep-${index}-name`} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      {isStateAdmin ? (
                        <div id={`rep-${index}-name`} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900">
                          {c.name || "—"}
                        </div>
                      ) : (
                        <input
                          id={`rep-${index}-name`}
                          type="text"
                          required
                          value={c.name}
                          onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                          placeholder="e.g. Sri A. K. Sharma"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* 2. Railway Designation */}
                    <div>
                      <label htmlFor={`rep-${index}-railway-desig`} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Railway Designation <span className="text-red-500">*</span>
                      </label>
                      {isStateAdmin ? (
                        <div id={`rep-${index}-railway-desig`} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
                          {c.railway_designation || "—"}
                        </div>
                      ) : (
                        <input
                          id={`rep-${index}-railway-desig`}
                          type="text"
                          required
                          value={c.railway_designation || ""}
                          onChange={(e) => handleFieldChange(index, "railway_designation", e.target.value)}
                          placeholder="e.g. Senior Section Engineer (SSE)"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* 3. Scouting Rank */}
                    <div>
                      <label htmlFor={`rep-${index}-scouting-rank`} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Scouting Rank <span className="text-red-500">*</span>
                      </label>
                      {isStateAdmin ? (
                        <div id={`rep-${index}-scouting-rank`} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
                          {c.scouting_rank || c.designation || "—"}
                        </div>
                      ) : (
                        <input
                          id={`rep-${index}-scouting-rank`}
                          type="text"
                          required
                          value={c.scouting_rank || c.designation || ""}
                          onChange={(e) => handleFieldChange(index, "scouting_rank", e.target.value)}
                          placeholder="e.g. District Commissioner (Scout)"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* 4. BSG ID */}
                    <div>
                      <label htmlFor={`rep-${index}-bsg-id`} className="block text-[11px] font-bold text-slate-700 mb-1">
                        BSG ID <span className="text-red-500">*</span>
                      </label>
                      {isStateAdmin ? (
                        <div id={`rep-${index}-bsg-id`} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-800">
                          {c.bsg_id || c.bsg_uid || "—"}
                        </div>
                      ) : (
                        <input
                          id={`rep-${index}-bsg-id`}
                          type="text"
                          required
                          value={c.bsg_id || c.bsg_uid || ""}
                          onChange={(e) => handleFieldChange(index, "bsg_id", e.target.value)}
                          placeholder="e.g. BSG-UID-ASN-101 or BSG12345"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* 5. Mobile Number */}
                    <div>
                      <label htmlFor={`rep-${index}-phone`} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mobile Number
                      </label>
                      {isStateAdmin ? (
                        <div id={`rep-${index}-phone`} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-mono">
                          {c.phone || "—"}
                        </div>
                      ) : (
                        <input
                          id={`rep-${index}-phone`}
                          type="tel"
                          value={c.phone || ""}
                          onChange={(e) => handleFieldChange(index, "phone", e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>

                    {/* 6. Email Address */}
                    <div>
                      <label htmlFor={`rep-${index}-email`} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Email Address
                      </label>
                      {isStateAdmin ? (
                        <div id={`rep-${index}-email`} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 truncate">
                          {c.email || "—"}
                        </div>
                      ) : (
                        <input
                          id={`rep-${index}-email`}
                          type="email"
                          value={c.email || ""}
                          onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                          placeholder="contact@erbsg.org"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {!isStateAdmin && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                All changes to Authorized Representatives are isolated to your district and updated in real-time.
              </span>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleAddRepresentative}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition shadow-2xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>+ Add More</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || contacts.length === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Personnel...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Official Contacts</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Delete Authorized Representative
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete{" "}
                  <strong className="text-slate-900">
                    {contacts[deleteIndex]?.name || `Authorized Representative #${deleteIndex + 1}`}
                  </strong>
                  ? This record will be permanently deleted from the database.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteIndex(null)}
                disabled={saving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
