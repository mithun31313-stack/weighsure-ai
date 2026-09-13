import { api } from "./api";

export interface BillingStatus {
  plan: "TRIAL" | "MONTHLY" | "ANNUAL";
  status: "TRIAL" | "ACTIVE" | "EXPIRED";
  expires_at: string | null;
  razorpay_key_id: string | null;
}

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  razorpay_key_id: string;
  plan: string;
}

export const billingApi = {
  status: () => api.get<BillingStatus>("/billing/status"),
  createOrder: (plan: "MONTHLY" | "ANNUAL") =>
    api.post<CreateOrderResponse>("/billing/create-order", { plan }),
  verify: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
  }) => api.post<BillingStatus>("/billing/verify", payload),
  setRazorpayKeys: (keyId: string, keySecret: string) =>
    api.put<{ status: string; razorpay_key_id_masked: string }>("/billing/razorpay-keys", {
      key_id: keyId,
      key_secret: keySecret,
    }),
};

/** Loads Razorpay's checkout script once, reusing it on subsequent calls. */
let razorpayScriptPromise: Promise<void> | null = null;
export function loadRazorpayScript(): Promise<void> {
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

/**
 * Opens the Razorpay checkout modal for the given order, resolving with the
 * verified BillingStatus once payment completes and the backend confirms the
 * signature — or rejecting if the user cancels or verification fails.
 */
export async function openRazorpayCheckout(
  order: CreateOrderResponse,
  userEmail: string,
  userName: string
): Promise<BillingStatus> {
  await loadRazorpayScript();
  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: order.razorpay_key_id,
      amount: order.amount,
      currency: order.currency,
      name: "WeighSure AI",
      description: `${order.plan} Subscription`,
      order_id: order.order_id,
      prefill: { email: userEmail, name: userName },
      theme: { color: "#14243d" },
      handler: async (response: any) => {
        try {
          const status = await billingApi.verify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan: order.plan,
          });
          resolve(status);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });
    rzp.open();
  });
}
