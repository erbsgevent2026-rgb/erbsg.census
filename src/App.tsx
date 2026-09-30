import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { DashboardView } from "./pages/DashboardView";
import { MembersView } from "./pages/MembersView";
import { AnnualReportsView } from "./pages/AnnualReportsView";
import { CensusReportsView } from "./pages/CensusReportsView";
import { AuditedStatementsView } from "./pages/AuditedStatementsView";
import { OfficialContactsView } from "./pages/OfficialContactsView";
import { BasicDetailsView } from "./pages/BasicDetailsView";
import { DistrictManagementView } from "./pages/DistrictManagementView";
import { DistrictUsersView } from "./pages/DistrictUsersView";
import { MaintenanceModeView } from "./pages/MaintenanceModeView";
import { AuditLogsView } from "./pages/AuditLogsView";
import { EmailOutboxView } from "./pages/EmailOutboxView";
import { ProfileView } from "./pages/ProfileView";
import { SessionManagementView } from "./pages/SessionManagementView";
import { SupportFeedbackView } from "./pages/SupportFeedbackView";
import { MaintenanceScreen } from "./components/MaintenanceScreen";
import { Loader2, Wrench } from "lucide-react";

const STATE_ADMIN_ONLY_VIEWS = [
  "district-management",
  "district-users",
  "session-years",
  "maintenance-mode",
  "audit-logs",
  "email-outbox",
];

const PortalMain: React.FC = () => {
  const { user, loading, maintenanceMode } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    // Permanently enforce clean, default light mode
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("erbsg_theme");
  }, []);

  // Reset to dashboard whenever user session ID changes
  useEffect(() => {
    setCurrentView("dashboard");
  }, [user?.id]);

  // If a District User is on a State Administrator-only route, immediately redirect to dashboard
  useEffect(() => {
    if (user && user.role !== "STATE_ADMIN" && STATE_ADMIN_ONLY_VIEWS.includes(currentView)) {
      setCurrentView("dashboard");
    }
  }, [user, currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-amber-400 mx-auto" />
          <p className="text-sm font-semibold tracking-wider">
            Loading ERBSG Data Control Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // If Maintenance Mode is active, District Users immediately see the Website Under Maintenance screen
  if (user.role === "DISTRICT_USER" && maintenanceMode) {
    return <MaintenanceScreen />;
  }

  // Enforce first-login password change for default password accounts
  const isFirstLogin = !!user.mustChangePassword;

  const renderView = () => {
    const isStateAdmin = user.role === "STATE_ADMIN";

    // Strict frontend permission guard: prevent non-admins from rendering state admin modules
    if (!isStateAdmin && STATE_ADMIN_ONLY_VIEWS.includes(currentView)) {
      return (
        <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 dark:border-amber-800 mx-auto">
            <span className="text-2xl font-bold">!</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              State Administrator Access Required
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              This module is strictly restricted to Eastern Railway State Headquarters Administrators. District officers can access their assigned district operations from the navigation menu.
            </p>
          </div>
          <button
            onClick={() => setCurrentView("dashboard")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            Go to District Dashboard
          </button>
        </div>
      );
    }

    switch (currentView) {
      case "dashboard":
      case "analytics":
        return <DashboardView onNavigate={setCurrentView} />;
      case "basic-details":
        return <BasicDetailsView />;
      case "annual-reports":
        return <AnnualReportsView />;
      case "census-reports":
        return <CensusReportsView />;
      case "audited-statements":
        return <AuditedStatementsView />;
      case "official-contacts":
        return <OfficialContactsView />;
      case "members":
        return <MembersView />;
      case "support-feedback":
        return <SupportFeedbackView />;
      case "district-management":
        return <DistrictManagementView />;
      case "district-users":
        return <DistrictUsersView />;
      case "session-years":
        return <SessionManagementView onNavigate={setCurrentView} />;
      case "maintenance-mode":
        return <MaintenanceModeView />;
      case "audit-logs":
        return <AuditLogsView />;
      case "email-outbox":
        return <EmailOutboxView />;
      case "profile":
        return <ProfileView />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar (Desktop fixed / Mobile overlay) */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        isOpenMobile={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onNavigate={setCurrentView}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {/* Prominent Banner for State Admin when Maintenance Mode is Active */}
          {user.role === "STATE_ADMIN" && maintenanceMode && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-amber-500/10">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
                  <Wrench className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      MAINTENANCE MODE IS CURRENTLY ACTIVE
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-amber-300 mt-0.5">
                    District Users cannot access the normal dashboard and are seeing the "Website Under Maintenance" screen. Turn OFF to restore access.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentView("maintenance-mode")}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0 cursor-pointer shadow-xs"
              >
                Manage Maintenance
              </button>
            </div>
          )}

          {isFirstLogin ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 dark:border-amber-800 animate-pulse">
                <span className="text-2xl font-bold">!</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Password Change Required
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Please complete the mandatory password update in the security dialog to access your Eastern Railway Bharat Scouts and Guides portal.
                </p>
              </div>
            </div>
          ) : (
            renderView()
          )}
        </main>
      </div>

      {/* Forced Password Change Modal for accounts flagged with must_change_password */}
      {isFirstLogin && (
        <ChangePasswordModal
          isOpen={true}
          isFirstLogin={true}
          onSuccess={() => {
            setCurrentView("dashboard");
          }}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <PortalMain />
    </AuthProvider>
  );
}
