import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Scale,
  FlaskConical,
  FileCheck2,
  LogOut,
  Settings as SettingsIcon,
  CalendarClock,
  BarChart3,
  ScrollText,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/lang";
import { Ruler } from "./Ruler";
import { ChatWidget } from "./ChatWidget";
import { NotificationBell } from "./NotificationBell";
import { OfflineBanner } from "./OfflineBanner";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const NAV = [
    { to: "/", label: t("nav.dashboard"), icon: LayoutDashboard, end: true },
    { to: "/instruments", label: t("nav.instruments"), icon: Scale },
    { to: "/tests", label: t("nav.tests"), icon: FlaskConical },
    { to: "/calibrations", label: t("nav.calibrations"), icon: CalendarClock },
    { to: "/analytics", label: t("nav.analytics"), icon: BarChart3 },
    { to: "/reports", label: t("nav.reports"), icon: FileCheck2 },
    ...(user?.role === "ADMIN" || user?.role === "REVIEWER"
      ? [{ to: "/audit", label: t("nav.audit"), icon: ScrollText }]
      : []),
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="w-60 shrink-0 bg-ink text-white flex flex-col">
        <div className="px-5 py-6">
          <div className="font-display font-semibold text-lg tracking-tight">WeighSure AI</div>
          <div className="text-[11px] text-steel-light mt-0.5 font-mono">
            {t("app.tagline")}
          </div>
        </div>
        <Ruler className="px-5" ticks={26} majorEvery={4} color="#4A6178" />
        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-steel-light hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <LanguageSwitcher dark />
        </div>
        <div className="px-5 py-5 border-t border-white/10">
          <div className="text-sm font-medium">{user?.full_name}</div>
          <div className="text-[11px] text-steel-light font-mono mt-0.5">{user?.role}</div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="mt-3 flex items-center gap-2 text-xs text-steel-light hover:text-white transition-colors"
          >
            <LogOut size={14} /> {t("nav.signout")}
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 relative flex flex-col">
        <OfflineBanner />
        <div className="absolute top-4 right-6 z-40">
          <NotificationBell />
        </div>
        <div className="flex-1">{children}</div>
      </main>
      <ChatWidget />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-hairline bg-surface-raised">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-steel mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
