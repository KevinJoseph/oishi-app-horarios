import { Badge, Box, Button, Text, Tooltip } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import type { Assignment, BreakConfig, DayPlan, Employee, Role, TimeSlot } from '../types';
import { isTimeSlotInBreak } from '../utils/breaks';
import { isBreakAssignment, isExplicitFreeAssignment, suppressesConfiguredBreak } from '../utils/assignments';
import { isAnyRestDayForDate, isRestDayForDate } from '../utils/weekdays';
import { AssignmentCell } from './AssignmentCell';

type CellPayload = {
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
};

type DragFillState = {
  sourceSlotId: string;
  sourceSlotOrder: number;
  employeeId: string;
  assignment: Assignment;
  targetSlotOrder: number;
};

type ApplyRangePayload = {
  sourceCell: CellPayload;
  untilTimeSlotId: string;
};

type EmployeeHoursSummary = {
  assignedHours: number;
  targetHours: number;
};

type Props = {
  dayPlan: DayPlan;
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  restDayOverrides?: Record<string, number[]>;
  employeeHoursById?: Record<string, EmployeeHoursSummary>;
  onCellClick?: (payload: CellPayload) => void;
  onApplyRange?: (payload: ApplyRangePayload) => void;
  onEmployeeClick?: (employeeId: string) => void;
  showEmployeeCodeInCells?: boolean;
  readOnly?: boolean;
  allowCellClickWhenReadOnly?: boolean;
  showInactiveEmployees?: boolean;
  compact?: boolean;
  maxTableHeight?: string;
};

