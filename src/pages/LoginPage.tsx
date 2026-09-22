import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  Shield,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Copy,
  Check,
  KeyRound,
  X
} from "lucide-react";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  // Keep only "BSG" pre-filled. The user enters the remaining numeric portion after it.
  const [identifier, setIdentifier] = useState("BSG");
  // The Password field must remain completely blank.
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"REQUEST" | "SENT" | "RESET" | "SUCCESS">("REQUEST");
  const [forgotIdent, setForgotIdent] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Check URL query parameters for reset_token on load
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("reset_token");
      if (token) {
        setResetToken(token);
        setForgotStep("RESET");
        setForgotModalOpen(true);
      }
    } catch (_) {}
  }, []);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Keep BSG as the leading prefix; user enters remaining portion after it
    if (!val.startsWith("BSG")) {
      const remaining = val.replace(/^BSG/i, "");
      val = `BSG${remaining}`;
    }
    setIdentifier(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password || loading || isSuccess) return;

    setLoading(true);
    setError(null);

    // Ensure the BSG prefix is part of the Login ID value submitted for authentication,
    // so the final login ID is in the format BSGXXXXXXXXX
    let cleanIdent = identifier.trim();
    if (!cleanIdent.toUpperCase().startsWith("BSG")) {
      cleanIdent = `BSG${cleanIdent}`;
    }

    try {
      const res = await login(
        cleanIdent,
        password,
        mfaRequired ? mfaCode : undefined,
        () => {
          setIsSuccess(true);
        }
      );
      if (res?.mfaRequired) {
        setMfaRequired(true);
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your BSG ID and password.");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    setForgotModalOpen(true);
    setForgotStep("REQUEST");
    setForgotError(null);
    setForgotIdent(identifier && identifier !== "BSG" ? identifier : "");
    setResetLink(null);
    setResetToken(null);
    setSentEmail(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdent) return;
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await api.forgotPassword(forgotIdent);
      setSentEmail(res.email || forgotIdent);
      setResetLink(res.resetLink || null);
      setResetToken(res.token || null);
      setForgotStep("SENT");
    } catch (err: any) {
      setForgotError(err.message || "Failed to generate password reset link. Please check your BSG ID or registered email.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      setForgotError("Reset token is missing or has expired. Please request a new reset link.");
      return;
    }
    if (newPassword.length < 6) {
      setForgotError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match. Please re-enter.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await api.resetPasswordWithToken({ token: resetToken, newPassword });
      setResetSuccessMessage(res.message);
      if (res.bsgId) {
        setIdentifier(res.bsgId);
      }
      setPassword("");
      setForgotStep("SUCCESS");
    } catch (err: any) {
      setForgotError(err.message || "Failed to reset password. The link may have expired.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen w-full login-animated-bg bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-between text-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Soft animated background light effects (pointer-events-none, respects reduced motion) */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-ambient-orb-1" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-ambient-orb-2" />

      {/* Top Banner */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center">
          <span className="font-extrabold text-sm sm:text-base tracking-wider text-white">
            ERBSG PORTAL
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-blue-900/50 border border-blue-700/50 text-blue-200 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Official Eastern Railway System</span>
        </div>
      </div>

      {/* Main Login Card - .login-container with page-load entrance animation */}
      <div className="login-container max-w-md w-full mx-auto my-8 animate-login-card-entrance relative z-10">
        <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border ${isSuccess ? "border-emerald-500/80 shadow-emerald-500/20" : "border-slate-200 dark:border-slate-800"} overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
          {/* Header with staggered animations */}
          <div className="bg-slate-950 p-6 text-center border-b border-slate-800 relative">
            <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center animate-stagger-logo">
              <img
                src="/erbsg-official-logo.svg"
                alt="Eastern Railway Bharat Scouts and Guides"
                className="w-24 h-24 object-contain rounded-full shadow-xl shadow-blue-950/60 animate-logo-gentle-float"
              />
            </div>
            <h1 className="text-sm font-extrabold uppercase tracking-wider text-blue-400 animate-stagger-heading">
              EASTERN RAILWAY BHARAT SCOUTS AND GUIDES
            </h1>
            <div className="animate-stagger-subheading">
              <h2 className="text-xl font-black text-white mt-1">
                Data Control Portal
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Official State & District Records Authorization
              </p>
            </div>
          </div>

          {/* Form with staggered entrance and subtle shake on invalid credentials */}
          <form
            onSubmit={handleSubmit}
            className={`p-6 sm:p-8 space-y-4 animate-stagger-form ${isShaking ? "animate-subtle-shake" : ""}`}
          >
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-id-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Login ID (BSG ID)
              </label>
              <div className="relative group">
                <input
                  id="login-id-input"
                  type="text"
                  required
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder="BSGXXXXXXXXX"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none login-input-transition font-medium shadow-sm focus:shadow-md focus:shadow-blue-500/10"
                />
                <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label htmlFor="password-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative group">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none login-input-transition shadow-sm focus:shadow-md focus:shadow-blue-500/10"
                />
                <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200 absolute left-3.5 top-3" />
                <button
                  type="button"
                  id="btn-toggle-password-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none cursor-pointer group/eye"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="inline-block transition-transform duration-200 ease-out group-hover/eye:scale-110 active:scale-90">
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-amber-500 transition-colors duration-200" />
                    ) : (
                      <Eye className="w-4 h-4 transition-colors duration-200" />
                    )}
                  </span>
                </button>
              </div>

              {/* 'Forgot Password?' link placed directly below the password input field */}
              <div className="flex items-center justify-between mt-2 px-0.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Trouble signing in?
                </span>
                <button
                  type="button"
                  id="btn-forgot-password"
                  onClick={openForgotPassword}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded px-1.5 py-0.5 inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  <span>Forgot Password?</span>
                </button>
              </div>
            </div>

            {mfaRequired && (
              <div className="pt-2 animate-in fade-in duration-200">
                <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> 6-Digit MFA Verification Code
                </label>
                <input
                  id="mfa-code-input"
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Enter code (default: 123456)"
                  className="w-full px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono tracking-widest text-center login-input-transition"
                />
              </div>
            )}

            <div className="animate-stagger-button pt-1">
              <button
                type="submit"
                id="btn-sign-in"
                disabled={loading || isSuccess}
                className={`w-full py-3 px-4 font-extrabold text-sm rounded-xl login-btn-transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 ${
                  isSuccess
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                    : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/20"
                }`}
              >
                {isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Access Authorized • Launching Dashboard...</span>
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="animate-pulse">Authenticating Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-7xl mx-auto w-full text-center text-xs text-slate-400 py-4 relative z-10">
        © 2026 Eastern Railway Bharat Scouts And Guides • District-Data/Census Isolation Enforced
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-white relative">
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* STEP 1: REQUEST RESET LINK */}
            {forgotStep === "REQUEST" && (
              <>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Request Password Reset Link</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Dispatches a verified secure link to your registered email
                    </p>
                  </div>
                </div>

                {forgotError && (
                  <div className="my-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleRequestResetLink} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Registered BSG ID or Email
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={forgotIdent}
                        onChange={(e) => setForgotIdent(e.target.value)}
                        placeholder="e.g. BSG-ER-STATE, BSG287206516, or your email"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      The secure link is valid for 1 hour and allows resetting your password safely.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending Link...</span>
                        </>
                      ) : (
                        <span>Send Reset Link</span>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 2: LINK DISPATCHED */}
            {forgotStep === "SENT" && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        Password Reset Link Dispatched
                      </h4>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                        A secure password reset link has been dispatched to your registered address:
                      </p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 inline-block">
                        {sentEmail}
                      </p>
                    </div>
                  </div>
                </div>

                {resetLink && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Secure Link Access
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={resetLink}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 truncate select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer"
                        title="Copy Reset Link"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep("RESET")}
                    className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Proceed to Reset Password Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SET NEW PASSWORD */}
            {forgotStep === "RESET" && (
              <>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Set New Password</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter and confirm your new account password
                    </p>
                  </div>
                </div>

                {forgotError && (
                  <div className="my-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleResetPasswordWithToken} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotModalOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl shadow flex items-center gap-1.5 transition disabled:opacity-60 cursor-pointer"
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Password...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 4: SUCCESS */}
            {forgotStep === "SUCCESS" && (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Password Updated Successfully
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {resetSuccessMessage || "Your password has been changed. You can now sign in using your new credentials."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotModalOpen(false);
                    const pwdInput = document.getElementById("password-input");
                    if (pwdInput) pwdInput.focus();
                  }}
                  className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  Sign In With New Password
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
