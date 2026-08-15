export interface VarianceRow {
  item: string;
  current: number;
  comparison: number;
  variance: number;
  varPct: string;
  analysis: string;
  isSubtotal?: boolean;
}

export interface VarianceFilters {
  period: string;
  comparison: string;
  entity: string;
  currency: string;
}
