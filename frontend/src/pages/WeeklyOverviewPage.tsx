import { Badge, Box, Card, CardBody, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import { useEffect, useMemo } from 'react';
import { EmployeeWeekGrid } from '../components/EmployeeWeekGrid';
import { WeekSelector } from '../components/WeekSelector';
import { useAppStore } from '../store/useAppStore';

export function WeeklyOverviewPage(): JSX.Element {
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const timeSlots = useAppStore((state) => state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);

  const currentWeek = weeks.find((week) => week.id === currentWeekId);
  useEffect(() => {
    if (currentWeek) ensureWeekPlan(currentWeek);
  }, [currentWeek, ensureWeekPlan]);

  const days = currentWeek ? weekPlans[currentWeek.id]?.days ?? [] : [];
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.active), [employees]);
  const assignedHoursByEmployee = useMemo(() => {
    const slotDurationById = new Map<string, number>();
    for (const slot of timeSlots) {
      slotDurationById.set(slot.id, getDurationHours(slot.start, slot.end));
    }

    const summary = new Map<string, number>();
    for (const day of days) {
      for (const [slotId, byEmployee] of Object.entries(day.assignments)) {
        const slotHours = slotDurationById.get(slotId) ?? 0;
        for (const [employeeId, assignment] of Object.entries(byEmployee)) {
          if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') continue;
          summary.set(employeeId, (summary.get(employeeId) ?? 0) + slotHours);
        }
      }
    }
    return summary;
  }, [days, timeSlots]);

  return (
    <Box>
      <Card mb={4}>
        <CardBody>
          <Flex justify="space-between" align="center" gap={3} wrap="wrap">
            <Heading size="md">Vista General</Heading>
            <WeekSelector />
          </Flex>
        </CardBody>
      </Card>

      {!days.length ? (
        <Card>
          <CardBody>
            <Text color="gray.500">No hay datos para esta semana.</Text>
          </CardBody>
        </Card>
      ) : (
        <VStack spacing={4} align="stretch">
          {activeEmployees.map((employee) => {
            const assigned = assignedHoursByEmployee.get(employee.id) ?? 0;
            const target = employee.weeklyHours ?? 40;
            const progressColor = target <= 0 ? 'gray' : assigned >= target ? 'green' : 'red';
            return (
              <Card key={employee.id}>
                <CardBody>
                  <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
                    <Heading size="sm">{employee.name}</Heading>
                    <Badge colorScheme={progressColor} px={3} py={1} rounded="md">
                      {assigned.toFixed(1)}h / {target.toFixed(1)}h
                    </Badge>
                  </Flex>
                  <EmployeeWeekGrid
                    employee={employee}
                    days={days}
                    roles={roles}
                    timeSlots={timeSlots}
                    maxTableHeight="42vh"
                  />
                </CardBody>
              </Card>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}

function getDurationHours(start: string, end: string): number {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0;
  return (endMinutes - startMinutes) / 60;
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}
