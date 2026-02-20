import { Badge, Box, Button, Card, CardBody, FormControl, FormLabel, HStack, Select, Text, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export function TimeSlotsPage(): JSX.Element {
  const toast = useToast();
  const timeSlots = useAppStore((state) => state.timeSlots);
  const shiftRanges = useAppStore((state) => state.shiftRanges);
  const setPlanningHoursRange = useAppStore((state) => state.setPlanningHoursRange);
  const setShiftRanges = useAppStore((state) => state.setShiftRanges);
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

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);
  const currentRangeLabel = ordered.length ? `${ordered[0].start} - ${ordered[ordered.length - 1].end}` : '-';

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

  return (
    <Box display="grid" gap={4}>
      <Card>
        <CardBody>
          <Text fontWeight="600" mb={3}>
            Configuración de Horarios
          </Text>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Define el rango de horas de planificación. Se generan bloques de 1 hora automáticamente.
          </Text>
          <HStack mb={4} align="end" spacing={3} flexWrap="wrap">
            <FormControl maxW="220px">
              <FormLabel>Hora inicio</FormLabel>
              <Select value={startHour} onChange={(event) => setStartHour(event.target.value)}>
                {hourOptions.slice(0, 23).map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="220px">
              <FormLabel>Hora fin</FormLabel>
              <Select value={endHour} onChange={(event) => setEndHour(event.target.value)}>
                {hourOptions.slice(1).map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <Button
              colorScheme="blue"
              onClick={() => {
                const result = setPlanningHoursRange(Number.parseInt(startHour, 10), Number.parseInt(endHour, 10));
                if (!result.ok) {
                  toast({ status: 'error', title: result.error ?? 'No se pudo actualizar el rango horario.' });
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
              onClick={() => {
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
    </Box>
  );
}
