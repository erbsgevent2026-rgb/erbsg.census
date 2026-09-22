import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { DashboardView } from "./pages/DashboardView";
import { MembersView } from "./pages/MembersView";
import { AnnualReportsView } from "./pages/AnnualReportsView";
import { AuditedStatementsView } from "./pages/AuditedStatementsView";
import { OfficialContactsView } from "./pages/OfficialContactsView";
import { BasicDetailsView } from "./pages/BasicDetailsView";
import { DistrictManagementView } from "./pages/DistrictManagementView";
import { DistrictUsersView } from "./pages/DistrictUsersView";
import { AuditLogsView } from "./pages/AuditLogsView";
import { EmailOutboxView } from "./pages/EmailOutboxView";
import { ProfileView } from "./pages/ProfileView";
import { Loader2 } from "lucide-react";

const PortalMain: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    // Permanently enforce clean, default light mode
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("erbsg_theme");
  }, []);

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

  // Enforce first-login password change for default password accounts
  const isFirstLogin = !!user.mustChangePassword;

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
      case "analytics":
        return <DashboardView onNavigate={setCurrentView} />;
      case "basic-details":
        return <BasicDetailsView />;
      case "annual-reports":
        return <AnnualReportsView />;
      case "audited-statements":
        return <AuditedStatementsView />;
      case "official-contacts":
        return <OfficialContactsView />;
      case "members":
        return <MembersView />;
      case "district-management":
        return <DistrictManagementView />;
      case "district-users":
        return <DistrictUsersView />;
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
            // Modal updates user context and closes
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
