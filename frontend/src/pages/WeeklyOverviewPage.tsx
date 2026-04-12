import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Text,
  VStack,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { DayGrid } from '../components/DayGrid';
import { EmployeeWeekGrid } from '../components/EmployeeWeekGrid';
import { WeekSelector } from '../components/WeekSelector';
import { WeeklyByWeeksOverviewContent } from './WeeklyByWeeksOverviewPage';
import { getWeekAuditForCompany, isWeekValidatedForCompany, useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { downloadEmployeeWeekPdf, downloadWeeklyGridPdf, downloadWeeklyOverviewPdf } from '../utils/pdf';
import type { AreaId, Employee } from '../types';
import { isWorkAssignment } from '../utils/assignments';

export function WeeklyOverviewPage(): JSX.Element {
  const toast = useToast();
  const { isOpen: isPersonalPdfModalOpen, onOpen: openPersonalPdfModal, onClose: closePersonalPdfModal } = useDisclosure();
  const allEmployees = useAppStore((state) => state.employees);
  const allRoles = useAppStore((state) => state.roles);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const selectedGeoVictoriaCompanyId = useAuthStore((state) => state.selectedGeoVictoriaCompanyId);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const validatedWeekIds = useAppStore((state) => state.validatedWeekIds);
  const weekAuditById = useAppStore((state) => state.weekAuditById);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const areaBreakConfig = useAppStore((state) => state.breakConfigByArea[state.currentAreaId] ?? state.breakConfig);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);

  const scopedWeekKey = (areaId: AreaId, weekId: string): string => `${areaId}::${weekId}`;
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
  const roles = useMemo(
    () => allRoles.filter((role) => (role.areaId ?? 'salon') === currentAreaId),
    [allRoles, currentAreaId]
  );
  const currentWeek = weeks.find((week) => week.startDateISO === currentWeekStartDateISO);
  useEffect(() => {
    if (currentWeek) ensureWeekPlan(currentWeek);
  }, [currentWeek, currentAreaId, ensureWeekPlan]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'weeks' | 'grid'>('grid');
  const [personalPdfMode, setPersonalPdfMode] = useState<'single' | 'all'>('single');
  const [selectedEmployeeIdForPdf, setSelectedEmployeeIdForPdf] = useState<string>('');
  const currentScopedWeekId = currentWeek ? scopedWeekKey(currentAreaId, currentWeek.id) : null;
  const currentWeekPlan = currentScopedWeekId ? weekPlans[currentScopedWeekId] : undefined;
  const currentWeekAudit = getWeekAuditForCompany(weekAuditById, currentScopedWeekId, selectedGeoVictoriaCompanyId);
  const isCurrentWeekValidated = isWeekValidatedForCompany(validatedWeekIds, currentScopedWeekId, selectedGeoVictoriaCompanyId);
  const effectiveWeekConfig = currentScopedWeekId ? weekConfigById[currentScopedWeekId] : undefined;
  const timeSlots = effectiveWeekConfig?.timeSlots ?? areaTimeSlots;
  const breakConfig = effectiveWeekConfig?.breakConfig ?? areaBreakConfig;
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
          if (!isWorkAssignment(assignment)) continue;
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
  const selectedEmployeeForPdf = useMemo(
    () => activeEmployees.find((employee) => employee.id === selectedEmployeeIdForPdf) ?? null,
    [activeEmployees, selectedEmployeeIdForPdf]
  );

  useEffect(() => {
    if (!activeEmployees.length) {
      setSelectedEmployeeIdForPdf('');
      return;
    }

    setSelectedEmployeeIdForPdf((currentSelected) =>
      activeEmployees.some((employee) => employee.id === currentSelected) ? currentSelected : activeEmployees[0].id
    );
  }, [activeEmployees]);

  const buildPdfPayload = () => {
    if (!currentWeek || !currentWeekPlan) return null;
    return {
      employees,
      roles,
      timeSlots,
      breakConfig,
      week: currentWeek,
      weekPlan: currentWeekPlan,
      isValidated: isWeekValidatedForCompany(validatedWeekIds, currentScopedWeekId, selectedGeoVictoriaCompanyId),
      validatedByName: currentWeekAudit?.validatedByName ?? null
    };
  };

  const exportPersonalPdf = (mode: 'single' | 'all', employee?: Employee | null) => {
    const payload = buildPdfPayload();
    if (!payload) {
      toast({ status: 'warning', title: 'No hay planificación para exportar.' });
      return;
    }

    if (mode === 'single') {
      if (!employee) {
        toast({ status: 'warning', title: 'Selecciona un colaborador para exportar.' });
        return;
      }
      downloadEmployeeWeekPdf({
        employee,
        roles,
        timeSlots,
        breakConfig,
        week: payload.week,
        weekPlan: payload.weekPlan,
        isValidated: payload.isValidated,
        validatedByName: payload.validatedByName
      });
      toast({ status: 'success', title: `PDF generado para ${employee.name}.` });
      return;
    }

    downloadWeeklyOverviewPdf(payload);
    toast({ status: 'success', title: 'PDF de todos los colaboradores generado.' });
  };

  const handlePdfExport = () => {
    if (!currentWeek || !currentWeekPlan) {
      toast({ status: 'warning', title: 'No hay planificación para exportar.' });
      return;
    }

    if (viewMode === 'personal') {
      openPersonalPdfModal();
      return;
    }

    try {
      setIsExportingPdf(true);
      const payload = buildPdfPayload();
      if (!payload) {
        toast({ status: 'warning', title: 'No hay planificación para exportar.' });
        return;
      }

      if (viewMode === 'grid') {
        downloadWeeklyGridPdf(payload);
        toast({ status: 'success', title: 'PDF del modo Grid generado.' });
      } else {
        downloadWeeklyOverviewPdf(payload);
        toast({ status: 'success', title: 'PDF de vista general generado.' });
      }
    } catch {
      toast({
        status: 'error',
        title: viewMode === 'grid' ? 'No se pudo generar el PDF del modo Grid.' : 'No se pudo generar el PDF de vista general.'
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleConfirmPersonalPdfExport = () => {
    try {
      setIsExportingPdf(true);
      exportPersonalPdf(personalPdfMode, selectedEmployeeForPdf);
      closePersonalPdfModal();
    } catch {
      toast({ status: 'error', title: 'No se pudo generar el PDF del modo Personal.' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <Box>
      <Card mb={4}>
        <CardBody>
          <Flex direction={{ base: 'column', xl: 'row' }} justify="space-between" align={{ base: 'stretch', xl: 'center' }} gap={3}>
            <Heading size="md">Vista General</Heading>
            <HStack spacing={2} align="center" wrap={{ base: 'wrap', xl: 'nowrap' }} justify="flex-end">
              <Select
                maxW="220px"
                minW="160px"
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as 'personal' | 'weeks' | 'grid')}
              >
                <option value="personal">Personal</option>
                <option value="grid">Grid</option>
                <option value="weeks">Semanas</option>
              </Select>
              {viewMode !== 'weeks' ? (
                <>
                  <Box flexShrink={0}>
                    <WeekSelector compact />
                  </Box>
                  {viewMode === 'personal' || viewMode === 'grid' ? (
                    <Button
                      colorScheme="teal"
                      variant="outline"
                      isLoading={isExportingPdf}
                      isDisabled={!currentWeek || !currentWeekPlan}
                      onClick={handlePdfExport}
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
                  breakConfig={breakConfig}
                  employeeHoursById={employeeHoursById}
                  showEmployeeCodeInCells
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
                    breakConfig={breakConfig}
                    maxTableHeight="42vh"
                  />
                </CardBody>
              </Card>
            );
          })}
        </VStack>
      )}

      <Modal isOpen={isPersonalPdfModalOpen} onClose={closePersonalPdfModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Exportar PDF Personal</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Tipo de exportación</FormLabel>
                <Select value={personalPdfMode} onChange={(event) => setPersonalPdfMode(event.target.value as 'single' | 'all')}>
                  <option value="single">Solo un colaborador</option>
                  <option value="all">Todos los colaboradores</option>
                </Select>
              </FormControl>

              {personalPdfMode === 'single' ? (
                <FormControl>
                  <FormLabel>Colaborador</FormLabel>
                  <Select value={selectedEmployeeIdForPdf} onChange={(event) => setSelectedEmployeeIdForPdf(event.target.value)}>
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={closePersonalPdfModal}>
                Cancelar
              </Button>
              <Button colorScheme="teal" onClick={handleConfirmPersonalPdfExport} isLoading={isExportingPdf}>
                Generar PDF
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
