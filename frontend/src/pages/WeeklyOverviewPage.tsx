import { Badge, Box, Button, Card, CardBody, Flex, Heading, HStack, Select, SimpleGrid, Text, VStack, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { DayGrid } from '../components/DayGrid';
import { EmployeeWeekGrid } from '../components/EmployeeWeekGrid';
import { WeekSelector } from '../components/WeekSelector';
import { WeeklyByWeeksOverviewContent } from './WeeklyByWeeksOverviewPage';
import { useAppStore } from '../store/useAppStore';
import { downloadWeeklyOverviewPdf } from '../utils/pdf';

export function WeeklyOverviewPage(): JSX.Element {
  const toast = useToast();
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

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'weeks' | 'grid'>('grid');
  const currentWeekPlan = currentWeek ? weekPlans[currentWeek.id] : undefined;
  const days = currentWeekPlan?.days ?? [];
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
  const employeeHoursById = useMemo(() => {
    const summary: Record<string, { assignedHours: number; targetHours: number }> = {};
    for (const employee of employees) {
      summary[employee.id] = {
        assignedHours: assignedHoursByEmployee.get(employee.id) ?? 0,
        targetHours: employee.weeklyHours ?? 0
      };
    }
    return summary;
  }, [assignedHoursByEmployee, employees]);

  return (
    <Box>
      <Card mb={4}>
        <CardBody>
          <Flex justify="space-between" align="center" gap={3} wrap="wrap">
            <Heading size="md">Vista General</Heading>
            <HStack>
              <Select
                maxW="220px"
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as 'personal' | 'weeks' | 'grid')}
              >
                <option value="personal">Personal</option>
                <option value="grid">Grid</option>
                <option value="weeks">Semanas</option>
              </Select>
              {viewMode !== 'weeks' ? (
                <>
                  <WeekSelector />
                  {viewMode === 'personal' ? (
                    <Button
                      colorScheme="teal"
                      variant="outline"
                      isLoading={isExportingPdf}
                      isDisabled={!currentWeek || !currentWeekPlan}
                      onClick={() => {
                        if (!currentWeek || !currentWeekPlan) {
                          toast({ status: 'warning', title: 'No hay planificación para exportar.' });
                          return;
                        }
                        try {
                          setIsExportingPdf(true);
                          downloadWeeklyOverviewPdf({
                            employees,
                            roles,
                            timeSlots,
                            week: currentWeek,
                            weekPlan: currentWeekPlan
                          });
                          toast({ status: 'success', title: 'PDF de vista general generado.' });
                        } catch {
                          toast({ status: 'error', title: 'No se pudo generar el PDF de vista general.' });
                        } finally {
                          setIsExportingPdf(false);
                        }
                      }}
                    >
                      PDF
                    </Button>
                  ) : null}
                </>
              ) : null}
            </HStack>
          </Flex>
        </CardBody>
      </Card>

      {viewMode === 'weeks' ? (
        <WeeklyByWeeksOverviewContent />
      ) : viewMode === 'grid' ? (
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
          {days.map((day) => (
            <Card key={day.dateISO}>
              <CardBody>
                <Heading size="sm" mb={3}>
                  {day.dayName} ({day.dateISO})
                </Heading>
                <DayGrid
                  dayPlan={day}
                  employees={employees}
                  roles={roles}
                  timeSlots={timeSlots}
                  employeeHoursById={employeeHoursById}
                  readOnly
                  compact
                  maxTableHeight="42vh"
                />
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      ) : !days.length ? (
        <Card>
          <CardBody>
            <Text color="gray.500">No hay datos para esta semana.</Text>
          </CardBody>
        </Card>
      ) : (
        <VStack spacing={4} align="stretch">
          {activeEmployees.map((employee) => {
            const assigned = assignedHoursByEmployee.get(employee.id) ?? 0;
            const target = employee.weeklyHours ?? 0;
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
