import type {
  AnomalyList,
  Forecast,
  Health,
  Overview,
  Patterns,
  Prediction,
  LocationRow,
  Recommendation,
  RecommendationInput,
  SegmentRow,
} from "./types";

// The browser always uses the public URL. Server-side (RSC data fetching) prefers an
// internal URL when set — in Docker Compose the API is reachable as http://api:8000 from
// the web container but as http://localhost:8000 from the user's browser.
const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const SERVER_BASE =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_BASE_URL ?? PUBLIC_BASE)
    : PUBLIC_BASE;

export const API_BASE_URL = SERVER_BASE.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = RequestInit & { query?: Record<string, string | number | undefined> };

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { query, ...init } = options;
  const url = new URL(API_BASE_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { "content-type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Is it running? (uvicorn api.app:app)`,
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json())?.detail ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(
      typeof detail === "string" ? detail : JSON.stringify(detail),
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<Health>("/health"),
  overview: () => request<Overview>("/analytics/overview"),
  patterns: () => request<Patterns>("/analytics/patterns"),
  locations: () => request<LocationRow[]>("/analytics/locations"),
  segments: () => request<SegmentRow[]>("/analytics/segments"),
  anomalies: (query?: { limit?: number; min_score?: number; risk?: string }) =>
    request<AnomalyList>("/anomalies", { query }),
  forecast: (hours = 24) => request<Forecast>("/forecast", { query: { hours } }),
  predictEnergy: (body: Record<string, unknown>) =>
    request<Prediction>("/predict/energy", { method: "POST", body: JSON.stringify(body) }),
  predictDuration: (body: Record<string, unknown>) =>
    request<Prediction>("/predict/duration", { method: "POST", body: JSON.stringify(body) }),
  recommend: (body: RecommendationInput) =>
    request<Recommendation>("/recommend", { method: "POST", body: JSON.stringify(body) }),
};
