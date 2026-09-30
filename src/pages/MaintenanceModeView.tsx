import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Power,
  Eye,
  X,
  Database,
  Lock
} from "lucide-react";
import { MaintenanceScreen } from "../components/MaintenanceScreen";

export const MaintenanceModeView: React.FC = () => {
  const { user, maintenanceMode, maintenanceMessage, setMaintenanceMode, refreshMaintenanceMode } = useAuth();
  const [customMessage, setCustomMessage] = useState(
    maintenanceMessage || "ERBSG Data Control Portal is currently under maintenance. Please try again later."
  );

  useEffect(() => {
    if (maintenanceMessage) {
      setCustomMessage(maintenanceMessage);
    }
  }, [maintenanceMessage]);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [targetAction, setTargetAction] = useState<boolean>(!maintenanceMode);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (user?.role !== "STATE_ADMIN") {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 dark:border-amber-800 mx-auto">
          <ShieldCheck className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          State Administrator Access Required
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Maintenance Mode controls are restricted strictly to Eastern Railway State Administrators.
        </p>
      </div>
    );
  }

  const handleOpenConfirm = (turnOn: boolean) => {
    setTargetAction(turnOn);
    setShowConfirmModal(true);
  };

  const handleExecuteToggle = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await setMaintenanceMode(targetAction, customMessage);
      setShowConfirmModal(false);
      setFeedback({
        type: "success",
        text: targetAction
          ? "Maintenance Mode successfully ACTIVATED. District User portal access is now suspended and displaying the maintenance screen."
          : "Maintenance Mode successfully DEACTIVATED. Normal District User portal access has been fully restored."
      });
      await refreshMaintenanceMode();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Failed to update Maintenance Mode."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
              System Administration
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Eastern Railway State
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-amber-500" />
            <span>Maintenance Mode Control</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Control District User portal accessibility during scheduled administrative maintenance and system updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span>Preview District View</span>
          </button>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-medium animate-in fade-in duration-150 ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold">{feedback.type === "success" ? "Operation Successful" : "Action Failed"}</p>
            <p className="mt-0.5">{feedback.text}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Switch Card */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border transition-all ${
          maintenanceMode
            ? "bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
                  maintenanceMode
                    ? "bg-amber-500 text-slate-950"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    maintenanceMode ? "bg-slate-950 animate-ping" : "bg-emerald-500"
                  }`}
                />
                {maintenanceMode ? "Maintenance Mode Active" : "Normal Portal Operation"}
              </span>

              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {maintenanceMode ? "District Access Paused" : "District Access Open"}
              </span>
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {maintenanceMode
                ? "District User Portal is Currently in Maintenance Mode"
                : "District User Portal is Operating Normally"}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {maintenanceMode
                ? "All District Users attempting to access the portal or dashboard will see the 'Website Under Maintenance' screen. State Administrators retain complete unrestricted control over the Admin Panel."
                : "All District Users can log in, view their dashboards, update youth membership counts, unit details, and submit statutory reports without restriction."}
            </p>
          </div>

          {/* Toggle Action Button */}
          <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
            {maintenanceMode ? (
              <button
                onClick={() => handleOpenConfirm(false)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Power className="w-5 h-5" />
                <span>Deactivate Maintenance Mode (Turn OFF)</span>
              </button>
            ) : (
              <button
                onClick={() => handleOpenConfirm(true)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-sm shadow-md shadow-amber-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Power className="w-5 h-5" />
                <span>Activate Maintenance Mode (Turn ON)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Message Customization */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Maintenance Display Message
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            This message will be shown prominently to all District Users while Maintenance Mode is active.
          </p>
        </div>

        <div>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={2}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            placeholder="ERBSG Data Control Portal is currently under maintenance. Please try again later."
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Recommended: Clear, concise guidance for District Users.</span>
          <button
            onClick={() =>
              setCustomMessage(
                "ERBSG Data Control Portal is currently under maintenance. Please try again later."
              )
            }
            className="text-blue-600 hover:underline font-semibold"
          >
            Reset to Default Message
          </button>
        </div>
      </div>

      {/* Technical Guarantees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <h5 className="text-xs font-bold text-slate-900 dark:text-white">100% Data Preserved</h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            All Census entries, Member numbers, Unit Details, and statutory document files remain completely intact and untouched.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h5 className="text-xs font-bold text-slate-900 dark:text-white">Admin Access Maintained</h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            State Administrators can log in, access every management view, inspect records, and toggle maintenance anytime.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h5 className="text-xs font-bold text-slate-900 dark:text-white">Persistent &amp; Safe</h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            The Maintenance state persists across server restarts and deployments in the system settings database.
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  targetAction
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50"
                    : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50"
                }`}
              >
                {targetAction ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {targetAction ? "Activate Maintenance Mode?" : "Deactivate Maintenance Mode?"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {targetAction
                    ? "District Users will see the 'Website Under Maintenance' screen."
                    : "District Users will immediately regain normal portal access."}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1.5 border border-slate-200 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Notice:</p>
              <p>• State Administrator accounts and Admin Panel remain 100% accessible.</p>
              <p>• All database records, member figures, and statutory files remain untouched.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteToggle}
                disabled={loading}
                className={`px-5 py-2 rounded-lg text-white text-xs font-bold transition flex items-center gap-2 ${
                  targetAction
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {loading
                    ? "Applying..."
                    : targetAction
                    ? "Yes, Activate Maintenance"
                    : "Yes, Deactivate Maintenance"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto">
          <div className="bg-slate-900 border-b border-slate-800 p-3 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Eye className="w-4 h-4" />
              <span>Previewing District User View (What District Users See During Maintenance)</span>
            </div>
            <button
              onClick={() => setShowPreviewModal(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Close Preview</span>
            </button>
          </div>
          <div className="flex-1">
            <MaintenanceScreen />
          </div>
        </div>
      )}
    </div>
  );
};
