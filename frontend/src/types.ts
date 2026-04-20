/** @deprecated kept only for backward compat during migration — use dynamic areas from API */
export const AREA_IDS = ['salon', 'cocina', 'oficina', 'produccion'] as const;
export type AreaId = string;

export type AreaInfo = {
  code: string;
  label: string;
  order: number;
};

export type Employee = {
  id: string;
  code?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  identityDocument?: string;
  email?: string;
  moduleCompanyAlias?: string;
  moduleCompanyName?: string;
  moduleCompanyId?: string;
  moduleCompanyRuc?: string;
  companyAlias?: string;
  companyName?: string;
  companyId?: string;
  companyRuc?: string;
  geoVictoriaGroupName?: string;
  geoVictoriaCostCenterCode?: string;
  areaId?: AreaId;
  active: boolean;
  weeklyHours?: number;
  restDay?: number;
  contractType?: 'full-time' | 'part-time';
  shiftType?: 'day' | 'night';
  mainRoleId?: string;
  mainRoleCode?: string;
  notes?: string;
  phone?: string;
  groupDescription?: string;
  positionDescription?: string;
  displayOrder?: number;
};

export type ShiftRange = {
  startHour: number;
  endHour: number;
};

export type ShiftRanges = {
  day: ShiftRange;
  night: ShiftRange;
};

export type ValidationRequirement = {
  opening: number;
  closing: number;
};

export type BreakConfig = {
  enabled: boolean;
  startHour: number;
  endHour: number;
};

export type ValidationRequirements = Record<number, ValidationRequirement>;
export type TimeSlotsByArea = Record<string, TimeSlot[]>;
export type ShiftRangesByArea = Record<string, ShiftRanges>;
export type ValidationRequirementsByArea = Record<string, ValidationRequirements>;
export type BreakConfigByArea = Record<string, BreakConfig>;
export type WeekConfigurationSnapshot = {
  areaId: AreaId;
  timeSlots: TimeSlot[];
  shiftRanges: ShiftRanges;
  validationRequirements: ValidationRequirements;
  breakConfig: BreakConfig;
};
export type WeekConfigurationById = Record<string, WeekConfigurationSnapshot>;

export type Role = {
  id: string;
  name: string;
  colorHex: string;
  validCodes: string[];
  areaId?: AreaId;
};

export type TimeSlot = {
  id: string;
  label: string;
  start: string;
  end: string;
  order: number;
};

export type Week = {
  id: string;
  label: string;
  startDateISO: string;
};

export type Assignment = {
  roleId: string | null;
  code: string;
  isBreak?: boolean;
  suppressConfiguredBreak?: boolean;
  explicitFree?: boolean;
};

export type DayPlan = {
  dateISO: string;
  dayName: string;
  assignments: Record<string, Record<string, Assignment>>;
};

export type WeekPlan = {
  weekId: string;
  days: DayPlan[];
  restDayOverrides?: Record<string, number>; // employeeId → day number (0-6), solo para esa semana
};

export type WeekAudit = {
  createdByName: string | null;
  validatedByName: string | null;
  inactiveEmployeeIds?: string[];
};
