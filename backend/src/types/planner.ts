export type AreaId = 'salon' | 'cocina';

export type Employee = {
  id: string;
  name: string;
  active: boolean;
  weeklyHours?: number;
  restDay?: number;
  contractType?: 'full-time' | 'part-time';
  shiftType?: 'day' | 'night';
  mainRoleId?: string;
  notes?: string;
  phone?: string;
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

export type ValidationRequirements = Record<number, ValidationRequirement>;
export type TimeSlotsByArea = Record<AreaId, TimeSlot[]>;
export type ShiftRangesByArea = Record<AreaId, ShiftRanges>;
export type ValidationRequirementsByArea = Record<AreaId, ValidationRequirements>;

export type Role = {
  id: string;
  name: string;
  colorHex: string;
  validCodes: string[];
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

export type PlannerStatePayload = {
  employees: Employee[];
  roles: Role[];
  currentAreaId: AreaId;
  timeSlots: TimeSlot[];
  shiftRanges: ShiftRanges;
  validationRequirements: ValidationRequirements;
  timeSlotsByArea: TimeSlotsByArea;
  shiftRangesByArea: ShiftRangesByArea;
  validationRequirementsByArea: ValidationRequirementsByArea;
  weeks: Week[];
  weekPlans: Record<string, WeekPlan>;
  validatedWeekIds: string[];
  weekAuditById: Record<string, WeekAudit>;
};
