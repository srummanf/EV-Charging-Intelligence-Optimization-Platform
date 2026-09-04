// Response shapes from the FastAPI service (api/). Kept in sync with api/schemas.py
// and evcharging.analytics.aggregate by hand.

export interface Health {
  status: "ok";
  models_loaded: string[];
  n_sessions: number;
  analytics_generated_at: string | null;
}

export interface Overview {
  n_sessions: number;
  date_start: string;
  date_end: string;
  n_stations: number;
  n_locations: number;
  n_vehicle_models: number;
  total_energy_kwh: number;
  mean_energy_kwh: number;
  median_energy_kwh: number;
  mean_duration_hours: number;
  total_cost_usd: number;
  mean_cost_usd: number;
  mean_charging_rate_kw: number;
  mean_soc_increase_pct: number;
  peak_hour: number;
  most_used_charger_type: string;
  highest_demand_location: string;
  data_quality: { n_sessions_flagged: number; pct_sessions_flagged: number };
}

export interface HourRow {
  hour: number;
  sessions: number;
  mean_energy_kwh: number | null;
  total_energy_kwh: number | null;
}
export interface WeekdayRow {
  day_name: string;
  sessions: number;
  mean_energy_kwh: number | null;
  mean_cost_usd: number | null;
}
export interface ChargerRow {
  charger_type: string;
  sessions: number;
  mean_energy_kwh: number | null;
  mean_duration_hours: number | null;
  mean_cost_usd: number | null;
  mean_charging_rate_kw: number | null;
}
export interface VehicleRow {
  vehicle_model: string;
  sessions: number;
  mean_energy_kwh: number | null;
  mean_battery_capacity_kwh: number | null;
  mean_distance_km: number | null;
}
export interface Patterns {
  by_hour: HourRow[];
  by_weekday: WeekdayRow[];
  by_charger_type: ChargerRow[];
  by_vehicle_model: VehicleRow[];
  weekend_vs_weekday: Record<
    "weekday" | "weekend",
    { sessions: number; mean_energy_kwh: number | null; mean_duration_hours: number | null; mean_cost_usd: number | null }
  >;
}

export interface LocationRow {
  location: string;
  sessions: number;
  n_stations: number;
  total_energy_kwh: number | null;
  mean_energy_kwh: number | null;
  mean_duration_hours: number | null;
  mean_cost_usd: number | null;
}

export interface SegmentRow {
  cluster: number;
  archetype: string | null;
  n_sessions: number;
  energy_kwh: number | null;
  duration_hours: number | null;
  distance_km: number | null;
  soc_delta_pct: number | null;
  charging_rate_kw: number | null;
  cost_usd: number | null;
}

export type Risk = "high" | "medium" | "normal";

export interface AnomalySession {
  index: number;
  station_id: string;
  location: string;
  vehicle_model: string;
  energy_kwh: number | null;
  battery_capacity_kwh: number | null;
  soc_delta_pct: number | null;
  anomaly_score: number;
  risk: Risk;
  reasons: string;
}
export interface AnomalyList {
  count: number;
  total_flagged: number;
  threshold: number;
  sessions: AnomalySession[];
}

export interface ForecastPoint {
  timestamp: string;
  hour: number;
  predicted_energy_kwh: number;
}
export interface HistoryPoint {
  timestamp: string;
  hour: number;
  energy_kwh: number;
}
export interface Forecast {
  horizon_hours: number;
  generated_from: string;
  history: HistoryPoint[];
  points: ForecastPoint[];
  baseline_mean_kwh: number;
  caveat: string;
}

export interface Prediction {
  prediction: number;
  unit: string;
  model: string;
  note: string;
}

export interface RecommendationInput {
  vehicle_model: string;
  battery_capacity_kwh: number;
  soc_start_pct: number;
  soc_target_pct: number;
  distance_km: number;
  earliest_hour: number;
  hours_available: number;
  temperature_c: number;
  user_type: string;
}

export interface ChargerOption {
  charger_type: string;
  power_kw: number;
  energy_kwh: number;
  duration_hours: number;
  cost_usd: number;
  fits_time_budget: boolean;
}

export interface Recommendation {
  recommended_charger: string;
  estimated_energy_kwh: number;
  estimated_duration_hours: number;
  estimated_cost_usd: number;
  charging_window: string;
  session_archetype: string | null;
  reason: string;
  model_energy_kwh: number | null;
  notes: string[];
  options: ChargerOption[];
}

export const VEHICLE_MODELS = [
  "BMW i3",
  "Chevy Bolt",
  "Hyundai Kona",
  "Nissan Leaf",
  "Tesla Model 3",
] as const;

export const USER_TYPES = ["Casual Driver", "Commuter", "Long-Distance Traveler"] as const;
