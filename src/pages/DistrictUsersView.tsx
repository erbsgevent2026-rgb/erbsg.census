import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { DistrictUserRecord } from "../types";
import { exportToExcel } from "../utils/excelExport";
import {
  UserCog,
  UserPlus,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertCircle,
  Download,
  Building2,
  Lock,
  Search,
  Loader2,
  X
} from "lucide-react";

export const DistrictUsersView: React.FC = () => {
  const { districts, syncEventTimestamp } = useAuth();
  const [users, setUsers] = useState<DistrictUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New User Modal State
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    bsg_id: "",
    name: "",
    email: "",
    phone: "",
    district_id: districts[0]?.id || "dist_asn",
  });
  const [creating, setCreating] = useState(false);

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<DistrictUserRecord | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getDistrictUsers();
      setUsers(data);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to load users." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [syncEventTimestamp]);

  const filteredUsers = users.filter((u) => {
    return (
      searchQuery.trim() === "" ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.bsg_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.district_name && u.district_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setStatusMessage(null);

    try {
      await api.createDistrictUser(createForm);
      setStatusMessage({
        type: "success",
        text: `User ${createForm.name} (${createForm.bsg_id}) created with default password Test@1234. Welcome email dispatched.`,
      });
      setCreateUserOpen(false);
      setCreateForm({
        bsg_id: "",
        name: "",
        email: "",
        phone: "",
        district_id: districts[0]?.id || "dist_asn",
      });
      await fetchUsers();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to create user." });
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (userRecord: DistrictUserRecord) => {
    setResetting(true);
    try {
      const res = await api.resetDistrictPassword(userRecord.id);
      setStatusMessage({
        type: "success",
        text: `Password for ${userRecord.name} reset to: ${res.temporaryPassword || "Test@1234"}. Audit record and email notification logged.`,
      });
      setResettingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to reset password." });
    } finally {
      setResetting(false);
    }
  };

  const handleToggleStatus = async (userRecord: DistrictUserRecord) => {
    try {
      await api.toggleUserStatus(userRecord.id);
      await fetchUsers();
      setStatusMessage({
        type: "success",
        text: `Account status for ${userRecord.name} updated.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to toggle status." });
    }
  };

  const handleExport = () => {
    const rows = users.map((u, i) => ({
      "SL No": i + 1,
      "BSG ID": u.bsg_id,
      "Name": u.name,
      "Email": u.email,
      "District": u.district_name,
      "Role": u.role,
      "Status": u.status,
      "Must Change Password": u.must_change_password ? "YES" : "NO",
      "Last Login": u.last_login ? new Date(u.last_login).toLocaleString() : "Never",
    }));
    exportToExcel(rows, `ERBSG_Authorized_District_Users_${new Date().toISOString().slice(0, 10)}`, "District Users");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Identity & Access Management
            </span>
            <span className="text-xs font-semibold text-slate-500">Security Administration</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            District User Accounts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage authorized credentials, enforce first-login password changes, and oversee role credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => setCreateUserOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add District User</span>
          </button>
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

      {/* Users Table Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search by BSG ID, name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <span className="text-xs text-slate-500 font-semibold">
            {users.length} Active System Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">BSG ID</th>
                <th className="px-4 py-3">NAME & EMAIL</th>
                <th className="px-4 py-3">ASSIGNED DISTRICT</th>
                <th className="px-4 py-3 text-center">FIRST LOGIN STATUS</th>
                <th className="px-4 py-3 text-center">LAST LOGIN</th>
                <th className="px-4 py-3 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                  <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {u.bsg_id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {u.district_name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.must_change_password ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Default Password Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Password Updated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setResettingUser(u)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded flex items-center gap-1 mx-auto font-semibold text-[11px]"
                      title="Reset Password"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {createUserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold">Add New District User</h3>
              <button
                onClick={() => setCreateUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">BSG ID</label>
                <input
                  type="text"
                  required
                  value={createForm.bsg_id}
                  onChange={(e) => setCreateForm({ ...createForm, bsg_id: e.target.value })}
                  placeholder="e.g. BSG287206516"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. District Officer Name"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="district@erbsg.org"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Assigned District</label>
                <select
                  value={createForm.district_id}
                  onChange={(e) => setCreateForm({ ...createForm, district_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300">
                Initial temporary password will be automatically assigned as <span className="font-mono font-bold">Test@1234</span>. User will be mandated to change it upon first authentication.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateUserOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-sm"
                >
                  {creating ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-white">
            <h3 className="text-base font-bold mb-1">Reset Password: {resettingUser.name}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Reset password to temporary default for BSG ID: <span className="font-mono font-bold text-blue-600">{resettingUser.bsg_id}</span> ({resettingUser.district_name}). User will be required to change this password on next login.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleResetPassword(resettingUser)}
                disabled={resetting}
                className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-sm"
              >
                {resetting ? "Resetting..." : "Confirm Password Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
