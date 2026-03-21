export const AREA_IDS = ['salon', 'cocina', 'oficina', 'produccion'] as const;
export type AreaId = (typeof AREA_IDS)[number];

export type Employee = {
  id: string;
  code?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  identityDocument?: string;
  email?: string;
  companyAlias?: string;
  companyName?: string;
  companyId?: string;
  areaId?: AreaId;
  active: boolean;
  weeklyHours?: number;
  restDay?: number;
  contractType?: 'full-time' | 'part-time';
  shiftType?: 'day' | 'night';
  mainRoleId?: string;
  notes?: string;
  phone?: string;
  groupDescription?: string;
  positionDescription?: string;
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
export type TimeSlotsByArea = Record<AreaId, TimeSlot[]>;
export type ShiftRangesByArea = Record<AreaId, ShiftRanges>;
export type ValidationRequirementsByArea = Record<AreaId, ValidationRequirements>;
export type BreakConfigByArea = Record<AreaId, BreakConfig>;
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
};

export type DayPlan = {
  dateISO: string;
  dayName: string;
  assignments: Record<string, Record<string, Assignment>>;
};

export type WeekPlan = {
  weekId: string;
  days: DayPlan[];
};

export type WeekAudit = {
  createdByName: string | null;
  validatedByName: string | null;
};
