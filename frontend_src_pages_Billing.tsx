import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, CreditCard, KeyRound } from "lucide-react";
import { AppShell, PageHeader } from "../components/AppShell";
import { useAuth } from "../lib/auth";
import { billingApi, openRazorpayCheckout, type BillingStatus } from "../lib/billing-api";
import { ApiError } from "../lib/api";

const PLANS = [
  {
    id: "MONTHLY" as const,
    label: "Monthly",
    price: "\u20b9999",
    period: "/ month",
    features: ["Full access to all features", "Unlimited tests & reports", "AI Laboratory Assistant", "Cancel anytime"],
  },
  {
    id: "ANNUAL" as const,
    label: "Annual",
    price: "\u20b95,999",
    period: "/ year",
    badge: "Save 2 months",
    features: ["Everything in Monthly", "Priority support", "Locked-in annual rate", "Best value"],
  },
];

export function Billing() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [keysSaving, setKeysSaving] = useState(false);
  const [keysSavedMsg, setKeysSavedMsg] = useState<string | null>(null);

  async function load() {
    const s = await billingApi.status();
    setStatus(s);
  }

  useEffect(() => {
    load();
  }, []);

  async function subscribe(plan: "MONTHLY" | "ANNUAL") {
    setError(null);
    setSuccessMsg(null);
    setBusyPlan(plan);
    try {
      const order = await billingApi.createOrder(plan);
      const updated = await openRazorpayCheckout(order, user?.email ?? "", user?.full_name ?? "");
      setStatus(updated);
      setSuccessMsg(`${plan === "MONTHLY" ? "Monthly" : "Annual"} plan activated successfully.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error && err.message !== "Payment cancelled") setError(err.message);
    } finally {
      setBusyPlan(null);
    }
  }

  async function saveKeys(e: FormEvent) {
    e.preventDefault();
    setKeysSaving(true);
    setKeysSavedMsg(null);
    setError(null);
    try {
      const res = await billingApi.setRazorpayKeys(keyId, keySecret);
      setKeysSavedMsg(`Saved - Key ID: ${res.razorpay_key_id_masked}`);
      setKeyId("");
      setKeySecret("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save Razorpay keys");
    } finally {
      setKeysSaving(false);
    }
  }

  const isActive = status?.status === "ACTIVE";
  const razorpayNotConfigured = status && !status.razorpay_key_id;

  return (
    <AppShell>
      <PageHeader title="Subscription & Billing" subtitle="Manage your WeighSure AI plan" />
      <div className="p-8 max-w-3xl space-y-6">
        {status && (
          <div className="bg-surface-raised border border-hairline rounded-lg p-5">
            <div className="text-sm font-semibold text-ink mb-2">Current Plan</div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono px-2 py-1 rounded ${isActive ? "bg-pass-bg text-pass" : "bg-warn-bg text-warn"}`}>
                {status.plan}
              </span>
              <span className="text-xs text-steel">{status.status}</span>
              {status.expires_at && (
                <span className="text-xs text-steel">
                  {isActive ? "Renews / expires" : "Expired"}: {new Date(status.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}

        {error && <div className="text-sm text-fail bg-fail-bg rounded-md px-4 py-3">{error}</div>}
        {successMsg && (
          <div className="flex items-center gap-2 text-sm text-pass bg-pass-bg rounded-md px-4 py-3">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {razorpayNotConfigured && isAdmin && (
          <form onSubmit={saveKeys} className="bg-surface-raised border border-hairline rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <KeyRound size={15} /> Connect Razorpay
            </div>
            <p className="text-xs text-steel">
              Enter your live Razorpay keys here once - they're saved directly to the database and never
              shown in full again. Get these from your Razorpay Dashboard under Settings - API Keys.
            </p>
            <div>
              <label className="text-xs font-medium text-steel">Key ID</label>
              <input
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="rzp_live_..."
                required
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono outline-none focus:border-brass"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-steel">Key Secret</label>
              <input
                type="password"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono outline-none focus:border-brass"
              />
            </div>
            {keysSavedMsg && <div className="text-sm text-pass bg-pass-bg rounded-md px-3 py-2">{keysSavedMsg}</div>}
            <button
              disabled={keysSaving}
              className="rounded-md bg-brass text-white text-sm font-medium px-4 py-2 hover:bg-brass-light transition-colors disabled:opacity-50"
            >
              {keysSaving ? "Saving..." : "Save Razorpay Keys"}
            </button>
          </form>
        )}

        {isAdmin ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {PLANS.map((plan) => (
              <div key={plan.id} className="bg-surface-raised border border-hairline rounded-lg p-6 relative">
                {plan.badge && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold bg-brass text-white px-2 py-1 rounded">
                    {plan.badge}
                  </span>
                )}
                <div className="text-sm font-semibold text-steel">{plan.label}</div>
                <div className="mt-1 mb-4">
                  <span className="text-3xl font-display font-bold text-ink">{plan.price}</span>
                  <span className="text-sm text-steel ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-steel">
                      <CheckCircle2 size={14} className="text-pass mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={busyPlan !== null || razorpayNotConfigured || (isActive && status?.plan === plan.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-ink text-white text-sm font-medium py-2.5 hover:bg-ink-light transition-colors disabled:opacity-50"
                >
                  <CreditCard size={14} />
                  {busyPlan === plan.id
                    ? "Processing..."
                    : isActive && status?.plan === plan.id
                    ? "Current Plan"
                    : `Subscribe - ${plan.price}`}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-steel">
            Only an Admin can manage the laboratory's subscription. Contact your lab administrator to
            upgrade or renew.
          </p>
        )}
      </div>
    </AppShell>
  );
}
