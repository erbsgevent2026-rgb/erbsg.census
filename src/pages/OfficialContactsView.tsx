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
  Check,
  Clock,
  Sparkles
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
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getOfficialContacts(targetDistrictId, selectedYear);
      
      // Ensure all 18 fixed positions are always initialized in exact order with serial numbers 1–18
      const normalize = (s: string) =>
        (s || "")
          .replace(/^\d+\.\s*/, "")
          .toLowerCase()
          .replace(/[\(\)\.\-_]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const fullList: OfficialContact[] = FIXED_OFFICIAL_POSITIONS.map((posName, idx) => {
        const posOrder = idx + 1;
        const baseName = normalize(posName);
        const existing = data.find((c) => {
          const cName = normalize(c.position_name || "");
          const cRank = normalize(c.scouting_rank || c.designation || "");

          if (c.position_order === posOrder && cName === baseName) return true;
          if (cName && cName === baseName) return true;

          // Special alias matching for renames
          if (baseName === "chairman district youth committee" && (cName.includes("youth committee chairman") || cRank.includes("youth committee chairman"))) return true;
          if (baseName === "co chairman district youth committee" && (cName.includes("co chairman") || cRank.includes("co chairman"))) return true;
          if (baseName === "district commissioners s" && (cName.includes("commissioner s") || cName.includes("commissioner scout") || cRank.includes("commissioner s") || cRank.includes("commissioner scout"))) return true;
          if (baseName === "district commissioner g" && (cName.includes("commissioner g") || cName.includes("commissioner guide") || cRank.includes("commissioner g") || cRank.includes("commissioner guide"))) return true;
          if (baseName === "district training commissioner scouts" && (cName.includes("training commissioner of scouts") || cName.includes("training commissioner scouts"))) return true;
          if (baseName === "district training commissioner guides" && (cName.includes("training commissioner of guides") || cName.includes("training commissioner guides"))) return true;
          if (baseName === "district oyms co ordinator" && cName.includes("oyms")) return true;

          return false;
        }) || data.find((c) => c.position_order === posOrder);

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

  // Individual Card Save Handler
  const handleSaveSingle = async (index: number) => {
    if (isStateAdmin) return;
    const target = contacts[index];
    if (!target) return;

    setSavingIndex(index);
    setStatusMessage(null);

    try {
      const res = await api.saveSingleOfficialContact(targetDistrictId, selectedYear, target);
      setSavedIndex(index);
      setTimeout(() => setSavedIndex((curr) => (curr === index ? null : curr)), 3000);
      setStatusMessage({
        type: "success",
        text: res.message || `${target.position_name} details saved successfully.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || `Failed to save ${target.position_name}.`
      });
    } finally {
      setSavingIndex(null);
    }
  };

  // Save All Positions (Batch Option)
  const handleSaveAll = async () => {
    if (isStateAdmin) return;
    setSavingAll(true);
    setStatusMessage(null);

    try {
      const res = await api.saveOfficialContacts(targetDistrictId, selectedYear, contacts);
      setStatusMessage({ type: "success", text: res.message || "All 18 Official Positions saved successfully." });
      await fetchContacts();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save official contacts." });
    } finally {
      setSavingAll(false);
    }
  };

  const handleExport = () => {
    const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
    const districtName = activeDistrictObj?.name || user?.districtName || "District";
    const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;

    const rows = contacts.map((c, i) => {
      const rawTitle = c.position_name || FIXED_OFFICIAL_POSITIONS[i];
      const cleanTitle = rawTitle.replace(/^\d+\.\s*/, "");
      return {
        "Sl. No.": i + 1,
        "Official Position": cleanTitle,
        "Contact Person / Full Name": c.name || "N/A",
        "BSG ID": c.bsg_id || c.bsg_uid || "N/A",
        "Mobile Number": c.phone || "N/A",
        "Email ID": c.email || "N/A",
        "Status": c.name ? "Configured" : "Pending",
      };
    });

    exportToExcel(
      rows,
      `Official_Contacts_${districtName.replace(/\s+/g, "_")}_${selectedYear}`,
      `${districtName} Official Contacts (${yearLabel})`
    );
  };

  const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
  const districtName = activeDistrictObj?.name || user?.districtName || "District";
  const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || selectedYear;
  const configuredCount = contacts.filter((c) => Boolean(c.name && c.name.trim().length > 0)).length;
  const percentComplete = Math.round((configuredCount / 18) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner & Governance Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
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
            18 Fixed Statutory Official Positions for Eastern Railway Bharat Scouts and Guides
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {isStateAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700">
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Excel Export</span>
          </button>

          {!isStateAdmin && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={savingAll || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              title="Save all 18 positions at once"
            >
              {savingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving All...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save All Cards</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress & Summary Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Governance Completion: {configuredCount} of 18 Positions Configured
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              ({percentComplete}%)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isStateAdmin ? (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                State Admin (View-Only Mode)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                District Edit & Save Mode
              </span>
            )}
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {isStateAdmin
                ? `Viewing official records for ${districtName}.`
                : `Update and save each card individually below.`}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Status Feedback Toast */}
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
          <span className="flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* 18 Individual Position Cards Grid (Two-Column Responsive Layout) */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2.5">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Loading 18 Official Position Cards...
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          {contacts.map((c, index) => {
            const posNumber = index + 1;
            const rawTitle = c.position_name || FIXED_OFFICIAL_POSITIONS[index];
            const cleanTitle = rawTitle.replace(/^\d+\.\s*/, "");
            const isConfigured = Boolean(c.name && c.name.trim().length > 0);
            const isSavingThis = savingIndex === index;
            const isSavedThis = savedIndex === index;

            return (
              <div
                key={c.id || `pos_card_${posNumber}`}
                className={`bg-white dark:bg-slate-900 rounded-xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isConfigured
                    ? "border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700"
                    : "border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-700"
                }`}
              >
                {/* Card Header: Serial Number + Official Position Name + Status Badge */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 rounded-t-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      #{posNumber}
                    </span>
                    <div className="min-w-0">
                      <h3
                        className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate"
                        title={cleanTitle}
                      >
                        {cleanTitle}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Statutory Position Sl. No. {posNumber}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isConfigured ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Configured</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body: 4 Required Fields */}
                <div className="p-4 sm:p-5 flex-1 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* 1. Contact Person / Full Name */}
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`pos-${index}-name`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Contact Person / Full Name</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-name`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 truncate"
                        >
                          {c.name || <span className="text-slate-400 italic font-normal">Not Provided</span>}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-name`}
                          type="text"
                          value={c.name || ""}
                          onChange={(e) => handleFieldChange(index, "name", e.target.value)}
                          placeholder="Enter contact person's full name"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                        />
                      )}
                    </div>

                    {/* 2. BSG ID */}
                    <div>
                      <label
                        htmlFor={`pos-${index}-bsg`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span>BSG ID</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-bsg`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono font-medium text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 truncate"
                        >
                          {c.bsg_id || c.bsg_uid || <span className="text-slate-400 italic font-sans font-normal">—</span>}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-bsg`}
                          type="text"
                          value={c.bsg_id || c.bsg_uid || ""}
                          onChange={(e) => handleFieldChange(index, "bsg_id", e.target.value)}
                          placeholder="e.g. BSG123456789"
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
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
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 truncate"
                        >
                          {c.phone ? (
                            <a href={`tel:${c.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {c.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic font-normal">—</span>
                          )}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-phone`}
                          type="tel"
                          value={c.phone || ""}
                          onChange={(e) => handleFieldChange(index, "phone", e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                        />
                      )}
                    </div>

                    {/* 4. Email */}
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`pos-${index}-email`}
                        className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>Email</span>
                      </label>
                      {isStateAdmin ? (
                        <div
                          id={`pos-${index}-email`}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 truncate"
                        >
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {c.email}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic font-normal">—</span>
                          )}
                        </div>
                      ) : (
                        <input
                          id={`pos-${index}-email`}
                          type="email"
                          value={c.email || ""}
                          onChange={(e) => handleFieldChange(index, "email", e.target.value)}
                          placeholder="Official or contact email"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Individual Save Button for District User or View Notice for Admin */}
                {isStateAdmin ? (
                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 rounded-b-xl flex items-center justify-between text-[11px] text-slate-400">
                    <span>{districtName} Official Record</span>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Read-Only</span>
                  </div>
                ) : (
                  <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 rounded-b-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {isSavedThis ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                        </span>
                      ) : isConfigured ? (
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Ready</span>
                      ) : (
                        <span className="text-slate-400">Details not saved</span>
                      )}
                    </div>

                    {/* Dedicated Individual Save Button on Each Card */}
                    <button
                      type="button"
                      id={`btn-save-pos-${posNumber}`}
                      onClick={() => handleSaveSingle(index)}
                      disabled={isSavingThis || savingAll}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-60 text-slate-950 font-extrabold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                      title={`Save details for ${cleanTitle}`}
                    >
                      {isSavingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : isSavedThis ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-900" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global Footer Note */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span>
          {isStateAdmin
            ? `Viewing the 18 statutory official positions for ${districtName}. All details are updated in real time by the district.`
            : `All 18 official positions can be updated and saved individually or together. Positions cannot be added or deleted.`}
        </span>

        {!isStateAdmin && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={savingAll || loading}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer shrink-0 self-end sm:self-auto"
          >
            {savingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving All 18 Positions...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All 18 Positions</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
