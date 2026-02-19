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
  const planningHourOptions = useMemo(
    () => Array.from({ length: Math.max(0, initialEndHour - initialStartHour + 1) }, (_, i) => initialStartHour + i),
    [initialStartHour, initialEndHour]
  );
  const currentRangeLabel = ordered.length ? `${ordered[0].start} - ${ordered[ordered.length - 1].end}` : '-';
  const shiftRangeLabel = `Día: ${String(shiftRanges.day.startHour).padStart(2, '0')}:00 - ${String(
    shiftRanges.day.endHour
  ).padStart(2, '0')}:00 | Noche: ${String(shiftRanges.night.startHour).padStart(2, '0')}:00 - ${String(
    shiftRanges.night.endHour
  ).padStart(2, '0')}:00`;

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
                  toast({
                    status: 'error',
                    title: result.error ?? 'No se pudo actualizar el rango horario.'
                  });
                  return;
                }
                toast({
                  status: 'success',
                  title: 'Rango horario actualizado.'
                });
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
          <HStack mb={4} align="end" spacing={3} flexWrap="wrap">
            <FormControl maxW="180px">
              <FormLabel>Turno Día: inicio</FormLabel>
              <Select value={dayStartHour} onChange={(event) => setDayStartHour(event.target.value)}>
                {planningHourOptions.slice(0, -1).map((hour) => (
                  <option key={`day-start-${hour}`} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="180px">
              <FormLabel>Turno Día: fin</FormLabel>
              <Select value={dayEndHour} onChange={(event) => setDayEndHour(event.target.value)}>
                {planningHourOptions.slice(1).map((hour) => (
                  <option key={`day-end-${hour}`} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="180px">
              <FormLabel>Turno Noche: inicio</FormLabel>
              <Select value={nightStartHour} onChange={(event) => setNightStartHour(event.target.value)}>
                {planningHourOptions.slice(0, -1).map((hour) => (
                  <option key={`night-start-${hour}`} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="180px">
              <FormLabel>Turno Noche: fin</FormLabel>
              <Select value={nightEndHour} onChange={(event) => setNightEndHour(event.target.value)}>
                {planningHourOptions.slice(1).map((hour) => (
                  <option key={`night-end-${hour}`} value={hour}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </Select>
            </FormControl>
            <Button
              colorScheme="blue"
              onClick={() => {
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
                  toast({
                    status: 'error',
                    title: result.error ?? 'No se pudo actualizar la configuración de turnos.'
                  });
                  return;
                }
                toast({
                  status: 'success',
                  title: 'Turnos actualizados.'
                });
              }}
            >
              Guardar turnos
            </Button>
          </HStack>
          <Text fontSize="sm" color="gray.600">
            {shiftRangeLabel}
          </Text>
        </CardBody>
      </Card>
    </Box>
  );
}
