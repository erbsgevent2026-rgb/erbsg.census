import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { MemberCounts, UnitDetails, DeadlineRecord } from "../types";
import { exportMembersToExcel } from "../utils/excelExport";
import {
  saveMemberCountsFirestore,
  getMemberCountsFirestore,
  saveUnitDetailsFirestore,
  getUnitDetailsFirestore
} from "../services/firestoreData";
import {
  Users,
  Download,
  Save,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Shield,
  Layers
} from "lucide-react";

export const MembersView: React.FC = () => {
  const { user, selectedYear, availableYears, districts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  // For State Admin, allow picking which district to view/edit; for District User, lock to own district!
  const [targetDistrictId, setTargetDistrictId] = useState<string>(
    user?.districtId || (districts[0]?.id || "dist_asn")
  );

  useEffect(() => {
    if (user?.districtId) {
      setTargetDistrictId(user.districtId);
    } else if (districts.length > 0 && !districts.some(d => d.id === targetDistrictId)) {
      setTargetDistrictId(districts[0].id);
    }
  }, [user, districts, targetDistrictId]);

  const [members, setMembers] = useState<MemberCounts>({
    district_id: targetDistrictId,
    year_id: selectedYear,
    bunnies: 0,
    bunny_aunties: 0,
    bulbul: 0,
    guide: 0,
    ranger: 0,
    scout: 0,
    rover: 0,
    cub: 0,
    flock_leaders: 0,
    guide_captains: 0,
    ranger_leaders: 0,
    cub_masters: 0,
    lady_cub_masters: 0,
    scout_masters: 0,
    rover_scout_leaders: 0,
    professional_guides: 0,
    voluntary_commissioners: 0,
    support_staff: 0,
    professionals_staff: 0,
    youth_total: 0,
    unit_leaders_total: 0,
    professionals_total: 0,
    grand_total: 0,
  });

  const [deadline, setDeadline] = useState<DeadlineRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Unit Details State (Bulbul Flock, Guide Company, Ranger Team, Cub Pack, Scout Troop, Rover Crew)
  const [unitDetails, setUnitDetails] = useState<UnitDetails>({
    district_id: targetDistrictId,
    year_id: selectedYear,
    bulbul_flock: 0,
    guide_company: 0,
    ranger_team: 0,
    cub_pack: 0,
    scout_troop: 0,
    rover_crew: 0,
  });
  const [unitLoading, setUnitLoading] = useState<boolean>(false);
  const [unitSaving, setUnitSaving] = useState<boolean>(false);
  const [unitStatusMessage, setUnitStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.getMembers(targetDistrictId, selectedYear);
      if (res.data) {
        setMembers(res.data);
      }
      if (res.deadline) {
        setDeadline(res.deadline);
      }
    } catch (err: any) {
      console.warn("API getMembers failed, attempting Firestore fallback:", err);
      try {
        const firestoreData = await getMemberCountsFirestore(targetDistrictId, selectedYear);
        if (firestoreData) {
          setMembers(firestoreData);
        } else {
          setStatusMessage({ type: "error", text: err.message || "Failed to load member records." });
        }
      } catch {
        setStatusMessage({ type: "error", text: err.message || "Failed to load member records." });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUnitDetails = async () => {
    try {
      setUnitLoading(true);
      const res = await api.getUnitDetails(targetDistrictId, selectedYear);
      if (res.data) {
        setUnitDetails(res.data);
      }
    } catch (err: any) {
      console.warn("API getUnitDetails failed, attempting Firestore fallback:", err);
      try {
        const fsData = await getUnitDetailsFirestore(targetDistrictId, selectedYear);
        if (fsData) {
          setUnitDetails(fsData);
        }
      } catch {
        // Fallback catch
      }
    } finally {
      setUnitLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchUnitDetails();
  }, [targetDistrictId, selectedYear, syncEventTimestamp]);

  const handleUnitInputChange = (field: keyof UnitDetails, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setUnitDetails((prev) => ({
      ...prev,
      [field]: num,
    }));
  };

  const handleSaveUnitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStateAdmin) return;

    setUnitSaving(true);
    setUnitStatusMessage(null);

    try {
      const res = await api.saveUnitDetails(targetDistrictId, selectedYear, unitDetails);
      saveUnitDetailsFirestore(targetDistrictId, selectedYear, unitDetails, user).catch((fsErr) =>
        console.warn("Background firestore unit details sync notice:", fsErr)
      );

      setUnitStatusMessage({ type: "success", text: res.message || "Unit Details saved successfully." });
      await fetchUnitDetails();
    } catch (err: any) {
      try {
        await saveUnitDetailsFirestore(targetDistrictId, selectedYear, unitDetails, user);
        setUnitStatusMessage({
          type: "success",
          text: "Saved directly to Cloud Firestore database."
        });
      } catch (fsErr: any) {
        setUnitStatusMessage({ type: "error", text: err.message || "Failed to save Unit Details." });
      }
    } finally {
      setUnitSaving(false);
    }
  };

  // Handle live calculation when input changes
  const handleInputChange = (field: keyof MemberCounts, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setMembers((prev) => {
      const updated = { ...prev, [field]: num };

      // Automatic Calculations as mandated
      // Youth: Bulbuls, Guides, Rangers, Cubs, Scouts, Rovers
      const youth_total =
        (Number(updated.bulbul) || 0) +
        (Number(updated.guide) || 0) +
        (Number(updated.ranger) || 0) +
        (Number(updated.cub) || 0) +
        (Number(updated.scout) || 0) +
        (Number(updated.rover) || 0);

      // Unit Leaders: Flock Leaders & Assistants, Guide Captains & Assistants, Ranger Leaders & Assistants,
      // Cub Masters & Assistants, Scout Masters & Assistants, Rover Scout Leaders & Assistants
      const unit_leaders_total =
        (Number(updated.flock_leaders) || 0) +
        (Number(updated.guide_captains) || 0) +
        (Number(updated.ranger_leaders) || 0) +
        (Number(updated.cub_masters) || 0) +
        (Number(updated.scout_masters) || 0) +
        (Number(updated.rover_scout_leaders) || 0) +
        (Number(updated.lady_cub_masters) || 0);

      const professionals_total =
        (Number(updated.professional_guides) || 0) +
        (Number(updated.voluntary_commissioners) || 0) +
        (Number(updated.support_staff) || 0) +
        (Number(updated.professionals_staff) || 0);

      const grand_total = youth_total + unit_leaders_total + professionals_total;

      return {
        ...updated,
        youth_total,
        unit_leaders_total,
        professionals_total,
        grand_total,
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStateAdmin) {
      return;
    }
    setSaving(true);
    setStatusMessage(null);

    try {
      // 1. Perform write to server database (SQLite & Audit Logging)
      const res = await api.saveMembers(targetDistrictId, selectedYear, members);

      // 2. Persist to Firestore & Trigger Firestore Audit Logging Interceptor
      saveMemberCountsFirestore(targetDistrictId, selectedYear, members, user).catch((fsErr) =>
        console.warn("Background firestore member sync notice:", fsErr)
      );

      setStatusMessage({ type: "success", text: res.message || "Membership records saved and persisted to Firestore successfully." });
      await fetchMembers();
    } catch (err: any) {
      // If API fails, try direct Firestore write
      try {
        await saveMemberCountsFirestore(targetDistrictId, selectedYear, members, user);
        setStatusMessage({
          type: "success",
          text: "Saved directly to Cloud Firestore database."
        });
      } catch (fsErr: any) {
        setStatusMessage({ type: "error", text: err.message || "Failed to save records." });
      }
    } finally {
      setSaving(false);
    }
  };

  const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
  const districtName = activeDistrictObj?.name || user?.districtName || "District";
  const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || "2026-2027";

  return (
    <div className="space-y-6">
      {/* Top Banner: Annual Census Return & Last Saved Status */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                Annual Census Return (Scout/Guide Wing)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Last saved: {members.updated_at ? new Date(members.updated_at).toLocaleString() : "Initial System Seed"}
              {members.updated_by ? ` by ${members.updated_by}` : ""}
            </p>
          </div>
        </div>

        {/* District Selector for State Admin or District indicator */}
        <div className="flex items-center gap-2">
          {isStateAdmin ? (
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium">
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
          ) : (
            <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{districtName}</span>
            </div>
          )}

          <button
            onClick={() => exportMembersToExcel(members, districtName, yearLabel)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Excel</span>
          </button>
        </div>
      </div>

      {/* Top View-Only Banner for State Admin */}
      {isStateAdmin && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block">View-Only Administrator Mode</span>
            <span>
              District membership census details across Youth Members, Unit Leaders, and Professionals/Staff are entered and updated directly by authorized District Users. State Administrators have view-only access. Any updates submitted by a district automatically appear here in real time.
            </span>
          </div>
        </div>
      )}

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

      {/* Auto-Calculated Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Youth Total
          </span>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-100 mt-1">
            {members.youth_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-1">Sum of all youth categories</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
            Unit Leaders
          </span>
          <div className="text-2xl sm:text-3xl font-black text-purple-900 dark:text-purple-100 mt-1">
            {members.unit_leaders_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-1">Sum of leadership positions</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Professionals/Staff
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-100 mt-1">
            {members.professionals_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">Staff and commissioners</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Grand Total
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
            {members.grand_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">Total registered strength</p>
        </div>
      </div>

      {/* Unit Details Card (Directly above Members Breakdown) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-emerald-800 dark:text-emerald-300 text-sm sm:text-base tracking-tight">
                  Unit Details
                </h3>
                {isStateAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    View-Only
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Number of registered units across sections in {districtName}
              </p>
            </div>
          </div>
          {unitDetails.updated_at && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline font-medium">
              Last saved: {new Date(unitDetails.updated_at).toLocaleString()}
            </span>
          )}
        </div>

        {unitStatusMessage && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
              unitStatusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            }`}
          >
            {unitStatusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{unitStatusMessage.text}</span>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Row 1: Female Wing Units (Bulbul Flock, Guide Company, Ranger Team) */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Female Wing Units
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. No. of Bulbul Flock
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={unitDetails.bulbul_flock || ""}
                  onChange={(e) => handleUnitInputChange("bulbul_flock", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. No. of Guide Company
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={unitDetails.guide_company || ""}
                  onChange={(e) => handleUnitInputChange("guide_company", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. No. of Ranger Team
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={unitDetails.ranger_team || ""}
                  onChange={(e) => handleUnitInputChange("ranger_team", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Male Wing Units (Cub Pack, Scout Troop, Rover Crew) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Male Wing Units
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4. No. of Cub Pack
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={unitDetails.cub_pack || ""}
                  onChange={(e) => handleUnitInputChange("cub_pack", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  5. No. of Scout Troop
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={unitDetails.scout_troop || ""}
                  onChange={(e) => handleUnitInputChange("scout_troop", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  6. No. of Rover Crew
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={unitDetails.rover_crew || ""}
                  onChange={(e) => handleUnitInputChange("rover_crew", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button for Unit Details */}
        {!isStateAdmin ? (
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save unit and section counts for {districtName}.
            </p>
            <button
              type="button"
              onClick={handleSaveUnitDetails}
              disabled={unitSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
            >
              {unitSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Unit Details...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Unit Details</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              Administrator View-Only: Displaying saved Unit Details for {districtName}
            </span>
          </div>
        )}
      </div>

      {/* Members Breakdown Header */}
      <div className="pt-2">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
          Members Breakdown
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Official section-wise membership census figures across all categories
        </p>
      </div>

      {/* Main Census Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Youth Members */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-blue-700 dark:text-blue-300 text-sm sm:text-base tracking-tight">
                  1. Youth Members
                </h3>
                {isStateAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    View-Only
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Youth Members</p>
            </div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
              Subtotal: {members.youth_total}
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Row 1: Bulbuls, Guides, Rangers */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Row 1 • Female Wing
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Bulbuls", key: "bulbul" as const },
                  { label: "Guides", key: "guide" as const },
                  { label: "Rangers", key: "ranger" as const },
                ].map((cat) => (
                  <div key={cat.key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {cat.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={isStateAdmin}
                      value={members[cat.key] || ""}
                      onChange={(e) => handleInputChange(cat.key, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                        isStateAdmin
                          ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2: Cubs, Scouts, Rovers */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Row 2 • Male Wing
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Cubs", key: "cub" as const },
                  { label: "Scouts", key: "scout" as const },
                  { label: "Rovers", key: "rover" as const },
                ].map((cat) => (
                  <div key={cat.key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {cat.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={isStateAdmin}
                      value={members[cat.key] || ""}
                      onChange={(e) => handleInputChange(cat.key, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                        isStateAdmin
                          ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Unit Leaders */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-purple-700 dark:text-purple-300 text-sm sm:text-base tracking-tight">
                  2. Unit Leaders
                </h3>
                {isStateAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    View-Only
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Unit Leaders</p>
            </div>
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
              Subtotal: {members.unit_leaders_total}
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Row 1: Flock Leaders & Assistants, Guide Captains & Assistants, Ranger Leaders & Assistants */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Row 1
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Flock Leaders & Assistants", key: "flock_leaders" as const },
                  { label: "Guide Captains & Assistants", key: "guide_captains" as const },
                  { label: "Ranger Leaders & Assistants", key: "ranger_leaders" as const },
                ].map((cat) => (
                  <div key={cat.key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate" title={cat.label}>
                      {cat.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={isStateAdmin}
                      value={members[cat.key] || ""}
                      onChange={(e) => handleInputChange(cat.key, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                        isStateAdmin
                          ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2: Cub Masters & Assistants, Scout Masters & Assistants, Rover Scout Leaders & Assistants */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Row 2
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Cub Masters & Assistants", key: "cub_masters" as const },
                  { label: "Scout Masters & Assistants", key: "scout_masters" as const },
                  { label: "Rover Scout Leaders & Assistants", key: "rover_scout_leaders" as const },
                ].map((cat) => (
                  <div key={cat.key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate" title={cat.label}>
                      {cat.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={isStateAdmin}
                      value={members[cat.key] || ""}
                      onChange={(e) => handleInputChange(cat.key, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                        isStateAdmin
                          ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Professionals/Staff */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-amber-700 dark:text-amber-300 text-sm sm:text-base tracking-tight">
                  3. Professionals/Staff
                </h3>
                {isStateAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    View-Only
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Professionals/Staff</p>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
              Subtotal: {members.professionals_total}
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Professional Guides", key: "professional_guides" as const },
              { label: "Voluntary Commissioners", key: "voluntary_commissioners" as const },
              { label: "Support Staff", key: "support_staff" as const },
              { label: "Professionals / Staff", key: "professionals_staff" as const },
            ].map((cat) => (
              <div key={cat.key}>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate" title={cat.label}>
                  {cat.label}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isStateAdmin}
                  value={members[cat.key] || ""}
                  onChange={(e) => handleInputChange(cat.key, e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save Bar: Only visible for District Users; completely removed for State Admin */}
        {!isStateAdmin && (
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ensure all census entries comply with official Eastern Railway BSG regulations.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Census Data...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Member Records</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
