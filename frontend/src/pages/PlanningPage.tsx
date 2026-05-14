import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { differenceInCalendarWeeks, formatISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiDownload, FiEye, FiSave, FiXCircle } from 'react-icons/fi';
import { CellEditorModal } from '../components/CellEditorModal';
import { DayGrid } from '../components/DayGrid';
import { WeekSelector } from '../components/WeekSelector';
import { DayTabs } from '../components/DayTabs';
import { EmployeeProfileDrawer } from '../components/EmployeeProfileDrawer';
import { LegendDrawer } from '../components/LegendDrawer';
import { getWeekAuditForCompany, isWeekValidatedForCompany, useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import type { AreaId, Assignment } from '../types';
import { isBreakAssignment, suppressesConfiguredBreak } from '../utils/assignments';
import { isTimeSlotInBreak } from '../utils/breaks';
import { getCurrentMonday } from '../utils/dates';
import { isAnyRestDayForDate, isRestDayForDate } from '../utils/weekdays';
import { downloadDaySchedulePdf } from '../utils/pdf';
import { getOpeningClosingSummary } from '../utils/summary';

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
  const { isOpen: isValidateModalOpen, onOpen: openValidateModal, onClose: closeValidateModal } = useDisclosure();
  const {
    isOpen: isBlockedNextWeekModalOpen,
    onOpen: openBlockedNextWeekModal,
    onClose: closeBlockedNextWeekModal
  } = useDisclosure();
  const {
    isOpen: isMigrateModalOpen,
    onOpen: openMigrateModal,
    onClose: closeMigrateModal
  } = useDisclosure();

  const allEmployees = useAppStore((state) => state.employees);
  const allRoles = useAppStore((state) => state.roles);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const validatedWeekIds = useAppStore((state) => state.validatedWeekIds);
  const weekAuditById = useAppStore((state) => state.weekAuditById);
  const areaValidationRequirements = useAppStore(
    (state) => state.validationRequirementsByArea[state.currentAreaId] ?? state.validationRequirements
  );
  const areaBreakConfig = useAppStore((state) => state.breakConfigByArea[state.currentAreaId] ?? state.breakConfig);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);
  const updateAssignment = useAppStore((state) => state.updateAssignment);
  const updateEmployeeDayAssignments = useAppStore((state) => state.updateEmployeeDayAssignments);
  const updateEmployeeDayByHours = useAppStore((state) => state.updateEmployeeDayByHours);
  const setExceptionalRestDay = useAppStore((state) => state.setExceptionalRestDay);
  const validateWeekPlan = useAppStore((state) => state.validateWeekPlan);
  const desvalidateWeekPlan = useAppStore((state) => state.desvalidateWeekPlan);
  const migrateFromPreviousWeek = useAppStore((state) => state.migrateFromPreviousWeek);
  const flushPersistence = useAppStore((state) => state.flushPersistence);
  const pendingPlanningEdits = useAppStore((state) => state.pendingPlanningEdits);
  const currentUser = useAuthStore((state) => state.currentUser);
  const selectedGeoVictoriaCompanyId = useAuthStore((state) => state.selectedGeoVictoriaCompanyId);
  const isSupervisor = currentUser?.role === 'supervisor';
  const isAdministrator = currentUser?.role === 'administrador';
  const isSuperAdministrator = currentUser?.role === 'super_administrador';
  const canEdit = isSuperAdministrator || isAdministrator || isSupervisor;
  const canValidate = isSuperAdministrator || isSupervisor;

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSavingPlanning, setIsSavingPlanning] = useState(false);
  const validationToastId = 'planning-validation-save';
  const planningSaveToastId = 'planning-manual-save';

  const scopedWeekKey = (areaId: AreaId, weekId: string): string => `${areaId}::${weekId}`;
  const currentWeek = weeks.find((week) => week.startDateISO === currentWeekStartDateISO);
  const currentScopedWeekId = currentWeek ? scopedWeekKey(currentAreaId, currentWeek.id) : null;
  const currentWeekAudit = getWeekAuditForCompany(weekAuditById, currentScopedWeekId, selectedGeoVictoriaCompanyId);
  const isCurrentWeekValidated = isWeekValidatedForCompany(validatedWeekIds, currentScopedWeekId, selectedGeoVictoriaCompanyId);
  const employees = useMemo(
    () => {
      const base = allEmployees
        .filter(
          (employee) =>
            employee.areaId === currentAreaId &&
            (!selectedGeoVictoriaCompanyId ||
              (employee.moduleCompanyId ?? employee.companyId ?? '') === selectedGeoVictoriaCompanyId)
        )
        .slice()
        .sort((a, b) => {
          const orderA = a.displayOrder ?? Number.POSITIVE_INFINITY;
          const orderB = b.displayOrder ?? Number.POSITIVE_INFINITY;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
      if (isCurrentWeekValidated && currentWeekAudit?.inactiveEmployeeIds) {
        const inactiveSet = new Set(currentWeekAudit.inactiveEmployeeIds);
        return base.map((employee) =>
          inactiveSet.has(employee.id)
            ? { ...employee, active: false }
            : { ...employee, active: true }
        );
      }
      return base;
    },
    [allEmployees, currentAreaId, selectedGeoVictoriaCompanyId, isCurrentWeekValidated, currentWeekAudit]
  );
  const roles = useMemo(
    () => allRoles.filter((role) => (role.areaId ?? 'salon') === currentAreaId),
    [allRoles, currentAreaId]
  );
  const effectiveWeekConfig = currentScopedWeekId ? weekConfigById[currentScopedWeekId] : undefined;
  const timeSlots = useMemo(() => {
    const candidateSlots = effectiveWeekConfig?.timeSlots?.length ? effectiveWeekConfig.timeSlots : areaTimeSlots;
    if (!currentScopedWeekId) return candidateSlots;
    const plan = weekPlans[currentScopedWeekId];
    if (!plan?.days?.[0]) return candidateSlots;
    const planSlotIds = Object.keys(plan.days[0].assignments);
    if (planSlotIds.length === 0) return candidateSlots;
    const candidateIdSet = new Set(candidateSlots.map((s) => s.id));
    const allMatch = planSlotIds.every((id) => candidateIdSet.has(id));
    if (allMatch) return candidateSlots;
    // Plan slot IDs don't match candidate slots — fall back to areaTimeSlots
    const areaIdSet = new Set(areaTimeSlots.map((s) => s.id));
    const areaMatch = planSlotIds.every((id) => areaIdSet.has(id));
    if (areaMatch) return areaTimeSlots;
    return candidateSlots;
  }, [effectiveWeekConfig, areaTimeSlots, currentScopedWeekId, weekPlans]);
  const validationRequirements = effectiveWeekConfig?.validationRequirements ?? areaValidationRequirements;
  const breakConfig = effectiveWeekConfig?.breakConfig ?? areaBreakConfig;
  const currentWorkflowWeekStartDateISO = useMemo(() => formatISO(getCurrentMonday(), { representation: 'date' }), []);
  const workflowWeek = useMemo(
    () => weeks.find((week) => week.startDateISO === currentWorkflowWeekStartDateISO) ?? null,
    [currentWorkflowWeekStartDateISO, weeks]
  );
  const workflowScopedWeekId = workflowWeek ? scopedWeekKey(currentAreaId, workflowWeek.id) : null;
  const isWorkflowWeekValidated = isWeekValidatedForCompany(
    validatedWeekIds,
    workflowScopedWeekId,
    selectedGeoVictoriaCompanyId
  );
  const isSelectedNextWorkflowWeek = useMemo(() => {
    if (!currentWeek) return false;
    return differenceInCalendarWeeks(new Date(currentWeek.startDateISO), new Date(currentWorkflowWeekStartDateISO), {
      weekStartsOn: 1
    }) === 1;
  }, [currentWeek, currentWorkflowWeekStartDateISO]);
  const shouldPromptValidateCurrentWeekFirst =
    canEdit && isSelectedNextWorkflowWeek && !isWorkflowWeekValidated && !isCurrentWeekValidated;
  const canEditWeek = useMemo(() => {
    if (!canEdit || isCurrentWeekValidated || !currentWeek) return false;
    if (currentWeek.startDateISO <= currentWorkflowWeekStartDateISO) return true;

    const orderedWeeks = [...weeks].sort((a, b) => a.startDateISO.localeCompare(b.startDateISO));
    const currentIndex = orderedWeeks.findIndex((week) => week.id === currentWeek.id);
    if (currentIndex <= 0) return true;

    const previousWeek = orderedWeeks[currentIndex - 1];
    const previousScopedWeekId = scopedWeekKey(currentAreaId, previousWeek.id);
    return isWeekValidatedForCompany(validatedWeekIds, previousScopedWeekId, selectedGeoVictoriaCompanyId);
  }, [canEdit, currentAreaId, currentWeek, currentWorkflowWeekStartDateISO, isCurrentWeekValidated, selectedGeoVictoriaCompanyId, validatedWeekIds, weeks]);
  useEffect(() => {
    if (currentWeek) ensureWeekPlan(currentWeek);
  }, [currentWeek, currentAreaId, ensureWeekPlan]);

  const currentWeekPlan = currentScopedWeekId ? weekPlans[currentScopedWeekId] : undefined;
  const days = currentWeekPlan?.days ?? [];
  const activeDay = days[activeDayIndex];
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const summary = activeDay ? getOpeningClosingSummary(activeDay, timeSlots, employees) : { opening: 0, closing: 0 };
  const activeDayOfWeek = activeDay ? new Date(`${activeDay.dateISO}T00:00:00`).getDay() : null;
  const dayValidation = activeDayOfWeek === null ? { opening: 0, closing: 0 } : validationRequirements[activeDayOfWeek];
  const openingTarget = dayValidation?.opening ?? 0;
  const closingTarget = dayValidation?.closing ?? 0;
  const openingDelta = summary.opening - openingTarget;
  const closingDelta = summary.closing - closingTarget;
  const getCoverageStatus = (delta: number): 'ok' | 'excess' | 'missing' => {
    if (delta === 0) return 'ok';
    return delta > 0 ? 'excess' : 'missing';
  };
  const validationToneByStatus = {
    ok: {
      bg: 'green.50',
      borderColor: 'green.200',
      iconColor: 'green.500',
      textColor: 'green.700',
      Icon: FiCheckCircle
    },
    excess: {
      bg: 'yellow.50',
      borderColor: 'yellow.300',
      iconColor: 'yellow.600',
      textColor: 'yellow.700',
      Icon: FiAlertTriangle
    },
    missing: {
      bg: 'red.50',
      borderColor: 'red.200',
      iconColor: 'red.500',
      textColor: 'red.700',
      Icon: FiXCircle
    }
  } as const;
  const openingStatus = getCoverageStatus(openingDelta);
  const closingStatus = getCoverageStatus(closingDelta);
  const openingTone = validationToneByStatus[openingStatus];
  const closingTone = validationToneByStatus[closingStatus];
  const OpeningStatusIcon = openingTone.Icon;
  const ClosingStatusIcon = closingTone.Icon;
  const hasValidationMismatch = openingDelta !== 0 || closingDelta !== 0;
  const hasMissingCoverage = openingStatus === 'missing' || closingStatus === 'missing';
  const repeatedRestDayInfo = useMemo(() => {
    if (!activeDay) return null;

    const count = employees.filter((employee) => {
      if (!employee.active) return false;
      return timeSlots.every((slot) => {
        const assignment = activeDay.assignments[slot.id]?.[employee.id];
        return !assignment || assignment.code === 'LIBRE' || assignment.roleId === null;
      });
    }).length;

    if (count < 2) return null;

    return {
      count,
      label: activeDay.dayName
    };
  }, [activeDay, employees, timeSlots]);
  const selectedCellIsExceptionalBreak = Boolean(selectedCell?.assignment && isBreakAssignment(selectedCell.assignment));
  useEffect(() => {
    setActiveDayIndex(0);
  }, [currentWeekStartDateISO]);

  useEffect(() => {
    if (!pendingPlanningEdits) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingPlanningEdits]);

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
          if (slotHours <= 0) continue;
          const slot = timeSlots.find((item) => item.id === slotId);
          for (const [employeeId, assignment] of Object.entries(byEmployee)) {
            const configuredBreakWithoutOverride =
              Boolean(slot) &&
              isTimeSlotInBreak(slot, breakConfig) &&
              assignment.roleId === null &&
              assignment.code === 'LIBRE' &&
              !suppressesConfiguredBreak(assignment);
            if (configuredBreakWithoutOverride) continue;
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
  }, [employees, timeSlots, currentWeekPlan, breakConfig]);
  const overtimeEmployees = useMemo(() => {
    return employees
      .filter((employee) => employee.active)
      .map((employee) => {
        const summary = employeeHoursById[employee.id];
        const assignedHours = summary?.assignedHours ?? 0;
        const targetHours = summary?.targetHours ?? (employee.weeklyHours ?? 0);
        const assignedHoursRounded = Math.round(assignedHours);
        const targetHoursRounded = Math.round(targetHours);
        const extraHours = assignedHoursRounded - targetHoursRounded;
        return {
          id: employee.id,
          name: employee.name,
          assignedHours: assignedHoursRounded,
          targetHours: targetHoursRounded,
          extraHours
        };
      })
      .filter((employee) => employee.targetHours > 0 && employee.extraHours > 0)
      .sort((a, b) => b.extraHours - a.extraHours);
  }, [employees, employeeHoursById]);
  const underAssignedEmployees = useMemo(() => {
    return employees
      .filter((employee) => employee.active)
      .map((employee) => {
        const summary = employeeHoursById[employee.id];
        const assignedHours = summary?.assignedHours ?? 0;
        const targetHours = summary?.targetHours ?? (employee.weeklyHours ?? 0);
        const assignedHoursRounded = Math.round(assignedHours);
        const targetHoursRounded = Math.round(targetHours);
        const missingHours = targetHoursRounded - assignedHoursRounded;
        return {
          id: employee.id,
          name: employee.name,
          assignedHours: assignedHoursRounded,
          targetHours: targetHoursRounded,
          missingHours
        };
      })
      .filter((employee) => employee.targetHours > 0 && employee.missingHours > 0)
      .sort((a, b) => b.missingHours - a.missingHours);
  }, [employees, employeeHoursById]);

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
              <Flex gap={3} wrap={{ base: 'wrap', lg: 'nowrap' }} align="center" flexShrink={0}>
                <Box w={{ base: '100%', sm: '300px' }} minW={{ base: '100%', sm: '300px' }}>
                  <WeekSelector />
                </Box>
                <Button colorScheme="brand" leftIcon={<FiEye />} onClick={openLegend} flexShrink={0}>
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
                        breakConfig,
                        week: currentWeek,
                        isValidated: isWeekValidatedForCompany(
                          validatedWeekIds,
                          currentScopedWeekId,
                          selectedGeoVictoriaCompanyId
                        ),
                        validatedByName: currentWeekAudit?.validatedByName ?? null,
                        restDayOverrides: currentWeekPlan?.restDayOverrides
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
                {canEdit && !isCurrentWeekValidated && (
                  <Button
                    colorScheme="brand"
                    variant="outline"
                    leftIcon={<FiCopy />}
                    isDisabled={!currentWeek}
                    onClick={openMigrateModal}
                  >
                    Duplicar Semana Anterior
                  </Button>
                )}
                {canEdit && !isCurrentWeekValidated && (
                  <Tooltip
                    label={
                      pendingPlanningEdits
                        ? 'Hay cambios sin guardar en esta planificación.'
                        : 'No hay cambios pendientes.'
                    }
                    hasArrow
                  >
                    <Button
                      colorScheme={pendingPlanningEdits ? 'orange' : 'gray'}
                      leftIcon={<FiSave />}
                      isDisabled={!currentWeek || !pendingPlanningEdits || isSavingPlanning}
                      isLoading={isSavingPlanning}
                      loadingText="Guardando..."
                      onClick={async () => {
                        if (isSavingPlanning) return;
                        setIsSavingPlanning(true);
                        toast({
                          id: planningSaveToastId,
                          status: 'info',
                          title: 'Guardando planificación...',
                          duration: null,
                          isClosable: false
                        });
                        try {
                          const result = await flushPersistence();
                          toast.close(planningSaveToastId);
                          if (!result.ok) {
                            toast({
                              status: 'error',
                              title: result.error ?? 'No se pudo guardar la planificación.'
                            });
                            return;
                          }
                          toast({ status: 'success', title: 'Planificación guardada.' });
                        } finally {
                          toast.close(planningSaveToastId);
                          setIsSavingPlanning(false);
                        }
                      }}
                    >
                      {pendingPlanningEdits ? 'Guardar cambios' : 'Guardado'}
                    </Button>
                  </Tooltip>
                )}
                {canValidate ? (
                  <Tooltip
                    label={
                      isCurrentWeekValidated
                        ? 'Se quitará la validación de la planificación al confirmar.'
                        : 'Se validará la planificación al confirmar.'
                    }
                    hasArrow
                  >
                    <Button
                      colorScheme={isCurrentWeekValidated ? 'orange' : 'green'}
                      onClick={openValidateModal}
                      isDisabled={!currentWeek}
                    >
                      {isCurrentWeekValidated ? 'Retornar' : 'Validar'}
                    </Button>
                  </Tooltip>
                ) : (
                  <Badge colorScheme={isCurrentWeekValidated ? 'green' : 'orange'} px={3} py={1} rounded="full" variant="subtle">
                    {isCurrentWeekValidated ? 'Planificación Validada' : 'Planificación No Validada'}
                  </Badge>
                )}
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
                      breakConfig={breakConfig}
                      restDayOverrides={currentWeekPlan?.restDayOverrides}
                      employeeHoursById={employeeHoursById}
                      showEmployeeCodeInCells
                      readOnly={!canEditWeek}
                      showInactiveEmployees={isCurrentWeekValidated}
                      allowCellClickWhenReadOnly={shouldPromptValidateCurrentWeekFirst}
                      onCellClick={(cell) => {
                        if (canEditWeek) {
                          setSelectedCell(cell);
                          openEditor();
                          return;
                        }
                        if (shouldPromptValidateCurrentWeekFirst) {
                          openBlockedNextWeekModal();
                        }
                      }}
                      onApplyRange={({ sourceCell, untilTimeSlotId }) => {
                        if (!canEditWeek || !activeDay || !currentWeek) return;
                        if (isBreakAssignment(sourceCell.assignment)) return;
                        const employee = employees.find((item) => item.id === sourceCell.employeeId);
                        const override = currentWeekPlan?.restDayOverrides?.[sourceCell.employeeId];
                        const isRestToday = override
                          ? isAnyRestDayForDate(activeDay.dateISO, override)
                          : isRestDayForDate(activeDay.dateISO, employee?.restDay);
                        if (isRestToday) return;
                        const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order);
                        const sourceIndex = orderedSlots.findIndex((slot) => slot.id === sourceCell.timeSlotId);
                        const untilIndex = orderedSlots.findIndex((slot) => slot.id === untilTimeSlotId);
                        if (sourceIndex < 0 || untilIndex < 0 || untilIndex === sourceIndex) return;
                        const [fromIdx, toIdx] =
                          sourceIndex < untilIndex
                            ? [sourceIndex + 1, untilIndex + 1]
                            : [untilIndex, sourceIndex];
                        const targetSlotIds = orderedSlots
                          .slice(fromIdx, toIdx)
                          .filter((slot) => {
                            if (isTimeSlotInBreak(slot, breakConfig)) return false;
                            const existing = activeDay.assignments[slot.id]?.[sourceCell.employeeId];
                            return !(existing && isBreakAssignment(existing));
                          })
                          .map((slot) => slot.id);
                        if (targetSlotIds.length === 0) {
                          toast({ status: 'info', title: 'No hay celdas válidas en el rango.' });
                          return;
                        }
                        const isFreeSource = sourceCell.assignment.roleId === null;
                        const result = updateEmployeeDayAssignments({
                          weekId: currentScopedWeekId ?? currentWeek.id,
                          dateISO: activeDay.dateISO,
                          employeeId: sourceCell.employeeId,
                          assignment: isFreeSource
                            ? { roleId: null, code: 'LIBRE', explicitFree: true }
                            : { roleId: sourceCell.assignment.roleId, code: sourceCell.assignment.code, explicitFree: false },
                          timeSlotIds: targetSlotIds,
                          actorName: currentUser?.name
                        });
                        if (!result.ok) {
                          toast({ status: 'error', title: result.error ?? 'No se pudo rellenar.' });
                        } else {
                          toast({ status: 'success', title: `Se rellenaron ${targetSlotIds.length} celda(s).` });
                        }
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
                      Apertura: {openingTarget}
                    </Badge>
                    <Badge colorScheme="purple" px={3} py={1} rounded="full" variant="subtle">
                      Cierre: {closingTarget}
                    </Badge>
                    {breakConfig.enabled ? (
                      <Badge colorScheme="yellow" px={3} py={1} rounded="full" variant="subtle">
                        Refrigerio: {String(breakConfig.startHour).padStart(2, '0')}:00 - {String(breakConfig.endHour).padStart(2, '0')}:00
                      </Badge>
                    ) : null}
                  </HStack>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="white" borderColor="gray.200" borderWidth="1px" w={{ base: '100%', xl: '50%' }}>
              <CardBody>
                <Stack spacing={3}>
                  <HStack spacing={2} color="blue.700">
                    <Box color={hasMissingCoverage ? 'red.500' : hasValidationMismatch ? 'orange.500' : 'blue.500'} mt={0.5}>
                      {hasValidationMismatch ? <FiAlertTriangle /> : <FiCheckCircle />}
                    </Box>
                    <Text fontWeight="800" letterSpacing="0.03em" textTransform="uppercase">
                      Notas de Planificación
                    </Text>
                  </HStack>

                  <Box
                    bg={openingTone.bg}
                    borderWidth="1px"
                    borderColor={openingTone.borderColor}
                    rounded="md"
                    px={4}
                    py={3}
                  >
                    <HStack align="start" spacing={2}>
                      <Box color={openingTone.iconColor} mt={0.5}>
                        <OpeningStatusIcon />
                      </Box>
                      <Stack spacing={0} flex="1">
                        <Text fontSize="sm" fontWeight="700" color={openingTone.textColor}>
                          Apertura:{' '}
                          {openingDelta > 0
                            ? `se requiere ${openingTarget} y hay ${summary.opening}. Se excedió por ${openingDelta}.`
                            : openingDelta < 0
                              ? `se requiere ${openingTarget} y sólo hay ${summary.opening}.`
                              : `cobertura correcta (${summary.opening}/${openingTarget}).`}
                        </Text>
                        <Text fontSize="sm" color={openingTone.textColor}>
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
                    bg={closingTone.bg}
                    borderWidth="1px"
                    borderColor={closingTone.borderColor}
                    rounded="md"
                    px={4}
                    py={3}
                  >
                    <HStack align="start" spacing={2}>
                      <Box color={closingTone.iconColor} mt={0.5}>
                        <ClosingStatusIcon />
                      </Box>
                      <Stack spacing={0} flex="1">
                        <Text fontSize="sm" fontWeight="700" color={closingTone.textColor}>
                          Cierre:{' '}
                          {closingDelta > 0
                            ? `se requiere ${closingTarget} y hay ${summary.closing}. Se excedió por ${closingDelta}.`
                            : closingDelta < 0
                              ? `se requiere ${closingTarget} y sólo hay ${summary.closing}.`
                              : `cobertura correcta (${summary.closing}/${closingTarget}).`}
                        </Text>
                        <Text fontSize="sm" color={closingTone.textColor}>
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

                  {overtimeEmployees.length ? (
                    <Box bg="yellow.50" borderWidth="1px" borderColor="yellow.300" rounded="md" px={4} py={3}>
                      <HStack align="start" spacing={2}>
                        <Box color="yellow.600" mt={0.5}>
                          <FiAlertTriangle />
                        </Box>
                        <Stack spacing={0} flex="1">
                          <Text fontSize="sm" fontWeight="700" color="yellow.700">
                            Alerta: {overtimeEmployees.length} colaborador(es) con horas extras sobre su objetivo semanal.
                          </Text>
                          {overtimeEmployees.map((employee) => (
                            <Text key={employee.id} fontSize="sm" color="yellow.700">
                              {employee.name}: {employee.assignedHours}h/{employee.targetHours}h (+{employee.extraHours}h)
                            </Text>
                          ))}
                        </Stack>
                      </HStack>
                    </Box>
                  ) : null}

                  {underAssignedEmployees.length ? (
                    <Box bg="red.50" borderWidth="1px" borderColor="red.300" rounded="md" px={4} py={3}>
                      <HStack align="start" spacing={2}>
                        <Box color="red.600" mt={0.5}>
                          <FiAlertTriangle />
                        </Box>
                        <Stack spacing={0} flex="1">
                          <Text fontSize="sm" fontWeight="700" color="red.700">
                            Alerta: {underAssignedEmployees.length} colaborador(es) por debajo de su objetivo semanal.
                          </Text>
                          {underAssignedEmployees.map((employee) => (
                            <Text key={employee.id} fontSize="sm" color="red.700">
                              {employee.name}: {employee.assignedHours}h/{employee.targetHours}h (-{employee.missingHours}h)
                            </Text>
                          ))}
                        </Stack>
                      </HStack>
                    </Box>
                  ) : null}
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        )}
      </Stack>

      <LegendDrawer isOpen={isLegendOpen} onClose={closeLegend} roles={roles} canManage={canEdit} />
      <EmployeeProfileDrawer
        isOpen={isProfileOpen}
        onClose={closeProfile}
        employee={selectedEmployee}
        roles={roles}
        timeSlots={timeSlots}
        breakConfig={breakConfig}
        weekPlan={currentWeekPlan}
      />
      <CellEditorModal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        assignment={selectedCell?.assignment ?? null}
        employeeName={employees.find((employee) => employee.id === selectedCell?.employeeId)?.name}
        roles={roles}
        defaultDayHours={timeSlots.reduce((sum, slot) => {
          if (isTimeSlotInBreak(slot, breakConfig)) return sum;
          return sum + getDurationHours(slot.start, slot.end);
        }, 0)}
        isNormalRestDay={(() => {
          if (!activeDay || !selectedCell) return false;
          const emp = employees.find((e) => e.id === selectedCell.employeeId);
          return isRestDayForDate(activeDay.dateISO, emp?.restDay);
        })()}
        isNormalBreakSlot={(() => {
          if (!activeDay || !selectedCell) return false;
          const slot = timeSlots.find((item) => item.id === selectedCell.timeSlotId);
          return slot ? isTimeSlotInBreak(slot, breakConfig) : false;
        })()}
        isExceptionalRestDay={(() => {
          if (!activeDay || !selectedCell || !currentWeekPlan?.restDayOverrides) return false;
          const override = currentWeekPlan.restDayOverrides[selectedCell.employeeId];
          if (!override || override.length === 0) return false;
          return override.includes(new Date(`${activeDay.dateISO}T00:00:00`).getDay());
        })()}
        isExceptionalBreak={selectedCellIsExceptionalBreak}
        onSave={({ assignment, applyToEmployeeDay, dayHours, exceptionalRestDay, exceptionalBreak }) => {
          if (!canEdit) {
            toast({ status: 'error', title: 'Tu perfil es solo de visualización.' });
            return;
          }
          if (isCurrentWeekValidated) {
            toast({ status: 'error', title: 'La semana validada está en solo lectura. Retorna la validación para editar.' });
            return;
          }
          if (!selectedCell || !activeDay || !currentWeek) return;
          // Descanso excepcional: activar o desactivar
          if (exceptionalRestDay !== undefined) {
            const result = setExceptionalRestDay({
              weekId: currentScopedWeekId ?? currentWeek.id,
              dateISO: activeDay.dateISO,
              employeeId: selectedCell.employeeId,
              active: exceptionalRestDay
            });
            if (!result.ok) {
              toast({ status: 'error', title: result.error ?? 'No se pudo guardar.' });
            }
            return;
          }
          if (exceptionalBreak !== undefined) {
            const result = updateAssignment({
              weekId: currentScopedWeekId ?? currentWeek.id,
              dateISO: activeDay.dateISO,
              timeSlotId: selectedCell.timeSlotId,
              employeeId: selectedCell.employeeId,
              assignment,
              actorName: currentUser?.name
            });
            if (!result.ok) {
              toast({ status: 'error', title: result.error ?? 'No se pudo guardar.' });
            }
            return;
          }
          let result;
          if (applyToEmployeeDay && dayHours !== undefined) {
            result = updateEmployeeDayByHours({
              weekId: currentScopedWeekId ?? currentWeek.id,
              dateISO: activeDay.dateISO,
              employeeId: selectedCell.employeeId,
              assignment,
              hours: dayHours,
              actorName: currentUser?.name
            });
          } else if (applyToEmployeeDay) {
            result = updateEmployeeDayAssignments({
              weekId: currentScopedWeekId ?? currentWeek.id,
              dateISO: activeDay.dateISO,
              employeeId: selectedCell.employeeId,
              assignment,
              timeSlotIds: timeSlots.map((slot) => slot.id),
              actorName: currentUser?.name
            });
          } else {
            result = updateAssignment({
              weekId: currentScopedWeekId ?? currentWeek.id,
              dateISO: activeDay.dateISO,
              timeSlotId: selectedCell.timeSlotId,
              employeeId: selectedCell.employeeId,
              assignment,
              actorName: currentUser?.name
            });
          }
          if (!result.ok) {
            toast({ status: 'error', title: result.error ?? 'No se pudo guardar.' });
          }
        }}
      />
      <Modal isOpen={isValidateModalOpen} onClose={closeValidateModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isCurrentWeekValidated ? 'Quitar validación' : 'Validar planificación'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              {isCurrentWeekValidated
                ? '¿Desea quitar la validación de la planificación de la semana seleccionada?'
                : '¿Desea validar la planificación de la semana seleccionada?'}
            </Text>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={closeValidateModal}>
                Cancelar
              </Button>
              <Button
                colorScheme={isCurrentWeekValidated ? 'orange' : 'green'}
                onClick={async () => {
                  if (!currentWeek) return;
                  if (isValidating) return;
                  setIsValidating(true);
                  toast({
                    id: validationToastId,
                    status: 'info',
                    title: 'Guardando validación...',
                    duration: null,
                    isClosable: false
                  });
                  try {
                    const result = isCurrentWeekValidated
                      ? desvalidateWeekPlan(currentScopedWeekId ?? currentWeek.id)
                      : validateWeekPlan(currentScopedWeekId ?? currentWeek.id, currentUser?.name);
                    if (!result.ok) {
                      toast.close(validationToastId);
                      toast({
                        status: 'error',
                        title:
                          result.error ??
                          (isCurrentWeekValidated ? 'No se pudo quitar la validación.' : 'No se pudo validar la planificación.')
                      });
                      return;
                    }

                    const persisted = await flushPersistence();
                    toast.close(validationToastId);
                    if (!persisted.ok) {
                      toast({
                        status: 'error',
                        title: persisted.error ?? 'No se pudo guardar la validación.'
                      });
                      return;
                    }

                    toast({
                      status: 'success',
                      title: isCurrentWeekValidated ? 'Validación anulada.' : 'Planificación validada.'
                    });
                    closeValidateModal();
                  } finally {
                    toast.close(validationToastId);
                    setIsValidating(false);
                  }
                }}
                isDisabled={!currentWeek || isValidating}
                isLoading={isValidating}
              >
                {isCurrentWeekValidated ? 'Confirmar retorno' : 'Confirmar validación'}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={isBlockedNextWeekModalOpen} onClose={closeBlockedNextWeekModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Validación requerida</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Debes validar la semana actual para poder editar la planificación de la semana siguiente.</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="brand" onClick={closeBlockedNextWeekModal}>
              Entendido
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isMigrateModalOpen} onClose={closeMigrateModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Duplicar Semana Anterior</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Se copiarán las asignaciones de la semana anterior a la semana actual. Esto sobrescribirá la planificación actual.</Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={closeMigrateModal}>
              Cancelar
            </Button>
            <Button
              colorScheme="brand"
              onClick={() => {
                const result = migrateFromPreviousWeek();
                if (result.ok) {
                  toast({ status: 'success', title: 'Planificación duplicada desde la semana anterior.' });
                } else {
                  toast({ status: 'error', title: result.error ?? 'No se pudo duplicar.' });
                }
                closeMigrateModal();
              }}
            >
              Confirmar
            </Button>
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
