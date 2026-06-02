import type { Assignment } from '../types';

export function isBreakAssignment(assignment: Assignment | null | undefined): boolean {
  return Boolean(assignment && assignment.roleId === null && assignment.code === 'LIBRE' && assignment.isBreak);
}

export function isFreeAssignment(assignment: Assignment | null | undefined): boolean {
  return Boolean(assignment && assignment.roleId === null && assignment.code === 'LIBRE' && !assignment.isBreak);
}

export function isExplicitFreeAssignment(assignment: Assignment | null | undefined): boolean {
  return Boolean(isFreeAssignment(assignment) && assignment?.explicitFree);
}

export function suppressesConfiguredBreak(assignment: Assignment | null | undefined): boolean {
  return Boolean(assignment?.suppressConfiguredBreak);
}

export function isWorkAssignment(assignment: Assignment | null | undefined): boolean {
  return Boolean(assignment && assignment.roleId !== null && assignment.code !== 'LIBRE');
}

export function isOvertimeAssignment(assignment: Assignment | null | undefined): boolean {
  return Boolean(assignment && assignment.overtime && isWorkAssignment(assignment));
}

export function createFreeAssignment(explicitFree = false): Assignment {
  return { roleId: null, code: 'LIBRE', suppressConfiguredBreak: false, explicitFree };
}

export function createBreakAssignment(): Assignment {
  return { roleId: null, code: 'LIBRE', isBreak: true, suppressConfiguredBreak: false };
}
