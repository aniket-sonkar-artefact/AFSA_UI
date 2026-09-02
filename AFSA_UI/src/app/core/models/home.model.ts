export interface HomeApiKpiValue {
  period: string;
  value: number;
}

export interface HomeApiKpi {
  id: string;
  current_value: number;
  yoy_pct: number;
  values: HomeApiKpiValue[];
}

export interface HomeApiAffiliate {
  name: string;
  current_value: number;
  yoy_pct: number;
}

export interface HomeApiWorkflowItem {
  agent_key: string;
  status: string;
  progress_pct: number;
  pending_steps: number;
  updated_at: string;
}

export interface HomeApiData {
  period: string;
  comparison_period: string;
  unit: string;
  kpis: HomeApiKpi[];
  affiliates: HomeApiAffiliate[];
  workflow: HomeApiWorkflowItem[];
}