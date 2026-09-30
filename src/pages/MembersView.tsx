import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { MemberCounts, UnitDetails, DeadlineRecord, CensusConfirmation } from "../types";
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
  AlertCircle,
  Loader2,
  Shield,
  Layers,
  Lock,
  Unlock,
  Eye,
  X,
  FileCheck,
  Edit3,
  ShieldCheck,
  Check
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

  // Census Confirmation & Locking State
  const [confirmation, setConfirmation] = useState<CensusConfirmation | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [certified, setCertified] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);

  const isConfirmed = Boolean(confirmation?.is_confirmed);
  // District Users are locked once final confirmation is complete; Admin ALWAYS has editing capability!
  const isEditable = isStateAdmin ? true : !isConfirmed;

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
      if (res.confirmation) {
        setConfirmation(res.confirmation);
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
      if (res.confirmation) {
        setConfirmation(res.confirmation);
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

  const fetchConfirmation = async () => {
    try {
      const conf = await api.getCensusConfirmation(targetDistrictId, selectedYear);
      if (conf) {
        setConfirmation(conf);
      }
    } catch (_) {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchUnitDetails();
    fetchConfirmation();
  }, [targetDistrictId, selectedYear, syncEventTimestamp]);

  const handleUnitInputChange = (field: keyof UnitDetails, value: string) => {
    if (!isEditable) return;
    const num = Math.max(0, parseInt(value) || 0);
    setUnitDetails((prev) => ({
      ...prev,
      [field]: num,
    }));
  };

  const handleSaveUnitDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isEditable) return;

    setUnitSaving(true);
    setUnitStatusMessage(null);

    try {
      const res = await api.saveUnitDetails(targetDistrictId, selectedYear, unitDetails);
      saveUnitDetailsFirestore(targetDistrictId, selectedYear, unitDetails, user).catch((fsErr) =>
        console.warn("Background firestore unit details sync notice:", fsErr)
      );

      const targetDistrictObj = districts.find((d) => d.id === targetDistrictId);
      const name = targetDistrictObj?.name || districtName;
      setUnitStatusMessage({
        type: "success",
        text: isStateAdmin
          ? `Unit Details for ${name} saved successfully by Administrator.`
          : res.message || "Unit Details saved successfully."
      });
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
    if (!isEditable) return;
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
      // Cub Masters & Assistants, Scout Masters & Assistants, Rover Scout Leaders & Assistants, Lady Cub Masters
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

  const handleSaveMembers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isEditable) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      // 1. Perform write to server database (SQLite & Audit Logging)
      const res = await api.saveMembers(targetDistrictId, selectedYear, members);

      // 2. Persist to Firestore & Trigger Firestore Audit Logging Interceptor
      saveMemberCountsFirestore(targetDistrictId, selectedYear, members, user).catch((fsErr) =>
        console.warn("Background firestore member sync notice:", fsErr)
      );

      const targetDistrictObj = districts.find((d) => d.id === targetDistrictId);
      const name = targetDistrictObj?.name || districtName;

      setStatusMessage({
        type: "success",
        text: isStateAdmin
          ? `Census member records for ${name} saved successfully by Administrator.`
          : res.message || "Membership records saved and persisted successfully."
      });
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

  // Perform Final Confirmation
  const handleFinalConfirmation = async () => {
    if (!certified) return;
    try {
      setConfirming(true);
      // First ensure any pending edits to Unit Details and Members are committed
      await api.saveUnitDetails(targetDistrictId, selectedYear, unitDetails);
      await api.saveMembers(targetDistrictId, selectedYear, members);

      // Now call confirmation endpoint
      const res = await api.confirmCensus(targetDistrictId, selectedYear);
      if (res.confirmation) {
        setConfirmation(res.confirmation);
      }
      setShowReviewModal(false);
      setCertified(false);
      setStatusMessage({
        type: "success",
        text: "Annual Census Return has been officially confirmed and locked. Submitted data is now read-only."
      });
      await fetchMembers();
      await fetchUnitDetails();
      await fetchConfirmation();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to submit final confirmation."
      });
    } finally {
      setConfirming(false);
    }
  };

  // State Admin Unlock Handler
  const handleUnlockCensus = async () => {
    if (!isStateAdmin) return;
    try {
      setUnlocking(true);
      await api.unlockCensus(targetDistrictId, selectedYear);
      setShowUnlockModal(false);
      setStatusMessage({
        type: "success",
        text: `Annual Census Return for ${districtName} has been unlocked. District Users may now edit and re-submit.`
      });
      await fetchConfirmation();
      await fetchMembers();
      await fetchUnitDetails();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to unlock census return."
      });
    } finally {
      setUnlocking(false);
    }
  };

  const activeDistrictObj = districts.find((d) => d.id === targetDistrictId);
  const districtName = activeDistrictObj?.name || user?.districtName || "District";
  const yearLabel = availableYears.find((y) => y.id === selectedYear)?.label || "2026-2027";

  const totalUnitsCount =
    (Number(unitDetails.bulbul_flock) || 0) +
    (Number(unitDetails.guide_company) || 0) +
    (Number(unitDetails.ranger_team) || 0) +
    (Number(unitDetails.cub_pack) || 0) +
    (Number(unitDetails.scout_troop) || 0) +
    (Number(unitDetails.rover_crew) || 0);

  return (
    <div className="space-y-6">
      {/* Top Banner: Annual Census Return & District Selector */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isConfirmed ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"}`}>
            {isConfirmed ? <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Clock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                Annual Census Return (Scout/Guide Wing)
              </span>
              {isConfirmed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <Lock className="w-3 h-3" /> Confirmed & Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <Edit3 className="w-3 h-3" /> In Progress
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isConfirmed && confirmation?.confirmed_at ? (
                <span>
                  Final confirmation submitted on {new Date(confirmation.confirmed_at).toLocaleString()}
                  {confirmation.confirmed_by_name ? ` by ${confirmation.confirmed_by_name}` : ""}
                  {confirmation.confirmed_by_bsg_id ? ` (${confirmation.confirmed_by_bsg_id})` : ""}
                </span>
              ) : (
                <span>
                  Last saved: {members.updated_at ? new Date(members.updated_at).toLocaleString() : "Initial System Seed"}
                  {members.updated_by ? ` by ${members.updated_by}` : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* District Selector for State Admin or District indicator for District User */}
          {isStateAdmin ? (
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium">
              <Building2 className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0" />
              <select
                value={targetDistrictId}
                onChange={(e) => setTargetDistrictId(e.target.value)}
                className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id} className="text-slate-900 bg-white dark:bg-slate-800">
                    {d.name} ({d.code})
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

          {/* Confirm & Review Button for District User (or View Submitted for Locked / Admin) */}
          {!isStateAdmin && !isConfirmed && (
            <button
              type="button"
              onClick={() => {
                setCertified(false);
                setShowReviewModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Confirm & Review</span>
            </button>
          )}

          {/* View Summary Button when locked or for Admin review */}
          {(isConfirmed || isStateAdmin) && (
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Review Census Return</span>
            </button>
          )}

          {/* Unlock Button for State Admin when District is locked */}
          {isStateAdmin && isConfirmed && (
            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              title="Unlock to allow District User to re-edit"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock for District</span>
            </button>
          )}

          <button
            onClick={() => exportMembersToExcel(members, districtName, yearLabel)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download Excel</span>
          </button>
        </div>
      </div>

      {/* Role & Status Guidance Banners */}
      {isStateAdmin ? (
        <div className="p-4 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-blue-950 dark:text-blue-200 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">State Administrator Editing & Oversight</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-600 text-white">
                  Active for {districtName}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-blue-900/90 dark:text-blue-300">
                You have unrestricted authorization to view, edit, and save all four sections (Unit Details, Youth Members, Unit Leaders, Professionals/Staff) for <strong>{districtName}</strong>. All changes are saved strictly against {districtName} and will not affect any other district.
              </p>
            </div>
          </div>
          {isConfirmed && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold shrink-0 self-start sm:self-auto text-xs">
              <Lock className="w-3.5 h-3.5" /> District Confirmed & Locked
            </span>
          )}
        </div>
      ) : isConfirmed ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-start gap-3 text-emerald-950 dark:text-emerald-200 shadow-2xs">
          <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-extrabold text-sm block">
              Annual Census Return Officially Finalized & Locked
            </span>
            <p className="text-emerald-900/90 dark:text-emerald-300">
              Your district’s Annual Census Return for <strong>{yearLabel}</strong> has been officially confirmed and submitted. All fields across Unit Details, Youth Members, Unit Leaders, and Professionals/Staff are now in <strong>read-only mode</strong>. If any adjustments or amendments are required, please contact the Eastern Railway State Administrator.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-950 dark:text-amber-200 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <Edit3 className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-sm block">Step-by-Step Census Return Workflow</span>
              <p className="text-amber-900/90 dark:text-amber-300 mt-0.5">
                Complete and review the 4 sections below: <strong>1. Unit Details</strong>, <strong>2. Youth Members</strong>, <strong>3. Unit Leaders</strong>, and <strong>4. Professionals/Staff</strong>. After entering your figures, click <strong>"Confirm & Review"</strong> to review the consolidated census and submit your Final Confirmation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCertified(false);
              setShowReviewModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs transition shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Confirm & Review</span>
          </button>
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
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

      {/* Auto-Calculated Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Total Units
            </span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalUnitsCount.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Section 1: Flocks, Packs, Troops, Crews</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Youth Members
            </span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">
            {members.youth_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-1">Section 2: Cubs to Rangers</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              Unit Leaders
            </span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 dark:text-purple-100 mt-1">
            {members.unit_leaders_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-1">Section 3: Leaders & Assistants</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Professionals/Staff
            </span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">
            {members.professionals_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">Section 4: Staff & Commissioners</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Grand Total
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">
            {members.grand_total.toLocaleString()}
          </div>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">Total registered strength</p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: UNIT DETAILS                                  */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
                  Section 1: Unit Details
                </h3>
                {isConfirmed && !isStateAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
                {isStateAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    Admin Editing Available
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Number of registered units across sections in {districtName} • Total Units: {totalUnitsCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && (
              <button
                type="button"
                onClick={() => handleSaveUnitDetails()}
                disabled={unitSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              >
                {unitSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isStateAdmin ? "Save Unit Details (Admin)" : "Save Unit Details"}</span>
              </button>
            )}
          </div>
        </div>

        {unitStatusMessage && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border text-xs flex items-center justify-between font-medium ${
              unitStatusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {unitStatusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{unitStatusMessage.text}</span>
            </div>
            <button onClick={() => setUnitStatusMessage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Female Wing Units */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
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
                  disabled={!isEditable}
                  value={unitDetails.bulbul_flock || ""}
                  onChange={(e) => handleUnitInputChange("bulbul_flock", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                    !isEditable
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
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
                  disabled={!isEditable}
                  value={unitDetails.guide_company || ""}
                  onChange={(e) => handleUnitInputChange("guide_company", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                    !isEditable
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
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
                  disabled={!isEditable}
                  value={unitDetails.ranger_team || ""}
                  onChange={(e) => handleUnitInputChange("ranger_team", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                    !isEditable
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Male Wing Units */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
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
                  disabled={!isEditable}
                  value={unitDetails.cub_pack || ""}
                  onChange={(e) => handleUnitInputChange("cub_pack", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                    !isEditable
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
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
                  disabled={!isEditable}
                  value={unitDetails.scout_troop || ""}
                  onChange={(e) => handleUnitInputChange("scout_troop", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                    !isEditable
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
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
                  disabled={!isEditable}
                  value={unitDetails.rover_crew || ""}
                  onChange={(e) => handleUnitInputChange("rover_crew", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                    !isEditable
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  }`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTIONS 2, 3, 4: MEMBERSHIP CENSUS                      */}
      {/* ======================================================== */}

      {/* Section 2: Youth Members */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-blue-700 dark:text-blue-300 text-sm sm:text-base tracking-tight">
                Section 2: Youth Members
              </h3>
              {isConfirmed && !isStateAdmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Cubs, Bulbuls, Scouts, Guides, Rovers, Rangers
            </p>
          </div>
          <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300 px-3 py-1 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
            Youth Subtotal: {members.youth_total.toLocaleString()}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Female Wing */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Female Wing
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
                    disabled={!isEditable}
                    value={members[cat.key] || ""}
                    onChange={(e) => handleInputChange(cat.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                      !isEditable
                        ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    }`}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Male Wing */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Male Wing
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
                    disabled={!isEditable}
                    value={members[cat.key] || ""}
                    onChange={(e) => handleInputChange(cat.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                      !isEditable
                        ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    }`}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Unit Leaders */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-purple-700 dark:text-purple-300 text-sm sm:text-base tracking-tight">
                Section 3: Unit Leaders
              </h3>
              {isConfirmed && !isStateAdmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Qualified Scouters, Guiders, Captains, Masters & Assistants
            </p>
          </div>
          <span className="text-xs font-extrabold text-purple-700 dark:text-purple-300 px-3 py-1 bg-purple-50 dark:bg-purple-900/40 rounded-lg">
            Unit Leaders Subtotal: {members.unit_leaders_total.toLocaleString()}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Leadership Row 1 */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Flock, Guide & Ranger Leadership
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
                    disabled={!isEditable}
                    value={members[cat.key] || ""}
                    onChange={(e) => handleInputChange(cat.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                      !isEditable
                        ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    }`}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Leadership Row 2 */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Cub, Scout & Rover Leadership
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Cub Masters & Assistants", key: "cub_masters" as const },
                { label: "Lady Cub Masters", key: "lady_cub_masters" as const },
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
                    disabled={!isEditable}
                    value={members[cat.key] || ""}
                    onChange={(e) => handleInputChange(cat.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                      !isEditable
                        ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    }`}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Professionals/Staff */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-amber-700 dark:text-amber-300 text-sm sm:text-base tracking-tight">
                Section 4: Professionals/Staff
              </h3>
              {isConfirmed && !isStateAdmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Full-time and honorary staff, commissioners, and support professionals
            </p>
          </div>
          <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 px-3 py-1 bg-amber-50 dark:bg-amber-900/40 rounded-lg">
            Staff Subtotal: {members.professionals_total.toLocaleString()}
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
                disabled={!isEditable}
                value={members[cat.key] || ""}
                onChange={(e) => handleInputChange(cat.key, e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-semibold focus:outline-none transition ${
                  !isEditable
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                }`}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="font-bold text-sm text-slate-900 dark:text-white block">
            Annual Census Return Action Bar
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isStateAdmin ? (
              <span>
                State Administrator controls for <strong>{districtName}</strong> ({yearLabel}). Editing and saving are unrestricted.
              </span>
            ) : isConfirmed ? (
              <span>
                Your Annual Census Return is finalized and locked. Editing is no longer permitted for District Users.
              </span>
            ) : (
              <span>
                Save draft figures anytime or proceed to <strong>Confirm & Review</strong> for official submission.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Admin Save Button */}
          {isStateAdmin && (
            <button
              type="button"
              onClick={() => handleSaveMembers()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Member Records (Admin)</span>
            </button>
          )}

          {/* District User Save Draft & Confirm & Review */}
          {!isStateAdmin && !isConfirmed && (
            <>
              <button
                type="button"
                onClick={() => handleSaveMembers()}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Draft Figures</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCertified(false);
                  setShowReviewModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Confirm & Review</span>
              </button>
            </>
          )}

          {/* When Locked: Provide View Summary Button */}
          {!isStateAdmin && isConfirmed && (
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>View Confirmed Census Return</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* REVIEW & FINAL CONFIRMATION MODAL                        */}
      {/* ======================================================== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isConfirmed ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"}`}>
                  {isConfirmed ? <FileCheck className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Annual Census Return – Review & Confirmation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Eastern Railway Bharat Scouts and Guides • <strong>{districtName}</strong> • {yearLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {/* Grand Total Highlight */}
              <div className="bg-linear-to-r from-slate-900 to-blue-950 text-white p-5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                    Combined Grand Total Strength
                  </span>
                  <div className="text-3xl font-black mt-1 text-white">
                    {members.grand_total.toLocaleString()} Members
                  </div>
                  <p className="text-xs text-blue-200/80 mt-0.5">
                    Official combined registration for Eastern Railway Bharat Scouts & Guides
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white/10 p-2.5 rounded-lg">
                    <span className="text-[10px] text-slate-300 block">Units</span>
                    <span className="font-extrabold text-sm">{totalUnitsCount}</span>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-lg">
                    <span className="text-[10px] text-blue-300 block">Youth</span>
                    <span className="font-extrabold text-sm">{members.youth_total}</span>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-lg">
                    <span className="text-[10px] text-purple-300 block">Leaders</span>
                    <span className="font-extrabold text-sm">{members.unit_leaders_total}</span>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-lg">
                    <span className="text-[10px] text-amber-300 block">Staff</span>
                    <span className="font-extrabold text-sm">{members.professionals_total}</span>
                  </div>
                </div>
              </div>

              {/* Four Sections Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Unit Details */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      1. Unit Details
                    </span>
                    <span className="font-black text-xs text-emerald-700 dark:text-emerald-400">
                      Total: {totalUnitsCount} Units
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Bulbul Flock:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{unitDetails.bulbul_flock}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Guide Company:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{unitDetails.guide_company}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Ranger Team:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{unitDetails.ranger_team}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Cub Pack:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{unitDetails.cub_pack}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Scout Troop:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{unitDetails.scout_troop}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400">Rover Crew:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{unitDetails.rover_crew}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Youth Members */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      2. Youth Members
                    </span>
                    <span className="font-black text-xs text-blue-700 dark:text-blue-400">
                      Subtotal: {members.youth_total}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Bulbuls:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.bulbul}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Guides:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.guide}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Rangers:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.ranger}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Cubs:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.cub}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Scouts:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.scout}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400">Rovers:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.rover}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Unit Leaders */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-600" />
                      3. Unit Leaders
                    </span>
                    <span className="font-black text-xs text-purple-700 dark:text-purple-400">
                      Subtotal: {members.unit_leaders_total}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Flock Leaders & Assistants:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.flock_leaders}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Guide Captains & Assistants:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.guide_captains}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Ranger Leaders & Assistants:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.ranger_leaders}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Cub Masters & Assistants:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.cub_masters}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Lady Cub Masters:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.lady_cub_masters}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Scout Masters & Assistants:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.scout_masters || 0}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400 truncate">Rover Scout Leaders:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.rover_scout_leaders || 0}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Professionals/Staff */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-600" />
                      4. Professionals/Staff
                    </span>
                    <span className="font-black text-xs text-amber-700 dark:text-amber-400">
                      Subtotal: {members.professionals_total}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Professional Guides:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.professional_guides}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Voluntary Commissioners:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.voluntary_commissioners}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-750">
                      <span className="text-slate-600 dark:text-slate-400">Support Staff:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.support_staff}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400">Professionals / Staff:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{members.professionals_staff}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status or Declaration Box */}
              {isConfirmed ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Annual Census Return Officially Verified & Confirmed</span>
                  </div>
                  <p className="text-emerald-900/80 dark:text-emerald-400">
                    Submitted on {new Date(confirmation!.confirmed_at!).toLocaleString()}
                    {confirmation?.confirmed_by_name ? ` by ${confirmation.confirmed_by_name}` : ""}
                    {confirmation?.confirmed_by_bsg_id ? ` [BSG ID: ${confirmation.confirmed_by_bsg_id}]` : ""}.
                    Records are locked and protected from inadvertent modifications.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950 dark:text-amber-200">
                      <span className="font-bold block">Statutory Lock Notice:</span>
                      <span>
                        Final Confirmation is a permanent organizational submission. Once submitted, all census records for <strong>{districtName}</strong> will become <strong>read-only / locked</strong> on the District User Panel. District Users will no longer be able to edit or modify these details.
                      </span>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium cursor-pointer pt-2 border-t border-amber-200/80 dark:border-amber-900/60">
                    <input
                      type="checkbox"
                      checked={certified}
                      onChange={(e) => setCertified(e.target.checked)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>
                      I hereby verify and certify on behalf of <strong>{districtName}</strong> that the census details above across Unit Details, Youth Members, Unit Leaders, and Professionals/Staff have been checked for completeness and accuracy, and I authorize the official submission of this Annual Census Return for {yearLabel}.
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                {isConfirmed ? "Close" : "Back to Edit"}
              </button>

              {!isConfirmed && (
                <button
                  type="button"
                  onClick={handleFinalConfirmation}
                  disabled={!certified || confirming}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg transition-all shadow-md cursor-pointer"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Confirmation...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Final Confirmation</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* UNLOCK CONFIRMATION MODAL (ADMIN ONLY)                   */}
      {/* ======================================================== */}
      {showUnlockModal && isStateAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
                <Unlock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Unlock District Census Return?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  You are about to unlock the Annual Census Return for <strong>{districtName}</strong> ({yearLabel}).
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900">
              Unlocking will allow District Users for {districtName} to edit their census figures and submit a new Final Confirmation.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlockCensus}
                disabled={unlocking}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
              >
                {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                <span>Confirm Unlock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
