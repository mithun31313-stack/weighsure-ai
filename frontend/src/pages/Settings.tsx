import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { StatusBadge } from "../components/Badges";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/lang";
import { api, ApiError, type AppConfig, type ManagedUser } from "../lib/api";

type Tab = "profile" | "app-config" | "users";

export function Settings() {
  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "profile", label: t("settings.tab.profile") },
    { id: "app-config", label: t("settings.tab.appconfig"), adminOnly: true },
    { id: "users", label: t("settings.tab.users"), adminOnly: true },
  ];

  return (
    <AppShell>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="p-8 max-w-3xl">
        <div className="flex gap-1 mb-6 border-b border-hairline">
          {tabs
            .filter((tb) => !tb.adminOnly || isAdmin)
            .map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === tb.id ? "border-brass text-ink" : "border-transparent text-steel hover:text-ink"
                }`}
              >
                {tb.label}
              </button>
            ))}
        </div>

        {tab === "profile" && <ProfileTab />}
        {tab === "app-config" && isAdmin && <AppConfigTab />}
        {tab === "users" && isAdmin && <UsersTab />}
      </div>
    </AppShell>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const { t } = useLang();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      await api.put("/settings/profile", { full_name: fullName });
      setSavedMsg(t("settings.saveprofile") + " ✓");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwError(null);
    setPwSaved(false);
    try {
      await api.post("/settings/change-password", { current_password: currentPw, new_password: newPw });
      setPwSaved(true);
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="bg-surface-raised border border-hairline rounded-lg p-6 space-y-4">
        <div className="text-sm font-semibold text-ink">{t("settings.profile")}</div>
        <div>
          <label className="text-xs font-medium text-steel">{t("settings.fullname")}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-steel">{t("settings.email")}</label>
          <input
            disabled value={user?.email ?? ""}
            className="mt-1 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-steel"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-steel">{t("settings.role")}</label>
          <div className="mt-1"><StatusBadge status={user?.role ?? ""} /></div>
        </div>
        {error && <div className="text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{error}</div>}
        {savedMsg && <div className="text-sm text-pass bg-pass-bg rounded-md px-3 py-2">{savedMsg}</div>}
        <button disabled={busy} className="rounded-md bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink-light transition-colors disabled:opacity-50">
          {busy ? t("settings.saving") : t("settings.saveprofile")}
        </button>
      </form>

      <form onSubmit={changePassword} className="bg-surface-raised border border-hairline rounded-lg p-6 space-y-4">
        <div className="text-sm font-semibold text-ink">{t("settings.changepassword")}</div>
        <div>
          <label className="text-xs font-medium text-steel">{t("settings.currentpw")}</label>
          <input
            type="password" required value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-steel">{t("settings.newpw")}</label>
          <input
            type="password" required minLength={8} value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
          />
        </div>
        {pwError && <div className="text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{pwError}</div>}
        {pwSaved && <div className="text-sm text-pass bg-pass-bg rounded-md px-3 py-2">{t("settings.changepassword")} ✓</div>}
        <button disabled={pwBusy} className="rounded-md bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink-light transition-colors disabled:opacity-50">
          {pwBusy ? t("settings.changing") : t("settings.changepassword")}
        </button>
      </form>
    </div>
  );
}

function AppConfigTab() {
  const { t } = useLang();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [orgName, setOrgName] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<AppConfig>("/settings/app-config").then((c) => {
      setConfig(c);
      setOrgName(c.ORG_NAME);
      setVerifyUrl(c.PUBLIC_VERIFY_BASE_URL);
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const updated = await api.put<AppConfig>("/settings/app-config", {
        LLM_PROVIDER_API_KEY: apiKey || undefined,
        ORG_NAME: orgName,
        PUBLIC_VERIFY_BASE_URL: verifyUrl,
      });
      setConfig(updated);
      setApiKey("");
      setSavedMsg(t("settings.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  if (!config) return <div className="text-sm text-steel">{t("dash.loading")}</div>;

  return (
    <form onSubmit={save} className="bg-surface-raised border border-hairline rounded-lg p-6 space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-steel">{t("settings.apikey")}</label>
          <span className={`text-[11px] font-mono ${config.LLM_PROVIDER_API_KEY_SET ? "text-pass" : "text-steel"}`}>
            {config.LLM_PROVIDER_API_KEY_SET ? `${t("settings.apikey.connected")} (${config.LLM_PROVIDER_API_KEY})` : t("settings.apikey.notset")}
          </span>
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.LLM_PROVIDER_API_KEY_SET ? "Enter a new key to replace the current one" : "sk-ant-..."}
          className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono outline-none focus:border-brass"
        />
        <p className="text-[11px] text-steel mt-1">{t("settings.apikey.hint")}</p>
      </div>

      <div>
        <label className="text-xs font-medium text-steel">{t("settings.orgname")}</label>
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-steel">{t("settings.verifyurl")}</label>
        <input
          value={verifyUrl}
          onChange={(e) => setVerifyUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass font-mono"
        />
        <p className="text-[11px] text-steel mt-1">{t("settings.verifyurl.hint")}</p>
      </div>

      {error && <div className="text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{error}</div>}
      {savedMsg && <div className="text-sm text-pass bg-pass-bg rounded-md px-3 py-2">{savedMsg}</div>}

      <button disabled={busy} className="rounded-md bg-brass text-white text-sm font-medium px-4 py-2 hover:bg-brass-light transition-colors disabled:opacity-50">
        {busy ? t("settings.saving") : t("settings.saveconfig")}
      </button>
    </form>
  );
}

const emptyUserForm = { full_name: "", email: "", password: "", role: "TEST_ENGINEER" };

function UsersTab() {
  const { t } = useLang();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyUserForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api.get<ManagedUser[]>("/settings/users");
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/settings/users", form);
      setForm(emptyUserForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: ManagedUser) {
    await api.put(`/settings/users/${u.id}`, { is_active: !u.is_active });
    await load();
  }

  async function changeRole(u: ManagedUser, role: string) {
    await api.put(`/settings/users/${u.id}`, { role });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-md bg-ink text-white text-sm font-medium px-4 py-2 hover:bg-ink-light transition-colors"
        >
          <Plus size={15} /> {showForm ? t("instr.cancel") : t("settings.adduser")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createUser} className="bg-surface-raised border border-hairline rounded-lg p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-steel">{t("settings.fullname")}</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass" />
          </div>
          <div>
            <label className="text-xs font-medium text-steel">{t("settings.email")}</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass" />
          </div>
          <div>
            <label className="text-xs font-medium text-steel">{t("settings.temppassword")}</label>
            <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass" />
          </div>
          <div>
            <label className="text-xs font-medium text-steel">{t("settings.role")}</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass">
              <option value="TEST_ENGINEER">Test Engineer</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {error && <div className="col-span-2 text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{error}</div>}
          <div className="col-span-2">
            <button disabled={busy} className="rounded-md bg-brass text-white text-sm font-medium px-5 py-2 hover:bg-brass-light transition-colors disabled:opacity-50">
              {busy ? t("settings.creating") : t("settings.createuser")}
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface-raised border border-hairline rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-steel border-b border-hairline">
              <th className="px-5 py-3 font-medium">{t("settings.col.name")}</th>
              <th className="px-5 py-3 font-medium">{t("settings.col.email")}</th>
              <th className="px-5 py-3 font-medium">{t("settings.col.role")}</th>
              <th className="px-5 py-3 font-medium">{t("settings.col.status")}</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-hairline last:border-0 hover:bg-surface">
                <td className="px-5 py-3">{u.full_name}</td>
                <td className="px-5 py-3 font-mono text-xs">{u.email}</td>
                <td className="px-5 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="text-xs rounded border border-hairline px-2 py-1 outline-none focus:border-brass"
                  >
                    <option value="TEST_ENGINEER">Test Engineer</option>
                    <option value="REVIEWER">Reviewer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-mono ${u.is_active ? "text-pass" : "text-fail"}`}>
                    {u.is_active ? t("settings.active") : t("settings.disabled")}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => toggleActive(u)} className="text-xs text-ink-light font-medium hover:underline">
                    {u.is_active ? t("settings.disable") : t("settings.enable")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
