import { Box, Text } from '@chakra-ui/react';
import type { BreakConfig, DayPlan, Employee, Role, TimeSlot } from '../types';
import { isTimeSlotInBreak } from '../utils/breaks';
import { isBreakAssignment, isExplicitFreeAssignment, suppressesConfiguredBreak } from '../utils/assignments';
import { isRestDayForDate } from '../utils/weekdays';
import { AssignmentCell } from './AssignmentCell';

type Props = {
  employee: Employee;
  days: DayPlan[];
  roles: Role[];
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  maxTableHeight?: string;
};

export function EmployeeWeekGrid({ employee, days, roles, timeSlots, breakConfig, maxTableHeight = '46vh' }: Props): JSX.Element {
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order);
  const visibleSlots = orderedSlots;

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="white">
      <Box overflow="auto" maxH={maxTableHeight}>
        <Box as="table" minW="920px" w="100%" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <Box as="thead" position="sticky" top={0} zIndex={4} bg="gray.100">
            <Box as="tr">
              <Box as="th" p={2} textAlign="left" minW="150px" position="sticky" left={0} bg="gray.100" zIndex={5}>
                Horario
              </Box>
              {days.map((day) => (
                <Box as="th" key={day.dateISO} p={2} minW="110px">
                  <Text fontSize="sm">{day.dayName}</Text>
                  <Text fontSize="xs" color="gray.600">
                    {day.dateISO}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
          <Box as="tbody">
            {visibleSlots.map((slot) => (
              <Box as="tr" key={slot.id}>
                <Box
                  as="td"
                  p={2}
                  fontWeight="600"
                  fontSize="sm"
                  borderTopWidth="1px"
                  borderColor="gray.200"
                  position="sticky"
                  left={0}
                  bg="white"
                  zIndex={3}
                >
                  <Text>{slot.label}</Text>
                </Box>
                {days.map((day) => {
                  const assignment = day.assignments[slot.id]?.[employee.id] ?? { roleId: null, code: 'LIBRE' };
                  const role = assignment.roleId ? roleById.get(assignment.roleId) : undefined;
                  const isBreakSlot =
                    isBreakAssignment(assignment) ||
                    (assignment.roleId === null &&
                      !suppressesConfiguredBreak(assignment) &&
                      isTimeSlotInBreak(slot, breakConfig));
                  const isRestDay =
                    assignment.roleId === null &&
                    !isExplicitFreeAssignment(assignment) &&
                    isRestDayForDate(day.dateISO, employee.restDay);
                  return (
                    <Box as="td" key={`${day.dateISO}-${slot.id}`} p={0}>
                      <AssignmentCell
                        assignment={assignment}
                        role={role}
                        labelOverride={isRestDay ? 'Descanso' : isBreakSlot ? 'Break' : undefined}
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
