export type PayType = 'hourly' | 'flat_rate' | 'salary' | 'other';

export interface Technician {
  id: string;
  name: string;
  active: boolean;
  payType: PayType;
  defaultPaidHours: number;
  displayOrder?: number;
  department?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyTimeEntry {
  id: string;
  weekEnding: string;
  technicianId: string;
  mondayHours: number;
  tuesdayHours: number;
  wednesdayHours: number;
  thursdayHours: number;
  fridayHours: number;
  saturdayHours: number;
  notFlaggedHours: number;
  paidHours: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  dealershipName: string;
  managerName: string;
  departmentName: string;
  defaultPaidHours: number;
  defaultWorkWeekDays: string[];
  showSaturday: boolean;
  unappliedMode: 'floor_zero_with_over_applied';
  exportFormat: 'csv' | 'pdf';
  darkMode: boolean;
}

export interface EntryCalculations {
  totalFlaggedHours: number;
  unappliedTime: number;
  overAppliedTime: number;
  efficiencyPercent: number;
}

export interface TechnicianWeekSummary extends EntryCalculations {
  technician: Technician;
  entry: WeeklyTimeEntry;
}

export interface DepartmentSummary {
  totalPaidHours: number;
  totalFlaggedHours: number;
  totalNotFlaggedHours: number;
  totalUnappliedTime: number;
  totalOverAppliedTime: number;
  averageFlaggedHours: number;
  efficiencyPercent: number;
  hourlyTechnicianCount: number;
  highestFlagged?: TechnicianWeekSummary;
  mostUnapplied?: TechnicianWeekSummary;
}

export type DailyDepartmentStatus = 'not_started' | 'in_progress' | 'review_needed' | 'over_applied';

export interface DailyDepartmentSummary {
  dayField: keyof WeeklyTimeEntry;
  dayLabel: string;
  date: string;
  flaggedHours: number;
  paidHours: number;
  unappliedHours: number;
  overAppliedHours: number;
  efficiencyPercent: number;
  status: DailyDepartmentStatus;
  hasEnteredHours: boolean;
}

export interface ServiceTechStore {
  technicians: Technician[];
  entries: WeeklyTimeEntry[];
  settings: AppSettings;
  syncMode: 'supabase' | 'local-fallback';
}
