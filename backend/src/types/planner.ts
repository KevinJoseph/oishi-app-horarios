export type Employee = {
  id: string;
  name: string;
  active: boolean;
  weeklyHours?: number;
  mainRoleId?: string;
  notes?: string;
  phone?: string;
};

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

export type PlannerStatePayload = {
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
  weeks: Week[];
  weekPlans: Record<string, WeekPlan>;
};
