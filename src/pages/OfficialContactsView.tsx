import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { OfficialContact, FIXED_OFFICIAL_POSITIONS } from "../types";
import { exportToExcel } from "../utils/excelExport";
import {
  Building2,
  CheckCircle2,
  Save,
  Download,
  AlertCircle,
  Loader2,
  PhoneCall,
  User,
  Hash,
  Phone,
  Mail,
  Shield,
  Check
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

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getOfficialContacts(targetDistrictId, selectedYear);
      
      // Ensure all 17 fixed positions are always initialized in exact order
      const fullList: OfficialContact[] = FIXED_OFFICIAL_POSITIONS.map((posName, idx) => {
        const posOrder = idx + 1;
        const existing = data.find(
          (c) =>
            c.position_order === posOrder ||
            c.position_name?.trim().toLowerCase() === posName.trim().toLowerCase() ||
            c.scouting_rank?.trim().toLowerCase() === posName.trim().toLowerCase()
        );

        return {
          id: existing?.id || `oc_${targetDistrictId}_${selectedYear}_pos_${posOrder}`,
          state_id: "state_er",
          district_id: targetDistrictId,
          year_id: selectedYear,
          position_order: posOrder,
          position_name: posName,
          name: existing?.name || "",
          bsg_id: existing?.bsg_id || existing?.bsg_uid || "",
          phone: existing?.phone || "",
          email: existing?.email || "",
          is_selected: 1,
        };
      });

      setContacts(fullList);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load official contacts." });
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
      next[index] = {
        ...next[index],
        [field]: value,
        ...(field === "bsg_id" ? { bsg_uid: value } : {}),
      };
      return next;
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStateAdmin) return;
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await api.saveOfficialContacts(targetDistrictId, selectedYear, contacts);
      setStatusMessage({ type: "success", text: res.message || "Official Contact Person details saved successfully." });
      await fetchContacts();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save official contacts." });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
    const districtName = activeDistrictObj?.name || user?.districtName || "District";
    const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;

    const rows = contacts.map((c, i) => {
      const posNumber = i + 1;
      const cleanTitle = (c.position_name || FIXED_OFFICIAL_POSITIONS[i]).replace(/^\d+\.\s*/, "");
      return {
        "SL No": posNumber,
        "Official Position": `${posNumber}. ${cleanTitle}`,
        "Full Name": c.name || "—",
        "BSG ID": c.bsg_id || "—",
        "Mobile Number": c.phone || "—",
        "Email ID": c.email || "—",
        "District": districtName,
        "Financial Year": yearLabel,
      };
    });

    exportToExcel(rows, `ERBSG_Official_Contact_Persons_${districtName}_${yearLabel}`, "Official Positions");
  };

  const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
  const districtName = activeDistrictObj?.name || user?.districtName || "District";
  const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;

  const configuredCount = contacts.filter((c) => c.name?.trim()).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 tracking-wide">
              Statutory Governance
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {districtName} • Session {yearLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Official Contact Person</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            17 Fixed Statutory Official Positions for Eastern Railway Bharat Scouts and Guides
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {isStateAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 mr-1.5" />
              <select
                value={targetDistrictId}
                onChange={(e) => setTargetDistrictId(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-2"
                aria-label="Select District"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 font-medium animate-in fade-in duration-200 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 17 Fixed Positions Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Header bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Official Positions (17)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {configuredCount}/17 Configured
            </span>
            {isStateAdmin ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                State Admin (View-Only)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Editable District Record
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {isStateAdmin
              ? `Viewing the 17 statutory official positions for ${districtName}.`
              : `Update contact details for the 17 positions of ${districtName}. Fixed list — no positions can be added or deleted.`}
          </span>
        </div>

        {/* Positions Cards List */}
        <div className="p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Loading 17 Official Positions...</span>
            </div>
          ) : (
            contacts.map((c, index) => {
              const posNumber = index + 1;
              const rawTitle = c.position_name || FIXED_OFFICIAL_POSITIONS[index];
              const cleanTitle = rawTitle.replace(/^\d+\.\s*/, "");
              const displayTitle = `${posNumber}. ${cleanTitle}`;
              const isConfigured = Boolean(c.name && c.name.trim().length > 0);

              return (
                <div
                  key={c.id || `pos_${posNumber}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isConfigured
                      ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-800"
                      : "border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
                  }`}
                >
                  {/* Card Title Bar */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {displayTitle}
                    </h3>

                    <div className="flex items-center gap-2">
                      {isConfigured ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Configured</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                          <span>Pending Details</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Exactly 4 Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* 1. Full Name */}
                    <div>
                      <label
                        htmlFor={`pos-${index}-name`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Full Name</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-name`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white truncate"
                        >
                          {c.name || "—"}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-name`}
                          type="text"
                          value={c.name || ""}
                          onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                          placeholder="Enter Full Name"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
                        />
                      )}
                    </div>

                    {/* 2. BSG ID */}
                    <div>
                      <label
                        htmlFor={`pos-${index}-bsg-id`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span>BSG ID</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-bsg-id`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white truncate"
                        >
                          {c.bsg_id || "—"}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-bsg-id`}
                          type="text"
                          value={c.bsg_id || ""}
                          onChange={(e) => handleFieldChange(index, "bsg_id", e.target.value)}
                          placeholder="e.g. BSG12345"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
                        />
                      )}
                    </div>

                    {/* 3. Mobile Number */}
                    <div>
                      <label
                        htmlFor={`pos-${index}-phone`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>Mobile Number</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-phone`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 truncate"
                        >
                          {c.phone || "—"}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-phone`}
                          type="tel"
                          value={c.phone || ""}
                          onChange={(e) => handleFieldChange(index, "phone", e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
                        />
                      )}
                    </div>

                    {/* 4. Email ID */}
                    <div>
                      <label
                        htmlFor={`pos-${index}-email`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>Email ID</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-email`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 truncate"
                        >
                          {c.email || "—"}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-email`}
                          type="email"
                          value={c.email || ""}
                          onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                          placeholder="e.g. official@erbsg.org"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions for District User */}
        {!isStateAdmin && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              All changes to the 17 official positions are isolated to {districtName} and securely saved in the ERBSG central records.
            </span>

            <button
              type="button"
              id="btn-save-official-contacts"
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-extrabold text-xs rounded-lg transition-all shadow-xs cursor-pointer self-end sm:self-auto"
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
        )}
      </div>
    </div>
  );
};
