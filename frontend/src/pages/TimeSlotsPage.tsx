import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { WeekSelector } from '../components/WeekSelector';
import type { ValidationRequirements } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';

export function TimeSlotsPage(): JSX.Element {
  const toast = useToast();
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const weeks = useAppStore((state) => state.weeks);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const validatedWeekIds = useAppStore((state) => state.validatedWeekIds);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const areaShiftRanges = useAppStore((state) => state.shiftRangesByArea[state.currentAreaId] ?? state.shiftRanges);
  const areaValidationRequirements = useAppStore(
    (state) => state.validationRequirementsByArea[state.currentAreaId] ?? state.validationRequirements
  );
  const areaBreakConfig = useAppStore((state) => state.breakConfigByArea[state.currentAreaId] ?? state.breakConfig);
  const setPlanningHoursRange = useAppStore((state) => state.setPlanningHoursRange);
  const setShiftRanges = useAppStore((state) => state.setShiftRanges);
  const setValidationRequirements = useAppStore((state) => state.setValidationRequirements);
  const setBreakConfig = useAppStore((state) => state.setBreakConfig);
  const flushPersistence = useAppStore((state) => state.flushPersistence);
  const currentUser = useAuthStore((state) => state.currentUser);
  const canEdit = currentUser?.role === 'administrador' || currentUser?.role === 'supervisor';
  const currentWeek = useMemo(
    () => weeks.find((week) => week.startDateISO === currentWeekStartDateISO) ?? null,
    [currentWeekStartDateISO, weeks]
  );
  const currentScopedWeekId = currentWeek ? `${currentAreaId}::${currentWeek.id}` : null;
  const effectiveWeekConfig = currentScopedWeekId ? weekConfigById[currentScopedWeekId] : undefined;
  const isCurrentWeekValidated = currentScopedWeekId ? validatedWeekIds.includes(currentScopedWeekId) : false;
  const timeSlots = effectiveWeekConfig?.timeSlots ?? areaTimeSlots;
  const shiftRanges = effectiveWeekConfig?.shiftRanges ?? areaShiftRanges;
  const validationRequirements = effectiveWeekConfig?.validationRequirements ?? areaValidationRequirements;
  const breakConfig = effectiveWeekConfig?.breakConfig ?? areaBreakConfig;
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);

  const initialStartHour = useMemo(() => Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10), [ordered]);
  const initialEndHour = useMemo(
    () => Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10),
    [ordered]
  );

  const orderedHourBlocks = useMemo(
    () =>
      ordered
        .map((slot) => {
          const start = Number.parseInt(slot.start.slice(0, 2), 10);
          const end = Number.parseInt(slot.end.slice(0, 2), 10);
          if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null;
          return { id: slot.id, label: slot.label, start, end };
        })
        .filter((slot): slot is { id: string; label: string; start: number; end: number } => slot !== null),
    [ordered]
  );

  const [startHour, setStartHour] = useState(String(initialStartHour));
  const [endHour, setEndHour] = useState(String(initialEndHour));
  const [dayStartHour, setDayStartHour] = useState(String(shiftRanges.day.startHour));
  const [dayEndHour, setDayEndHour] = useState(String(shiftRanges.day.endHour));
  const [nightStartHour, setNightStartHour] = useState(String(shiftRanges.night.startHour));
  const [nightEndHour, setNightEndHour] = useState(String(shiftRanges.night.endHour));
  const [localValidation, setLocalValidation] = useState<ValidationRequirements>(validationRequirements);
  const [breakEnabled, setBreakEnabled] = useState(breakConfig.enabled);
  const [breakStartHour, setBreakStartHour] = useState(String(breakConfig.startHour));
  const [breakEndHour, setBreakEndHour] = useState(String(breakConfig.endHour));
  const [isSavingValidation, setIsSavingValidation] = useState(false);

  useEffect(() => {
    setStartHour(String(initialStartHour));
    setEndHour(String(initialEndHour));
  }, [initialStartHour, initialEndHour]);

  useEffect(() => {
    setDayStartHour(String(shiftRanges.day.startHour));
    setDayEndHour(String(shiftRanges.day.endHour));
    setNightStartHour(String(shiftRanges.night.startHour));
    setNightEndHour(String(shiftRanges.night.endHour));
  }, [shiftRanges.day.startHour, shiftRanges.day.endHour, shiftRanges.night.startHour, shiftRanges.night.endHour]);

  useEffect(() => {
    setLocalValidation(validationRequirements);
  }, [validationRequirements]);

  useEffect(() => {
    setBreakEnabled(breakConfig.enabled);
    setBreakStartHour(String(breakConfig.startHour));
    setBreakEndHour(String(breakConfig.endHour));
  }, [breakConfig.enabled, breakConfig.startHour, breakConfig.endHour]);

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);
  const currentRangeLabel = ordered.length ? `${ordered[0].start} - ${ordered[ordered.length - 1].end}` : '-';
  const daysConfig = useMemo(
    () => [
      { day: 1, label: 'Lunes' },
      { day: 2, label: 'Martes' },
      { day: 3, label: 'Miércoles' },
      { day: 4, label: 'Jueves' },
      { day: 5, label: 'Viernes' },
      { day: 6, label: 'Sábado' },
      { day: 0, label: 'Domingo' }
    ],
    []
  );

  const dayRange = useMemo(
    () => ({ start: Number.parseInt(dayStartHour, 10), end: Number.parseInt(dayEndHour, 10) }),
    [dayStartHour, dayEndHour]
  );
  const nightRange = useMemo(
    () => ({ start: Number.parseInt(nightStartHour, 10), end: Number.parseInt(nightEndHour, 10) }),
    [nightStartHour, nightEndHour]
  );

  const rangesOverlap = dayRange.start < nightRange.end && nightRange.start < dayRange.end;
  const coversPlanningWithoutGaps =
    dayRange.start === initialStartHour &&
    nightRange.end === initialEndHour &&
    dayRange.end === nightRange.start &&
    dayRange.end > dayRange.start &&
    nightRange.end > nightRange.start;
  const breakStartOptions = useMemo(
    () => hourOptions.filter((hour) => hour >= initialStartHour && hour < initialEndHour),
    [hourOptions, initialStartHour, initialEndHour]
  );
  const breakEndOptions = useMemo(() => {
    const selectedStart = Number.parseInt(breakStartHour, 10);
    return hourOptions.filter((hour) => hour > selectedStart && hour <= initialEndHour);
  }, [hourOptions, breakStartHour, initialEndHour]);

  useEffect(() => {
    const selectedEnd = Number.parseInt(breakEndHour, 10);
    if (breakEndOptions.some((hour) => hour === selectedEnd)) return;
    const nextEnd = breakEndOptions[0];
    if (nextEnd !== undefined) {
      setBreakEndHour(String(nextEnd));
    }
  }, [breakEndHour, breakEndOptions]);

  const setBoundary = (boundary: number): void => {
    if (boundary <= initialStartHour || boundary >= initialEndHour) {
      toast({ status: 'warning', title: 'Debe quedar al menos 1 hora en Día y 1 hora en Noche.' });
      return;
    }
    setDayStartHour(String(initialStartHour));
    setDayEndHour(String(boundary));
    setNightStartHour(String(boundary));
    setNightEndHour(String(initialEndHour));
  };

  const handleDayClick = (slotStart: number, slotEnd: number, isActive: boolean): void => {
    // Toggle en fila Día: si está activo, lo quita; si está inactivo, lo agrega.
    const nextBoundary = isActive ? slotStart : slotEnd;
    setBoundary(nextBoundary);
  };

  const handleNightClick = (slotStart: number, slotEnd: number, isActive: boolean): void => {
    // Toggle en fila Noche: si está activo, lo quita; si está inactivo, lo agrega.
    const nextBoundary = isActive ? slotEnd : slotStart;
    setBoundary(nextBoundary);
  };

  const handleValidationInput = (day: number, field: 'opening' | 'closing', rawValue: string): void => {
    const parsed = Number.parseInt(rawValue, 10);
    const value = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setLocalValidation((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? { opening: 0, closing: 0 }),
        [field]: value
      }
    }));
  };

  return (
    <Box display="grid" gap={4}>
      <Card>
        <CardBody>
          <Text fontWeight="600" mb={3}>
            Semana de Configuración
          </Text>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Elija aquí la semana a la que se aplicarán los horarios, turnos, refrigerio y validaciones.
          </Text>
          <Box maxW="360px">
            <WeekSelector />
          </Box>
          {currentWeek ? (
            <Text mt={3} fontSize="sm" color={isCurrentWeekValidated ? 'orange.600' : 'gray.600'}>
              Semana seleccionada: {currentWeek.label}
              {isCurrentWeekValidated ? ' (validada, solo lectura)' : ''}
            </Text>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Text fontWeight="600" mb={3}>
            Configuración de Horarios
          </Text>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Define el rango de horas para la semana seleccionada. Se generan bloques de 1 hora automáticamente.
          </Text>
          <HStack mb={4} align="end" spacing={3} flexWrap="wrap">
            <FormControl maxW="220px">
              <FormLabel>Hora inicio</FormLabel>
              <Select value={startHour} onChange={(event) => setStartHour(event.target.value)} isDisabled={!canEdit || isCurrentWeekValidated}>
                {hourOptions.slice(0, 23).map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="220px">
              <FormLabel>Hora fin</FormLabel>
              <Select value={endHour} onChange={(event) => setEndHour(event.target.value)} isDisabled={!canEdit || isCurrentWeekValidated}>
                {hourOptions.slice(1).map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <Button
              colorScheme="blue"
              isDisabled={!canEdit || isCurrentWeekValidated}
              onClick={async () => {
                const result = setPlanningHoursRange(Number.parseInt(startHour, 10), Number.parseInt(endHour, 10));
                if (!result.ok) {
                  toast({ status: 'error', title: result.error ?? 'No se pudo actualizar el rango horario.' });
                  return;
                }
                const persisted = await flushPersistence();
                if (!persisted.ok) {
                  toast({ status: 'error', title: persisted.error ?? 'No se pudo guardar el rango horario en el backend.' });
                  return;
                }
                toast({ status: 'success', title: 'Rango horario actualizado.' });
              }}
            >
              Guardar horarios
            </Button>
          </HStack>
          <Text fontSize="sm" color="gray.600" mb={3}>
            Rango actual: {currentRangeLabel}
          </Text>
          <Box display="flex" gap={2} flexWrap="wrap">
            {ordered.map((slot) => (
              <Badge key={slot.id} px={3} py={1} rounded="md">
                {slot.label}
              </Badge>
            ))}
          </Box>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Text fontWeight="600" mb={3}>
            Configuración de Refrigerio
          </Text>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Define si la semana seleccionada usa refrigerio y en qué horario debe mostrarse en Planificación.
          </Text>
          <Box mb={4}>
            <Checkbox isChecked={breakEnabled} onChange={(event) => setBreakEnabled(event.target.checked)} isDisabled={!canEdit || isCurrentWeekValidated}>
              Considerar refrigerio en esta área
            </Checkbox>
          </Box>
          <HStack mb={4} align="end" spacing={3} flexWrap="wrap">
            <FormControl maxW="220px" isDisabled={!breakEnabled}>
              <FormLabel>Inicio refrigerio</FormLabel>
              <Select value={breakStartHour} onChange={(event) => setBreakStartHour(event.target.value)} isDisabled={!canEdit || !breakEnabled || isCurrentWeekValidated}>
                {breakStartOptions.map((hour) => (
                  <option key={`break-start-${hour}`} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="220px" isDisabled={!breakEnabled}>
              <FormLabel>Fin refrigerio</FormLabel>
              <Select value={breakEndHour} onChange={(event) => setBreakEndHour(event.target.value)} isDisabled={!canEdit || !breakEnabled || isCurrentWeekValidated}>
                {breakEndOptions.map((hour) => (
                  <option key={`break-end-${hour}`} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <Button
              colorScheme="blue"
              isDisabled={!canEdit || isCurrentWeekValidated}
              onClick={async () => {
                const result = setBreakConfig({
                  enabled: breakEnabled,
                  startHour: Number.parseInt(breakStartHour, 10),
                  endHour: Number.parseInt(breakEndHour, 10)
                });
                if (!result.ok) {
                  toast({ status: 'error', title: result.error ?? 'No se pudo actualizar el refrigerio.' });
                  return;
                }
                const persisted = await flushPersistence();
                if (!persisted.ok) {
                  toast({ status: 'error', title: persisted.error ?? 'No se pudo guardar el refrigerio en el backend.' });
                  return;
                }
                toast({ status: 'success', title: 'Refrigerio actualizado.' });
              }}
            >
              Guardar refrigerio
            </Button>
          </HStack>
          <Text fontSize="sm" color="gray.600">
            Estado actual:{' '}
            {breakConfig.enabled
              ? `Con refrigerio (${String(breakConfig.startHour).padStart(2, '0')}:00 - ${String(breakConfig.endHour).padStart(2, '0')}:00)`
              : 'Sin refrigerio'}
          </Text>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Text fontWeight="600" mb={3}>
            Configuración de Turnos
          </Text>
          <Text fontSize="sm" color="gray.600" mb={3}>
            Clic en Día o Noche para mover el corte entre turnos.
          </Text>

          <Box mb={4}>
            <Text fontSize="sm" fontWeight="600" mb={2}>
              Turno Día
            </Text>
            <HStack spacing={2} flexWrap="wrap">
              {orderedHourBlocks.map((slot) => {
                const isActive = slot.start >= dayRange.start && slot.end <= dayRange.end;
                return (
                  <Button
                    key={`day-${slot.id}`}
                    size="sm"
                    colorScheme="teal"
                    variant={isActive ? 'solid' : 'outline'}
                    onClick={() => handleDayClick(slot.start, slot.end, isActive)}
                    isDisabled={!canEdit || isCurrentWeekValidated}
                  >
                    {slot.label}
                  </Button>
                );
              })}
            </HStack>
          </Box>

          <Box mb={4}>
            <Text fontSize="sm" fontWeight="600" mb={2}>
              Turno Noche
            </Text>
            <HStack spacing={2} flexWrap="wrap">
              {orderedHourBlocks.map((slot) => {
                const isActive = slot.start >= nightRange.start && slot.end <= nightRange.end;
                return (
                  <Button
                    key={`night-${slot.id}`}
                    size="sm"
                    colorScheme="orange"
                    variant={isActive ? 'solid' : 'outline'}
                    onClick={() => handleNightClick(slot.start, slot.end, isActive)}
                    isDisabled={!canEdit || isCurrentWeekValidated}
                  >
                    {slot.label}
                  </Button>
                );
              })}
            </HStack>
          </Box>

          <HStack mb={4} align="end" spacing={3} flexWrap="wrap">
            <Button
              colorScheme="blue"
              isDisabled={!canEdit || isCurrentWeekValidated}
              onClick={async () => {
                if (rangesOverlap) {
                  toast({ status: 'error', title: 'Los turnos Día y Noche no deben solaparse.' });
                  return;
                }
                if (!coversPlanningWithoutGaps) {
                  toast({ status: 'error', title: 'Día y Noche deben cubrir todo el rango sin huecos.' });
                  return;
                }
                const result = setShiftRanges({
                  day: {
                    startHour: Number.parseInt(dayStartHour, 10),
                    endHour: Number.parseInt(dayEndHour, 10)
                  },
                  night: {
                    startHour: Number.parseInt(nightStartHour, 10),
                    endHour: Number.parseInt(nightEndHour, 10)
                  }
                });
                if (!result.ok) {
                  toast({ status: 'error', title: result.error ?? 'No se pudo actualizar la configuración de turnos.' });
                  return;
                }
                const persisted = await flushPersistence();
                if (!persisted.ok) {
                  toast({ status: 'error', title: persisted.error ?? 'No se pudo guardar la configuración de turnos en el backend.' });
                  return;
                }
                toast({ status: 'success', title: 'Turnos actualizados.' });
              }}
            >
              Guardar turnos
            </Button>
          </HStack>

          {rangesOverlap ? (
            <Text fontSize="sm" color="red.500" mb={2}>
              Ajusta los rangos: Día y Noche se están solapando.
            </Text>
          ) : null}
          {!rangesOverlap && !coversPlanningWithoutGaps ? (
            <Text fontSize="sm" color="red.500" mb={2}>
              Deben cubrir continuo todo el rango ({String(initialStartHour).padStart(2, '0')}:00 -{' '}
              {String(initialEndHour).padStart(2, '0')}:00) sin horas libres.
            </Text>
          ) : null}

          <Text fontSize="sm" color="gray.600">
            Selección actual: Día {String(dayRange.start).padStart(2, '0')}:00 - {String(dayRange.end).padStart(2, '0')}:00 | Noche{' '}
            {String(nightRange.start).padStart(2, '0')}:00 - {String(nightRange.end).padStart(2, '0')}:00
          </Text>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Text fontWeight="600" mb={3}>
            Configuración de Validaciones
          </Text>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Defina la dotación mínima de apertura y cierre por día para la semana seleccionada.
          </Text>
          <Box overflowX="auto">
            <Table size="sm" minW="640px">
              <Thead>
                <Tr>
                  <Th>Día</Th>
                  <Th>Requerimiento apertura</Th>
                  <Th>Requerimiento cierre</Th>
                </Tr>
              </Thead>
              <Tbody>
                {daysConfig.map(({ day, label }) => (
                  <Tr key={day}>
                    <Td fontWeight="600">{label}</Td>
                    <Td>
                      <Input
                        type="number"
                        min={0}
                        maxW="120px"
                        value={String(localValidation[day]?.opening ?? 0)}
                        onChange={(event) => handleValidationInput(day, 'opening', event.target.value)}
                        isDisabled={!canEdit || isCurrentWeekValidated}
                      />
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        min={0}
                        maxW="120px"
                        value={String(localValidation[day]?.closing ?? 0)}
                        onChange={(event) => handleValidationInput(day, 'closing', event.target.value)}
                        isDisabled={!canEdit || isCurrentWeekValidated}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          <HStack mt={4}>
            <Button
              colorScheme="blue"
              isDisabled={!canEdit || isCurrentWeekValidated}
              isLoading={isSavingValidation}
              loadingText="Guardando"
              onClick={async () => {
                setIsSavingValidation(true);
                const result = setValidationRequirements(localValidation);
                if (!result.ok) {
                  setIsSavingValidation(false);
                  toast({ status: 'error', title: result.error ?? 'No se pudo guardar la configuración de validaciones.' });
                  return;
                }
                const persisted = await flushPersistence();
                if (!persisted.ok) {
                  setIsSavingValidation(false);
                  toast({
                    status: 'error',
                    title: persisted.error ?? 'No se pudo guardar la configuración de validaciones en el backend.'
                  });
                  return;
                }
                setIsSavingValidation(false);
                toast({ status: 'success', title: 'Validaciones actualizadas.' });
              }}
            >
              Guardar validaciones
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {currentWeek ? <Text fontSize="sm" color="gray.500">Los cambios se guardan solo para esa semana seleccionada.</Text> : null}
    </Box>
  );
}
