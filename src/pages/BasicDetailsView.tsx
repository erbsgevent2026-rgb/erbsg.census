import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { District } from "../types";
import { updateDistrictFirestore } from "../services/firestoreData";
import {
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  Shield,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Loader2
} from "lucide-react";

export const BasicDetailsView: React.FC = () => {
  const { user, districts, refreshDistricts, syncEventTimestamp } = useAuth();
  const isStateAdmin = user?.role === "STATE_ADMIN";

  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(
    user?.districtId || (districts[0]?.id || "dist_asn")
  );

  useEffect(() => {
    if (user?.districtId) {
      setSelectedDistrictId(user.districtId);
    } else if (districts.length > 0 && !districts.some(d => d.id === selectedDistrictId)) {
      setSelectedDistrictId(districts[0].id);
    }
  }, [user, districts, selectedDistrictId]);

  // Re-fetch districts on sync events so changes made by district users appear automatically
  useEffect(() => {
    if (syncEventTimestamp) {
      refreshDistricts();
    }
  }, [syncEventTimestamp]);

  const [form, setForm] = useState({
    name: "",
    code: "",
    state_name: "Eastern Railway",
    state_code: "ER",
    address: "",
    email: "",
    phone: "",
    established_year: 1952,
    registration_no: "",
  });

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const current = districts.find((d) => d.id === selectedDistrictId);
    if (current) {
      setForm({
        name: current.name,
        code: current.code,
        state_name: "Eastern Railway",
        state_code: "ER",
        address: current.address || "",
        email: current.email || "",
        phone: current.phone || "",
        established_year: current.established_year !== undefined && current.established_year !== null ? current.established_year : 1952,
        registration_no: current.registration_no || current.bsg_id || "",
      });
    }
  }, [selectedDistrictId, districts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStateAdmin) return;
    setSaving(true);
    setStatusMessage(null);

    const targetDistrictId = user?.districtId || selectedDistrictId;

    try {
      const res = await api.updateDistrict(targetDistrictId, {
        name: form.name,
        code: form.code,
        address: form.address,
        email: form.email,
        phone: form.phone,
        established_year: Number(form.established_year) || 1952,
        registration_no: form.registration_no,
      });

      try {
        await updateDistrictFirestore(
          targetDistrictId,
          {
            name: form.name,
            code: form.code,
            address: form.address,
            email: form.email,
            phone: form.phone,
            established_year: Number(form.established_year) || 1952,
            registration_no: form.registration_no,
          },
          user
        );
      } catch (fErr) {
        console.warn("Firestore sync optional warning:", fErr);
      }

      setStatusMessage({ type: "success", text: res.message || "District organizational details saved successfully." });
      await refreshDistricts();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update details." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Basic Organizational Details
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Official headquarters address, registration credentials, and statutory contact coordinates
          </p>
        </div>

        {isStateAdmin && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold self-start sm:self-auto">
            <Building2 className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id} className="text-slate-900 bg-white dark:bg-slate-800">
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isStateAdmin && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block">View-Only Administrator Mode</span>
            <span>
              Basic Organizational Details are maintained directly by the authorized District User. State Administrators have view-only access. Any updates submitted by the district will reflect here automatically.
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

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              District Association Credentials
            </h3>
            {isStateAdmin && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                View-Only Access
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                District Name
              </label>
              <input
                type="text"
                required
                disabled={isStateAdmin}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none ${
                  isStateAdmin
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-blue-500"
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official District Code
              </label>
              <input
                type="text"
                required
                disabled={isStateAdmin}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold font-mono focus:outline-none ${
                  isStateAdmin
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={isStateAdmin}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone / Extension
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  disabled={isStateAdmin}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`w-full pl-8 pr-3 py-2 border rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none ${
                    isStateAdmin
                      ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Established Year
              </label>
              <input
                type="number"
                disabled={isStateAdmin}
                value={form.established_year || ""}
                onChange={(e) => setForm({ ...form, established_year: parseInt(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:outline-none ${
                  isStateAdmin
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                BSG Unique Identifier
              </label>
              <input
                type="text"
                disabled={isStateAdmin}
                value={form.registration_no}
                onChange={(e) => setForm({ ...form, registration_no: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold font-mono focus:outline-none ${
                  isStateAdmin
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                }`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Headquarters Postal Address & Divisional Office
              </label>
              <textarea
                rows={2}
                disabled={isStateAdmin}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none ${
                  isStateAdmin
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-blue-500"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Save button only visible for District Users; completely removed for State Admin */}
        {!isStateAdmin && (
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Details...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Official Details</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
