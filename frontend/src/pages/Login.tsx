import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/lang";
import { Ruler } from "../components/Ruler";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { ApiError } from "../lib/api";

export function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("engineer@weighsure.ai");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Hero panel — the verification-scale motif at full scale */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink text-white flex-col justify-between p-12 relative overflow-hidden">
        <div>
          <div className="font-display text-2xl font-semibold">WeighSure AI</div>
          <div className="text-steel-light text-sm mt-1 font-mono">
            {t("app.tagline")}
          </div>
        </div>

        <div>
          <div className="text-6xl font-display font-semibold leading-none">
            ±1<span className="text-brass-light">e</span>
          </div>
          <p className="text-steel-light text-sm mt-4 max-w-sm leading-relaxed">
            {t("login.hero.line1")}
          </p>
        </div>

        <div>
          <Ruler ticks={70} majorEvery={5} color="#8296a8" />
          <div className="flex justify-between text-[10px] font-mono text-steel-light mt-2">
            <span>0e</span>
            <span>50e</span>
            <span>100e</span>
            <span>150e</span>
            <span>200e</span>
          </div>
        </div>
      </div>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-surface">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden">
              <div className="font-display text-xl font-semibold text-ink">WeighSure AI</div>
            </div>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">{t("login.title")}</h1>
          <p className="text-sm text-steel mt-1 mb-8">{t("login.subtitle")}</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-steel">{t("login.email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                placeholder="you@lab.org"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-steel">{t("login.password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-fail bg-fail-bg rounded-md px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-ink text-white text-sm font-medium py-2.5 hover:bg-ink-light transition-colors disabled:opacity-50"
            >
              {busy ? t("login.submitting") : t("login.submit")}
            </button>
          </form>

          <div className="mt-8 rounded-md border border-hairline bg-white p-4 text-xs text-steel font-mono leading-relaxed">
            <div className="font-semibold text-ink mb-1">{t("login.demo")}</div>
            admin@weighsure.ai / Admin@123<br />
            engineer@weighsure.ai / Engineer@123<br />
            reviewer@weighsure.ai / Reviewer@123
          </div>
        </div>
      </div>
    </div>
  );
}
