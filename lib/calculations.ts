import {
  AppSettings,
  DepartmentSummary,
  DailyDepartmentSummary,
  EntryCalculations,
  Technician,
  TechnicianWeekSummary,
  WeeklyTimeEntry,
} from '@/types';
import { formatHours, formatPercent } from './utils';

export const dayFieldDefinitions = [
  { field: 'mondayHours', label: 'Monday' },
  { field: 'tuesdayHours', label: 'Tuesday' },
  { field: 'wednesdayHours', label: 'Wednesday' },
  { field: 'thursdayHours', label: 'Thursday' },
  { field: 'fridayHours', label: 'Friday' },
  { field: 'saturdayHours', label: 'Saturday' },
] as const;

export const workdayFields = dayFieldDefinitions.map((day) => day.field) as readonly (keyof WeeklyTimeEntry)[];

export function roundHours(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function getActiveWorkdayDefinitions(settings: Pick<AppSettings, 'defaultWorkWeekDays' | 'showSaturday'>) {
  const configuredDays = settings.defaultWorkWeekDays?.length
    ? settings.defaultWorkWeekDays
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return dayFieldDefinitions.filter((day) => {
    if (day.label === 'Saturday' && !settings.showSaturday) return false;
    return configuredDays.includes(day.label);
  });
}

function hasEnteredHoursForDay(entry: WeeklyTimeEntry, field: keyof WeeklyTimeEntry) {
  return Number(entry[field] || 0) > 0 || Number(entry.notFlaggedHours || 0) > 0;
}

export function calculateEntry(entry: WeeklyTimeEntry): EntryCalculations {
  const totalFlaggedHours = roundHours(workdayFields.reduce((sum, field) => sum + Number(entry[field] || 0), 0));
  const paidHours = Number(entry.paidHours || 0);
  const unappliedTime = roundHours(Math.max(paidHours - totalFlaggedHours, 0));
  const overAppliedTime = roundHours(Math.max(totalFlaggedHours - paidHours, 0));
  const efficiencyPercent = paidHours > 0 ? roundHours((totalFlaggedHours / paidHours) * 100) : 0;

  return {
    totalFlaggedHours,
    unappliedTime,
    overAppliedTime,
    efficiencyPercent,
  };
}

export function getDailyDepartmentSummaries(
  technicians: Technician[],
  entries: WeeklyTimeEntry[],
  settings: Pick<AppSettings, 'defaultWorkWeekDays' | 'showSaturday'>,
  weekEnding: string,
  includeInactive = false
): DailyDepartmentSummary[] {
  const activeTechnicians = technicians.filter((technician) => includeInactive || technician.active);
  const workdays = getActiveWorkdayDefinitions(settings);
  const summaryEntries = getWeekSummaries(activeTechnicians, entries, weekEnding, true);
  const weekEnd = new Date(`${weekEnding}T12:00:00`);

  return workdays.map((day, index) => {
    const dayDate = new Date(weekEnd);
    dayDate.setDate(weekEnd.getDate() - (workdays.length - 1 - index));
    const flaggedHours = roundHours(summaryEntries.reduce((sum, item) => sum + Number(item.entry[day.field] || 0), 0));
    const paidHours = roundHours(summaryEntries.reduce((sum, item) => sum + (Number(item.entry.paidHours || 0) / Math.max(workdays.length, 1)), 0));
    const unappliedHours = roundHours(Math.max(paidHours - flaggedHours, 0));
    const overAppliedHours = roundHours(Math.max(flaggedHours - paidHours, 0));
    const efficiencyPercent = paidHours > 0 ? roundHours((flaggedHours / paidHours) * 100) : 0;
    const hasEnteredHours = summaryEntries.some((item) => hasEnteredHoursForDay(item.entry, day.field));
    const status: DailyDepartmentSummary['status'] = !hasEnteredHours
      ? 'not_started'
      : overAppliedHours > 0
        ? 'over_applied'
        : unappliedHours > 0
          ? 'review_needed'
          : 'in_progress';

    return {
      dayField: day.field,
      dayLabel: day.label,
      date: dayDate.toISOString().slice(0, 10),
      flaggedHours,
      paidHours,
      unappliedHours,
      overAppliedHours,
      efficiencyPercent,
      status,
      hasEnteredHours,
    };
  });
}

export function createBlankEntry(technician: Technician, weekEnding: string): WeeklyTimeEntry {
  const now = new Date().toISOString();

  return {
    id: `${weekEnding}-${technician.id}`,
    weekEnding,
    technicianId: technician.id,
    mondayHours: 0,
    tuesdayHours: 0,
    wednesdayHours: 0,
    thursdayHours: 0,
    fridayHours: 0,
    saturdayHours: 0,
    notFlaggedHours: 0,
    paidHours: technician.defaultPaidHours,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function getWeekSummaries(
  technicians: Technician[],
  entries: WeeklyTimeEntry[],
  weekEnding: string,
  includeInactive = false
): TechnicianWeekSummary[] {
  return technicians
    .filter((technician) => includeInactive || technician.active)
    .map((technician) => {
      const entry = entries.find((item) => item.weekEnding === weekEnding && item.technicianId === technician.id)
        ?? createBlankEntry(technician, weekEnding);

      return {
        technician,
        entry,
        ...calculateEntry(entry),
      };
    });
}

export function summarizeDepartment(summaries: TechnicianWeekSummary[]): DepartmentSummary {
  const totalPaidHours = roundHours(summaries.reduce((sum, item) => sum + Number(item.entry.paidHours || 0), 0));
  const totalFlaggedHours = roundHours(summaries.reduce((sum, item) => sum + item.totalFlaggedHours, 0));
  const totalNotFlaggedHours = roundHours(summaries.reduce((sum, item) => sum + Number(item.entry.notFlaggedHours || 0), 0));
  const totalUnappliedTime = roundHours(summaries.reduce((sum, item) => sum + item.unappliedTime, 0));
  const totalOverAppliedTime = roundHours(summaries.reduce((sum, item) => sum + item.overAppliedTime, 0));
  const averageFlaggedHours = summaries.length ? roundHours(totalFlaggedHours / summaries.length) : 0;
  const efficiencyPercent = totalPaidHours > 0 ? roundHours((totalFlaggedHours / totalPaidHours) * 100) : 0;
  const hourlyTechnicianCount = summaries.filter((item) => item.technician.payType === 'hourly').length;
  const highestFlagged = [...summaries].sort((a, b) => b.totalFlaggedHours - a.totalFlaggedHours)[0];
  const mostUnapplied = [...summaries].sort((a, b) => b.unappliedTime - a.unappliedTime)[0];

  return {
    totalPaidHours,
    totalFlaggedHours,
    totalNotFlaggedHours,
    totalUnappliedTime,
    totalOverAppliedTime,
    averageFlaggedHours,
    efficiencyPercent,
    hourlyTechnicianCount,
    highestFlagged,
    mostUnapplied,
  };
}

export function getWeekEnding(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  next.setDate(next.getDate() + daysUntilSaturday);
  return next.toISOString().slice(0, 10);
}

export function getManagerSummary(summary: DepartmentSummary) {
  const top = summary.highestFlagged?.technician.name ?? 'No technician';
  const mostUnapplied = summary.mostUnapplied?.technician.name ?? 'no technician';

  return `This week, the service department had ${formatHours(summary.totalPaidHours)} paid hours and ${formatHours(summary.totalFlaggedHours)} flagged hours, resulting in ${formatHours(summary.totalUnappliedTime)} hours of unapplied time and an efficiency rate of ${formatPercent(summary.efficiencyPercent)}. ${top} had the highest flagged hours, while ${mostUnapplied} had the most unapplied time.`;
}
