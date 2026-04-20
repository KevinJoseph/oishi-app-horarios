/** @deprecated kept only for backward compat during migration — use dynamic areas from DB */
export const AREA_IDS = ['salon', 'cocina', 'oficina', 'produccion'] as const;
export type AreaId = string;

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
  companyId?: string;
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
  inactiveEmployeeIds?: string[];
};

export type AreaInfo = {
  code: string;
  label: string;
  order: number;
};

export type PlannerStatePayload = {
  areas: AreaInfo[];
  employees: Employee[];
  roles: Role[];
  currentAreaId: AreaId;
  timeSlots: TimeSlot[];
  shiftRanges: ShiftRanges;
  validationRequirements: ValidationRequirements;
  breakConfig: BreakConfig;
  timeSlotsByArea: TimeSlotsByArea;
  shiftRangesByArea: ShiftRangesByArea;
  validationRequirementsByArea: ValidationRequirementsByArea;
  breakConfigByArea: BreakConfigByArea;
  weeks: Week[];
  weekPlans: Record<string, WeekPlan>;
  validatedWeekIds: string[];
  weekAuditById: Record<string, WeekAudit>;
  weekConfigById: WeekConfigurationById;
};

export type ValidationRequirementsUpdatePayload = {
  areaId: AreaId;
  validationRequirements: ValidationRequirements;
};

export type PlannerWeekEntryUpdatePayload = {
  weekId: string;
  weekPlan?: WeekPlan;
  weekAudit?: WeekAudit;
  weekConfig?: WeekConfigurationSnapshot;
  validated?: boolean;
};

export type AreaSettingsUpdateEntry = {
  areaId: string;
  timeSlots?: TimeSlot[];
  shiftRanges?: ShiftRanges;
  validationRequirements?: ValidationRequirements;
  breakConfig?: BreakConfig;
};

export type PlannerStatePartialUpdatePayload = {
  employees?: Employee[];
  roles?: Role[];
  weeks?: Week[];
  weekEntries?: PlannerWeekEntryUpdatePayload[];
  areaSettings?: AreaSettingsUpdateEntry[];
};
