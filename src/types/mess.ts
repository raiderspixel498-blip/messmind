export type MealType = 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner';

export type DayCategory =
  | 'Academic'
  | 'Weekend'
  | 'Holiday'
  | 'Examination'
  | 'Vacation'
  | 'Campus Event';

export type RiskPosture = 'eco' | 'balanced' | 'zero_shortage';

export interface MealRecord {
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  menu: string; // Semicolon or comma separated items
  expected_students: number; // Mess staff planned headcount
  actual_students: number; // Actual students who ate
  event_info: string;
}

export interface FoodPrepRecord {
  date: string;
  meal_type: MealType;
  item_name: string;
  unit: 'kg' | 'L' | 'pcs';
  prepared_qty: number;
  consumed_qty: number;
  leftover_qty: number;
}

export interface CalendarRecord {
  date: string;
  day_of_week: string;
  day_category: DayCategory;
  event_name: string;
  attendance_impact: string;
}

export interface EnrichedMealRecord extends MealRecord {
  day_of_week: string;
  day_category: DayCategory;
  event_name: string;
  items: FoodPrepRecord[];
  total_prepared_kg_eq: number;
  total_consumed_kg_eq: number;
  total_leftover_kg_eq: number;
  waste_pct: number;
  shortage_occurred: boolean;
  attendance_error_staff: number; // expected - actual
  is_anomaly?: boolean;
  anomaly_reason?: string;
}

export interface PredictionInput {
  date: string;
  meal_type: MealType;
  day_category: DayCategory;
  event_name: string;
  menu: string;
  staff_planned_students: number;
  risk_posture: RiskPosture;
  hostel_registered_students?: number;
}

export interface FactorContribution {
  label: string;
  delta: number;
  detail: string;
}

export interface ItemRecommendation {
  item_name: string;
  unit: 'kg' | 'L' | 'pcs';
  per_student_avg: number;
  per_student_std: number;
  recommended_qty: number;
  wave1_qty: number;
  wave2_reserve_qty: number;
  staff_naive_qty: number;
  expected_consumed_qty: number;
  expected_waste_qty: number;
  shortage_prob_pct: number;
  unit_cost_inr: number;
  historical_waste_pct: number;
  supports_two_wave: boolean;
}

export interface StaffAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
}

export interface AnalogueMeal {
  date: string;
  day_of_week: string;
  day_category: DayCategory;
  menu: string;
  expected_students: number;
  actual_students: number;
  waste_pct: number;
}

export interface PredictionResult {
  input: PredictionInput;
  predicted_students: number;
  recommended_prep_headcount: number;
  ci_low: number;
  ci_high: number;
  std_dev: number;
  shortage_risk_pct: number;
  excess_risk_pct: number;
  staff_shortage_risk_pct: number;
  staff_excess_risk_pct: number;
  expected_waste_kg: number;
  staff_expected_waste_kg: number;
  estimated_savings_inr: number;
  co2_saved_kg: number;
  wave1_headcount: number;
  wave2_headcount: number;
  wave2_trigger_headcount: number;
  factors: FactorContribution[];
  baseline_students: number;
  reasoning_summary: string[];
  alerts: StaffAlert[];
  item_recommendations: ItemRecommendation[];
  analogues: AnalogueMeal[];
}

export interface WastageHotspot {
  item_name: string;
  meal_types: MealType[];
  unit: 'kg' | 'L' | 'pcs';
  appearances: number;
  total_prepared: number;
  total_consumed: number;
  total_leftover: number;
  avg_waste_pct: number;
  estimated_loss_inr: number;
  worst_condition: string;
  recommendation: string;
}

export interface ConditionWasteStat {
  condition: DayCategory;
  meals_count: number;
  avg_staff_expected: number;
  avg_actual: number;
  avg_over_prep_students: number;
  avg_waste_pct: number;
  total_leftover_kg: number;
}

export interface BacktestRow {
  date: string;
  day_of_week: string;
  meal_type: MealType;
  day_category: DayCategory;
  menu: string;
  staff_expected: number;
  ai_predicted: number;
  ai_recommended_prep: number;
  actual_ate: number;
  staff_abs_error: number;
  ai_abs_error: number;
  actual_waste_kg: number;
  ai_sim_waste_kg: number;
  staff_shortage: boolean;
  ai_shortage: boolean;
  reasoning_note: string;
}

export interface BacktestSummary {
  total_records_evaluated: number;
  warmup_records: number;
  staff_mae: number;
  ai_mae: number;
  mae_improvement_pct: number;
  staff_within_5pct_rate: number;
  ai_within_5pct_rate: number;
  historical_waste_kg: number;
  ai_simulated_waste_kg: number;
  waste_saved_kg: number;
  waste_reduction_pct: number;
  estimated_savings_inr: number;
  co2_avoided_kg: number;
  historical_shortages: number;
  ai_simulated_shortages: number;
  rows: BacktestRow[];
}

export interface DatasetBundle {
  meals: MealRecord[];
  foodPrep: FoodPrepRecord[];
  calendar: CalendarRecord[];
  sourceLabel: string;
}