export function DayGrid({
  dayPlan,
  employees,
  roles,
  timeSlots,
  breakConfig,
  restDayOverrides,
  employeeHoursById,
  onCellClick,
  onApplyRange,
  onEmployeeClick,
  showEmployeeCodeInCells = false,
  readOnly = false,
  allowCellClickWhenReadOnly = false,
  showInactiveEmployees = false,
  compact = false,
  maxTableHeight
}: Props): JSX.Element {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order);
  const visibleSlots = orderedSlots;
  const [drag, setDrag] = useState<DragFillState | null>(null);

  useEffect(() => {
    if (!drag) return;
    const handleUp = (): void => {
      setDrag((current) => {
        if (current && current.targetSlotOrder !== current.sourceSlotOrder) {
          const targetSlot = orderedSlots.find((slot) => slot.order === current.targetSlotOrder);
          if (targetSlot) {
            onApplyRange?.({
              sourceCell: {
                timeSlotId: current.sourceSlotId,
                employeeId: current.employeeId,
                assignment: current.assignment
              },
              untilTimeSlotId: targetSlot.id
            });
          }
        }
        return null;
      });
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [drag, orderedSlots, onApplyRange]);
  const visibleEmployees = employees.filter((employee) => {
    if (employee.active) return true;
    if (!showInactiveEmployees) return false;
    // Only show inactive employees who have real assignments (not all LIBRE)
    return orderedSlots.some((slot) => {
      const assignment = dayPlan.assignments[slot.id]?.[employee.id];
      return assignment && assignment.roleId !== null;
    });
  });
  const headerCellPadding = compact ? 2 : 3;
  const rowCellPadding = compact ? 2 : 3;
  const slotMinWidth = compact ? '140px' : '170px';
  const employeeMinWidth = compact ? '120px' : '140px';
  const tableMaxHeight = maxTableHeight ?? (compact ? '48vh' : '65vh');

  return (
    <Box borderWidth="1px" borderColor="blackAlpha.100" rounded="lg" overflow="hidden" bg="white">
      <Box overflow="auto" maxH={tableMaxHeight}>
        <Box as="table" minW={compact ? '760px' : '900px'} w="100%" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <Box as="thead" position="sticky" top={0} zIndex={4} bg="gray.50">
            <Box as="tr">
              <Box
                as="th"
                p={headerCellPadding}
                textAlign="center"
                minW={slotMinWidth}
                position="sticky"
                left={0}
                bg="gray.50"
                zIndex={5}
                fontSize="xs"
                color="gray.500"
                letterSpacing="0.05em"
                textTransform="uppercase"
              >
                Franja horaria
              </Box>
              {visibleEmployees.map((employee) => {
                const summary = employeeHoursById?.[employee.id];
                const assigned = summary?.assignedHours ?? 0;
                const target = summary?.targetHours ?? (employee.weeklyHours ?? 0);
                const progressColor = target <= 0 ? 'red.600' : assigned >= target ? 'green.600' : 'red.600';
                const overtime = dayPlan.overtime?.[employee.id];
                const overtimeParts = overtime
                  ? [
                      overtime.before ? `Antes: ${overtime.before.duration} (${overtime.before.value})` : null,
                      overtime.after ? `Después: ${overtime.after.duration} (${overtime.after.value})` : null
                    ].filter((part): part is string => part !== null)
                  : [];

                return (
                  <Box as="th" key={employee.id} p={headerCellPadding} minW={employeeMinWidth}>
                    {readOnly ? (
                      <Text fontSize={compact ? 'xs' : 'sm'}>{employee.name}</Text>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onEmployeeClick?.(employee.id)}>
                        {employee.name}
                      </Button>
                    )}
                    <Text fontSize="xs" color={progressColor} fontWeight="700">
                      {Math.round(assigned)}h/{Math.round(target)}h
                    </Text>
                    {overtimeParts.length ? (
                      <Tooltip label={`Horas extra — ${overtimeParts.join(' · ')}`} hasArrow>
                        <Badge colorScheme="purple" variant="subtle" mt={1} textTransform="none" fontSize="0.65rem">
                          HE {overtimeParts.length === 2 ? '↕' : overtime?.before ? '↑' : '↓'}
                        </Badge>
                      </Tooltip>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Box as="tbody">
            {visibleSlots.map((slot) => (
              <Box as="tr" key={slot.id}>
                <Box
                  as="td"
                  p={rowCellPadding}
                  textAlign="center"
                  fontWeight="600"
                  fontSize={compact ? 'xs' : 'sm'}
                  borderTopWidth="1px"
                  borderColor="blackAlpha.100"
                  position="sticky"
                  left={0}
                  bg="white"
                  zIndex={3}
                >
                  <Text>{slot.label}</Text>
                </Box>
                {visibleEmployees.map((employee) => {
                  const assignment = dayPlan.assignments[slot.id]?.[employee.id] ?? { roleId: null, code: 'LIBRE' };
                  const role = assignment.roleId ? roleById.get(assignment.roleId) : undefined;
                  const isBreakSlot =
                    isBreakAssignment(assignment) ||
                    (assignment.roleId === null &&
                      !suppressesConfiguredBreak(assignment) &&
                      isTimeSlotInBreak(slot, breakConfig));
                  const override = restDayOverrides?.[employee.id];
                  const isRestDay =
                    assignment.roleId === null &&
                    !isExplicitFreeAssignment(assignment) &&
                    (override
                      ? isAnyRestDayForDate(dayPlan.dateISO, override)
                      : isRestDayForDate(dayPlan.dateISO, employee.restDay));
                  const canDragFill =
                    !readOnly &&
                    Boolean(onApplyRange) &&
                    !isBreakSlot &&
                    !isRestDay;
                  const dragMinOrder = drag ? Math.min(drag.sourceSlotOrder, drag.targetSlotOrder) : 0;
                  const dragMaxOrder = drag ? Math.max(drag.sourceSlotOrder, drag.targetSlotOrder) : 0;
                  const isDragHighlight =
                    drag !== null &&
                    drag.employeeId === employee.id &&
                    slot.order >= dragMinOrder &&
                    slot.order <= dragMaxOrder;
                  const isDragSameColumn =
                    drag !== null &&
                    drag.employeeId === employee.id &&
                    slot.order !== drag.sourceSlotOrder;
                  return (
                    <Box as="td" key={employee.id} p={0}>
                      <AssignmentCell
                        assignment={assignment}
                        role={role}
                        labelOverride={
                          assignment.roleId
                            ? showEmployeeCodeInCells
                              ? assignment.code
                              : undefined
                            : isRestDay
                              ? 'Descanso'
                            : isBreakSlot
                              ? 'Break'
                              : undefined
                        }
                        onClick={
                          readOnly && !allowCellClickWhenReadOnly
                            ? undefined
                            : () => onCellClick?.({ timeSlotId: slot.id, employeeId: employee.id, assignment })
                        }
                        onDragFillStart={
                          canDragFill
                            ? () =>
                                setDrag({
                                  sourceSlotId: slot.id,
                                  sourceSlotOrder: slot.order,
                                  employeeId: employee.id,
                                  assignment,
                                  targetSlotOrder: slot.order
                                })
                            : undefined
                        }
                        onCellMouseEnter={
                          isDragSameColumn
                            ? () =>
                                setDrag((current) =>
                                  current ? { ...current, targetSlotOrder: slot.order } : current
                                )
                            : undefined
                        }
                        isDragHighlight={isDragHighlight}
                      />
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
