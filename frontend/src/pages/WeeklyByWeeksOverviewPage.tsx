import { Badge, Box, Card, CardBody, Flex, Heading, Table, Tbody, Td, Text, Th, Thead, Tr, VStack } from '@chakra-ui/react';
import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import type { AreaId, WeekPlan } from '../types';

type EmployeeDailyHours = {
  employeeId: string;
  dailyHours: number[];
  totalHours: number;
};

export function WeeklyByWeeksOverviewPage(): JSX.Element {
  return (
    <Box>
      <Card mb={4}>
        <CardBody>
          <Heading size="md">Vista General Semanas</Heading>
          <Text mt={1} color="gray.600">
            Resumen semanal por colaborador para todas las semanas disponibles.
          </Text>
        </CardBody>
      </Card>

      <WeeklyByWeeksOverviewContent />
    </Box>
  );
}

export function WeeklyByWeeksOverviewContent(): JSX.Element {
  const allEmployees = useAppStore((state) => state.employees);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);
  const selectedGeoVictoriaCompanyId = useAuthStore((state) => state.selectedGeoVictoriaCompanyId);
  const scopedWeekKey = (areaId: AreaId, weekId: string): string => `${areaId}::${weekId}`;

  useEffect(() => {
    for (const week of weeks) {
      ensureWeekPlan(week);
    }
  }, [weeks, currentAreaId, ensureWeekPlan]);

  const employees = useMemo(
    () =>
      allEmployees.filter(
        (employee) =>
          (employee.areaId ?? 'salon') === currentAreaId &&
          (!selectedGeoVictoriaCompanyId ||
            (employee.moduleCompanyId ?? employee.companyId ?? '') === selectedGeoVictoriaCompanyId)
      ),
    [allEmployees, currentAreaId, selectedGeoVictoriaCompanyId]
  );
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.active), [employees]);
  return (
    <VStack spacing={4} align="stretch">
      {weeks.map((week) => {
        const scopedWeekId = scopedWeekKey(currentAreaId, week.id);
        const weekPlan = weekPlans[scopedWeekId];
        if (!weekPlan) return null;
        const effectiveTimeSlots = weekConfigById[scopedWeekId]?.timeSlots ?? areaTimeSlots;
        const slotDurationById = new Map<string, number>();
        for (const slot of effectiveTimeSlots) {
          slotDurationById.set(slot.id, getDurationHours(slot.start, slot.end));
        }
        const byEmployee = buildEmployeeDailyHours(weekPlan, activeEmployees.map((employee) => employee.id), slotDurationById);
        const dayHeaders = weekPlan.days.map((day) => day.dayName);

        return (
          <Card key={week.id}>
            <CardBody>
              <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
                <Heading size="sm">{week.label}</Heading>
                <Badge colorScheme="blue" px={3} py={1} rounded="md">
                  {activeEmployees.length} colaboradores
                </Badge>
              </Flex>

              <Box overflowX="auto">
                <Table size="sm" bg="white">
                  <Thead>
                    <Tr>
                      <Th>Colaborador</Th>
                      {dayHeaders.map((dayName) => (
                        <Th key={`${week.id}-${dayName}`}>{dayName}</Th>
                      ))}
                      <Th>Total semana</Th>
                      <Th>Objetivo</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {activeEmployees.map((employee) => {
                      const summary = byEmployee.get(employee.id);
                      const target = employee.weeklyHours ?? 0;
                      const totalHours = summary?.totalHours ?? 0;
                      const isOnTarget = totalHours >= target;
                      return (
                        <Tr key={`${week.id}-${employee.id}`}>
                          <Td fontWeight="600">{employee.name}</Td>
                          {dayHeaders.map((_, index) => (
                            <Td key={`${week.id}-${employee.id}-${index}`}>{(summary?.dailyHours[index] ?? 0).toFixed(1)}h</Td>
                          ))}
                          <Td>
                            <Badge colorScheme={isOnTarget ? 'green' : 'orange'}>{totalHours.toFixed(1)}h</Badge>
                          </Td>
                          <Td>{target.toFixed(1)}h</Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </Box>
            </CardBody>
          </Card>
        );
      })}
    </VStack>
  );
}

function buildEmployeeDailyHours(
  weekPlan: WeekPlan,
  employeeIds: string[],
  slotDurationById: Map<string, number>
): Map<string, EmployeeDailyHours> {
  const output = new Map<string, EmployeeDailyHours>();

  for (const employeeId of employeeIds) {
    output.set(employeeId, {
      employeeId,
      dailyHours: Array.from({ length: weekPlan.days.length }).map(() => 0),
      totalHours: 0
    });
  }

  weekPlan.days.forEach((day, dayIndex) => {
    for (const [slotId, byEmployee] of Object.entries(day.assignments)) {
      const slotHours = slotDurationById.get(slotId) ?? 0;
      for (const employeeId of employeeIds) {
        const assignment = byEmployee[employeeId];
        if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') continue;
        const current = output.get(employeeId);
        if (!current) continue;
        current.dailyHours[dayIndex] += slotHours;
        current.totalHours += slotHours;
      }
    }
  });

  return output;
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
