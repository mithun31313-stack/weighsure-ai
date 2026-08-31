// In local dev, Vite proxies /api to the backend (see vite.config.ts).
// For a production deployment where frontend and backend are hosted
// separately, set VITE_API_URL to the backend's full URL (e.g.
// https://weighsure-backend.onrender.com) in a .env file or your host's
// environment variable settings — no other code changes needed.
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

function getToken(): string | null {
  return localStorage.getItem("ws_token");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth: boolean = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET" }, auth),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, auth),
  put: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }, auth),
  postForm: <T>(path: string, form: FormData, auth = true) =>
    request<T>(path, { method: "POST", body: form }, auth),
  setToken: (token: string) => localStorage.setItem("ws_token", token),
  clearToken: () => localStorage.removeItem("ws_token"),
  getToken,
  downloadUrl: (path: string) => `${BASE}${path}`,
};

export interface ChatResponse {
  response: string;
  data: unknown;
}

export interface AppConfig {
  LLM_PROVIDER_API_KEY: string;
  LLM_PROVIDER_API_KEY_SET: boolean;
  ORG_NAME: string;
  PUBLIC_VERIFY_BASE_URL: string;
}

export interface ManagedUser {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  laboratory_id: number | null;
  is_active: boolean;
}

export interface AppNotification {
  id: number;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface LabInsight {
  summary_text: string;
  recent_fail_count: number;
  pending_review_count: number;
  sample_size: number;
}

export interface AuditLogEntry {
  id: number;
  actor_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: unknown;
  created_at: string;
}

// ---- Domain types ----
export type Role = "ADMIN" | "TEST_ENGINEER" | "REVIEWER";

export interface CurrentUser {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  laboratory_id: number | null;
  is_active: boolean;
}

export interface Instrument {
  id: number;
  instrument_code: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  instrument_type: string;
  accuracy_class: string;
  max_capacity: number;
  min_capacity: number;
  verification_scale_interval: number;
  display_resolution?: number | null;
  owner_customer?: string | null;
  laboratory_id: number;
  remarks?: string | null;
  date_of_test?: string | null;
  created_at: string;
}

export type TestStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FINALIZED";

export interface TestRecord {
  id: number;
  test_code: string;
  instrument_id: number;
  standard_version_id: number;
  engineer_id: number;
  reviewer_id: number | null;
  test_date: string;
  status: TestStatus;
  reviewer_comments?: string | null;
  created_at: string;
}

export interface TestResultRecord {
  id: number;
  observation_id: number;
  rule_id: number;
  test_type_code?: string | null;
  calculated_values: Record<string, unknown>;
  criterion_display: string;
  result: "PASS" | "FAIL";
  calculated_at: string;
}

export interface ReportRecord {
  id: number;
  report_id: string;
  test_id: number;
  overall_result: "PASS" | "FAIL";
  finalized_at: string | null;
  created_at: string;
}

export interface AttachmentRecord {
  id: number;
  test_id: number;
  category: string;
  filename: string;
  file_size_bytes: number | null;
  uploaded_by_id: number;
  uploaded_at: string;
}

export const TEST_TYPES = [
  { code: "weighing_performance", label: "Weighing Performance" },
  { code: "repeatability", label: "Repeatability" },
  { code: "eccentricity", label: "Eccentricity" },
  { code: "zero", label: "Zero Test" },
  { code: "tare", label: "Tare Test" },
] as const;

export const WORKFLOW_STAGES: TestStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "UNDER_REVIEW",
  "APPROVED",
  "FINALIZED",
];
