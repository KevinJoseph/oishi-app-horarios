import { Box, Button, Text } from '@chakra-ui/react';
import type { Assignment, DayPlan, Employee, Role, TimeSlot } from '../types';
import { AssignmentCell } from './AssignmentCell';

type CellPayload = {
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
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
  employeeHoursById?: Record<string, EmployeeHoursSummary>;
  onCellClick?: (payload: CellPayload) => void;
  onEmployeeClick?: (employeeId: string) => void;
  readOnly?: boolean;
  compact?: boolean;
  maxTableHeight?: string;
};

export function DayGrid({
  dayPlan,
  employees,
  roles,
  timeSlots,
  employeeHoursById,
  onCellClick,
  onEmployeeClick,
  readOnly = false,
  compact = false,
  maxTableHeight
}: Props): JSX.Element {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order);
  const visibleSlots = orderedSlots.length > 1 ? orderedSlots.slice(1) : orderedSlots;
  const visibleEmployees = employees.filter((employee) => employee.active);
  const headerCellPadding = compact ? 2 : 3;
  const rowCellPadding = compact ? 2 : 3;
  const slotMinWidth = compact ? '140px' : '170px';
  const employeeMinWidth = compact ? '120px' : '140px';
  const tableMaxHeight = maxTableHeight ?? (compact ? '48vh' : '65vh');

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="white">
      <Box overflow="auto" maxH={tableMaxHeight}>
        <Box as="table" minW={compact ? '760px' : '900px'} w="100%" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <Box as="thead" position="sticky" top={0} zIndex={4} bg="gray.100">
            <Box as="tr">
              <Box as="th" p={headerCellPadding} textAlign="left" minW={slotMinWidth} position="sticky" left={0} bg="gray.100" zIndex={5}>
                Horario
              </Box>
              {visibleEmployees.map((employee) => {
                const summary = employeeHoursById?.[employee.id];
                const assigned = summary?.assignedHours ?? 0;
                const target = summary?.targetHours ?? (employee.weeklyHours ?? 0);
                const progressColor = target <= 0 ? 'red.600' : assigned >= target ? 'green.600' : 'red.600';

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
                  fontWeight="600"
                  fontSize={compact ? 'xs' : 'sm'}
                  borderTopWidth="1px"
                  borderColor="gray.200"
                  position="sticky"
                  left={0}
                  bg="white"
                  zIndex={3}
                >
                  <Text>{slot.label}</Text>
                </Box>
                {visibleEmployees.map((employee) => {
                  const assignment = dayPlan.assignments[slot.id][employee.id] ?? { roleId: null, code: 'LIBRE' };
                  const role = assignment.roleId ? roleById.get(assignment.roleId) : undefined;
                  return (
                    <Box as="td" key={employee.id} p={0}>
                      <AssignmentCell
                        assignment={assignment}
                        role={role}
                        onClick={
                          readOnly ? undefined : () => onCellClick?.({ timeSlotId: slot.id, employeeId: employee.id, assignment })
                        }
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
