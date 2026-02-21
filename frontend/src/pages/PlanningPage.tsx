import { Badge, Box, Button, Card, CardBody, CardHeader, Divider, Flex, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiDownload, FiEye, FiTrash2, FiXCircle } from 'react-icons/fi';
import { CellEditorModal } from '../components/CellEditorModal';
import { DayGrid } from '../components/DayGrid';
import { DayTabs } from '../components/DayTabs';
import { EmployeeProfileDrawer } from '../components/EmployeeProfileDrawer';
import { LegendDrawer } from '../components/LegendDrawer';
import { WeekSelector } from '../components/WeekSelector';
import { useAppStore } from '../store/useAppStore';
import type { Assignment } from '../types';
import { downloadDaySchedulePdf } from '../utils/pdf';
import { getOpeningClosingSummary } from '../utils/summary';
import { normalizeRestDay } from '../utils/weekdays';

type SelectedCell = {
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
} | null;

export function PlanningPage(): JSX.Element {
  const toast = useToast();
  const { isOpen: isLegendOpen, onOpen: openLegend, onClose: closeLegend } = useDisclosure();
  const { isOpen: isProfileOpen, onOpen: openProfile, onClose: closeProfile } = useDisclosure();
  const { isOpen: isEditorOpen, onOpen: openEditor, onClose: closeEditor } = useDisclosure();

  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const timeSlots = useAppStore((state) => state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const validationRequirements = useAppStore((state) => state.validationRequirements);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);
  const updateAssignment = useAppStore((state) => state.updateAssignment);
  const updateEmployeeDayAssignments = useAppStore((state) => state.updateEmployeeDayAssignments);
  const updateEmployeeDayByHours = useAppStore((state) => state.updateEmployeeDayByHours);
  const resetAll = useAppStore((state) => state.resetAll);

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const currentWeek = weeks.find((week) => week.id === currentWeekId);
  useEffect(() => {
    if (currentWeek) ensureWeekPlan(currentWeek);
  }, [currentWeek, ensureWeekPlan]);

  const currentWeekPlan = currentWeek ? weekPlans[currentWeek.id] : undefined;
  const days = currentWeekPlan?.days ?? [];
  const activeDay = days[activeDayIndex];
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const summary = activeDay ? getOpeningClosingSummary(activeDay, timeSlots) : { opening: 0, closing: 0 };
  const activeDayOfWeek = activeDay ? new Date(`${activeDay.dateISO}T00:00:00`).getDay() : null;
  const dayValidation = activeDayOfWeek === null ? { opening: 0, closing: 0 } : validationRequirements[activeDayOfWeek];
  const openingTarget = dayValidation?.opening ?? 0;
  const closingTarget = dayValidation?.closing ?? 0;
  const openingDelta = summary.opening - openingTarget;
  const closingDelta = summary.closing - closingTarget;
  const hasValidationMismatch = openingDelta !== 0 || closingDelta !== 0;
  const repeatedRestDayInfo = useMemo(() => {
    const counts = new Map<number, number>();
    for (const employee of employees) {
      if (!employee.active) continue;
      const restDay = normalizeRestDay(employee.restDay);
      counts.set(restDay, (counts.get(restDay) ?? 0) + 1);
    }

    const repeatedDays = [...counts.entries()].filter(([, count]) => count >= 2);
    if (!repeatedDays.length) return null;

    const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const [restDay, count] = repeatedDays.sort((a, b) => b[1] - a[1])[0];

    return {
      count,
      label: dayLabels[restDay] ?? 'N/D'
    };
  }, [employees]);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [currentWeekId]);

  const activeEmployeesCount = useMemo(() => employees.filter((employee) => employee.active).length, [employees]);
  const employeeHoursById = useMemo(() => {
    const targetByEmployeeId = new Map(employees.map((employee) => [employee.id, employee.weeklyHours ?? 0]));
    const assignedByEmployeeId = new Map<string, number>();
    const slotDurationById = new Map<string, number>();

    for (const slot of timeSlots) {
      slotDurationById.set(slot.id, getDurationHours(slot.start, slot.end));
    }

    if (currentWeekPlan) {
      for (const day of currentWeekPlan.days) {
        for (const [slotId, byEmployee] of Object.entries(day.assignments)) {
          const slotHours = slotDurationById.get(slotId) ?? 0;
          for (const [employeeId, assignment] of Object.entries(byEmployee)) {
            if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') continue;
            assignedByEmployeeId.set(employeeId, (assignedByEmployeeId.get(employeeId) ?? 0) + slotHours);
          }
        }
      }
    }

    const summary: Record<string, { assignedHours: number; targetHours: number }> = {};
    for (const employee of employees) {
      summary[employee.id] = {
        assignedHours: assignedByEmployeeId.get(employee.id) ?? 0,
        targetHours: targetByEmployeeId.get(employee.id) ?? 0
      };
    }
    return summary;
  }, [employees, timeSlots, currentWeekPlan]);

  return (
    <Box>
      <Stack spacing={6}>
        <Stack spacing={2}>
          <Text fontSize={{ base: '1xl', md: '2xl' }} lineHeight="1.1" fontWeight="800" letterSpacing="-0.02em" color="#1f2f4a">
            Planificación de Horarios
          </Text>
          <Text fontSize={{ base: 'xs', md: 'md' }} color="gray.600">
            Gestione y asigne turnos para sus colaboradores esta semana.
          </Text>
        </Stack>

        <Card>
          <CardBody>
            <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align={{ base: 'stretch', lg: 'center' }}>
              <Flex gap={3} wrap="wrap" align="center">
                <Box w={{ base: '100%', lg: '300px' }} minW={{ base: '100%', sm: '260px' }}>
                  <WeekSelector />
                </Box>
                <Button colorScheme="brand" leftIcon={<FiEye />} onClick={openLegend}>
                  Ver Zonas
                </Button>
              </Flex>
              <Flex flex="1" justify={{ base: 'flex-start', lg: 'flex-end' }} gap={3} wrap="wrap" align="center">
                <Badge colorScheme="blue" px={3} py={1} rounded="full" variant="subtle">
                  COLABORADORES: {activeEmployeesCount}
                </Badge>
                <Button
                  colorScheme="brand"
                  variant="outline"
                  leftIcon={<FiDownload />}
                  isLoading={isExportingPdf}
                  isDisabled={!currentWeek || !activeDay}
                  onClick={() => {
                    if (!currentWeek || !activeDay) {
                      toast({ status: 'warning', title: 'No hay día activo para exportar.' });
                      return;
                    }
                    try {
                      setIsExportingPdf(true);
                      downloadDaySchedulePdf({
                        dayPlan: activeDay,
                        employees,
                        roles,
                        timeSlots,
                        week: currentWeek
                      });
                      toast({ status: 'success', title: `PDF generado para ${activeDay.dayName}.` });
                    } catch {
                      toast({ status: 'error', title: 'No se pudo generar el PDF del día.' });
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                >
                  Exportar PDF
                </Button>
                <Button colorScheme="red" variant="outline" leftIcon={<FiTrash2 />} onClick={resetAll}>
                  Borrar Todo
                </Button>
              </Flex>
            </Flex>
          </CardBody>
        </Card>

        {!activeDay ? (
          <Card>
            <CardBody>
              <Text color="gray.500">No hay datos para esta semana.</Text>
            </CardBody>
          </Card>
        ) : (
          <Stack spacing={4}>
            <Card>
              <CardHeader pb={0}>
                <DayTabs days={days} activeIndex={activeDayIndex} onChange={setActiveDayIndex} />
              </CardHeader>
              <CardBody>
                <Stack spacing={4}>
                  <Box>
                    <DayGrid
                      dayPlan={activeDay}
                      employees={employees}
                      roles={roles}
                      timeSlots={timeSlots}
                      employeeHoursById={employeeHoursById}
                      showEmployeeCodeInCells
                      onCellClick={(cell) => {
                        setSelectedCell(cell);
                        openEditor();
                      }}
                      onEmployeeClick={(employeeId) => {
                        setSelectedEmployeeId(employeeId);
                        openProfile();
                      }}
                    />
                  </Box>
                  <Divider />
                  <HStack spacing={3} flexWrap="wrap">
                    <Badge colorScheme="orange" px={3} py={1} rounded="full" variant="subtle">
                      Apertura: {summary.opening}
                    </Badge>
                    <Badge colorScheme="purple" px={3} py={1} rounded="full" variant="subtle">
                      Cierre: {summary.closing}
                    </Badge>
                  </HStack>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="white" borderColor="gray.200" borderWidth="1px" w={{ base: '100%', xl: '50%' }}>
              <CardBody>
                <Stack spacing={3}>
                  <HStack spacing={2} color="blue.700">
                    <Box color={hasValidationMismatch ? 'orange.500' : 'blue.500'} mt={0.5}>
                      {hasValidationMismatch ? <FiAlertTriangle /> : <FiCheckCircle />}
                    </Box>
                    <Text fontWeight="800" letterSpacing="0.03em" textTransform="uppercase">
                      Notas de Planificación
                    </Text>
                  </HStack>

                  <Box
                    bg={openingDelta === 0 ? 'green.50' : 'red.50'}
                    borderWidth="1px"
                    borderColor={openingDelta === 0 ? 'green.200' : 'red.200'}
                    rounded="md"
                    px={4}
                    py={3}
                  >
                    <HStack align="start" spacing={2}>
                      <Box color={openingDelta === 0 ? 'green.500' : 'red.500'} mt={0.5}>
                        {openingDelta === 0 ? <FiCheckCircle /> : <FiXCircle />}
                      </Box>
                      <Stack spacing={0} flex="1">
                        <Text fontSize="sm" fontWeight="700" color={openingDelta === 0 ? 'green.700' : 'red.700'}>
                          Apertura:{' '}
                          {openingDelta > 0
                            ? `se requiere ${openingTarget} y hay ${summary.opening}. Se excedió por ${openingDelta}.`
                            : openingDelta < 0
                              ? `se requiere ${openingTarget} y sólo hay ${summary.opening}.`
                              : `cobertura correcta (${summary.opening}/${openingTarget}).`}
                        </Text>
                        <Text fontSize="sm" color={openingDelta === 0 ? 'green.700' : 'red.700'}>
                          Plan de acción:{' '}
                          {openingDelta > 0
                            ? `Reasignar ${openingDelta} colaborador(es) fuera del turno de apertura.`
                            : openingDelta < 0
                              ? `Reasignar al menos ${Math.abs(openingDelta)} colaborador(es) al turno de apertura.`
                              : 'Mantener cobertura actual.'}
                        </Text>
                      </Stack>
                    </HStack>
                  </Box>

                  <Box
                    bg={closingDelta === 0 ? 'green.50' : 'red.50'}
                    borderWidth="1px"
                    borderColor={closingDelta === 0 ? 'green.200' : 'red.200'}
                    rounded="md"
                    px={4}
                    py={3}
                  >
                    <HStack align="start" spacing={2}>
                      <Box color={closingDelta === 0 ? 'green.500' : 'red.500'} mt={0.5}>
                        {closingDelta === 0 ? <FiCheckCircle /> : <FiXCircle />}
                      </Box>
                      <Stack spacing={0} flex="1">
                        <Text fontSize="sm" fontWeight="700" color={closingDelta === 0 ? 'green.700' : 'red.700'}>
                          Cierre:{' '}
                          {closingDelta > 0
                            ? `se requiere ${closingTarget} y hay ${summary.closing}. Se excedió por ${closingDelta}.`
                            : closingDelta < 0
                              ? `se requiere ${closingTarget} y sólo hay ${summary.closing}.`
                              : `cobertura correcta (${summary.closing}/${closingTarget}).`}
                        </Text>
                        <Text fontSize="sm" color={closingDelta === 0 ? 'green.700' : 'red.700'}>
                          Plan de acción:{' '}
                          {closingDelta > 0
                            ? `Reasignar ${closingDelta} colaborador(es) fuera del turno de cierre.`
                            : closingDelta < 0
                              ? `Reasignar al menos ${Math.abs(closingDelta)} colaborador(es) al turno de cierre.`
                              : 'Mantener cobertura actual.'}
                        </Text>
                      </Stack>
                    </HStack>
                  </Box>

                  {repeatedRestDayInfo ? (
                    <Box bg="yellow.50" borderWidth="1px" borderColor="yellow.300" rounded="md" px={4} py={3}>
                      <HStack align="start" spacing={2}>
                        <Box color="yellow.600" mt={0.5}>
                          <FiAlertTriangle />
                        </Box>
                        <Text fontSize="sm" fontWeight="700" color="yellow.700">
                          Alerta: Existen {repeatedRestDayInfo.count} colaboradores con descanso el mismo día ({repeatedRestDayInfo.label}).
                        </Text>
                      </HStack>
                    </Box>
                  ) : null}
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        )}
      </Stack>

      <LegendDrawer isOpen={isLegendOpen} onClose={closeLegend} roles={roles} />
      <EmployeeProfileDrawer
        isOpen={isProfileOpen}
        onClose={closeProfile}
        employee={selectedEmployee}
        roles={roles}
        timeSlots={timeSlots}
        weekPlan={currentWeekPlan}
      />
      <CellEditorModal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        assignment={selectedCell?.assignment ?? null}
        employeeName={employees.find((employee) => employee.id === selectedCell?.employeeId)?.name}
        roles={roles}
        onSave={({ assignment, applyToEmployeeDay, dayHours }) => {
          if (!selectedCell || !activeDay || !currentWeek) return;
          let result;
          if (applyToEmployeeDay && dayHours !== undefined) {
            result = updateEmployeeDayByHours({
              weekId: currentWeek.id,
              dateISO: activeDay.dateISO,
              employeeId: selectedCell.employeeId,
              assignment,
              hours: dayHours
            });
          } else if (applyToEmployeeDay) {
            result = updateEmployeeDayAssignments({
              weekId: currentWeek.id,
              dateISO: activeDay.dateISO,
              employeeId: selectedCell.employeeId,
              assignment,
              timeSlotIds: timeSlots.map((slot) => slot.id)
            });
          } else {
            result = updateAssignment({
              weekId: currentWeek.id,
              dateISO: activeDay.dateISO,
              timeSlotId: selectedCell.timeSlotId,
              employeeId: selectedCell.employeeId,
              assignment
            });
          }
          if (!result.ok) {
            toast({ status: 'error', title: result.error ?? 'No se pudo guardar.' });
          }
        }}
      />
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
