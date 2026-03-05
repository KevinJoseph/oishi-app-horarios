import {
  Badge,
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Progress,
  Text
} from '@chakra-ui/react';
import { useMemo } from 'react';
import type { Employee, Role, TimeSlot, WeekPlan } from '../types';
import { getRestDayLabel } from '../utils/weekdays';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee;
  roles: Role[];
  timeSlots: TimeSlot[];
  weekPlan?: WeekPlan;
};

type RoleSummary = {
  roleId: string;
  roleName: string;
  colorHex: string;
  slots: number;
  hours: number;
};

export function EmployeeProfileDrawer({ isOpen, onClose, employee, roles, timeSlots, weekPlan }: Props): JSX.Element {
  const role = roles.find((item) => item.id === employee?.mainRoleId);
  const roleById = useMemo(() => new Map(roles.map((item) => [item.id, item])), [roles]);
  const slotDurationById = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of timeSlots) {
      map.set(slot.id, getDurationHours(slot.start, slot.end));
    }
    return map;
  }, [timeSlots]);

  const weeklyStats = useMemo(() => {
    if (!employee || !weekPlan) {
      return { assignedHours: 0, assignedSlots: 0, roleSummaries: [] as RoleSummary[] };
    }

    let assignedHours = 0;
    let assignedSlots = 0;
    const perRole = new Map<string, { slots: number; hours: number }>();

    for (const day of weekPlan.days) {
      for (const [slotId, assignmentsByEmployee] of Object.entries(day.assignments)) {
        const assignment = assignmentsByEmployee[employee.id];
        if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') continue;

        const slotHours = slotDurationById.get(slotId) ?? 0;
        assignedSlots += 1;
        assignedHours += slotHours;

        const current = perRole.get(assignment.roleId) ?? { slots: 0, hours: 0 };
        perRole.set(assignment.roleId, {
          slots: current.slots + 1,
          hours: current.hours + slotHours
        });
      }
    }

    const roleSummaries = Array.from(perRole.entries())
      .map(([roleId, values]) => {
        const roleInfo = roleById.get(roleId);
        return {
          roleId,
          roleName: roleInfo?.name ?? 'Zona sin nombre',
          colorHex: roleInfo?.colorHex ?? '#CBD5E0',
          slots: values.slots,
          hours: values.hours
        };
      })
      .sort((a, b) => b.hours - a.hours);

    return { assignedHours, assignedSlots, roleSummaries };
  }, [employee, roleById, slotDurationById, weekPlan]);

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Perfil de Colaborador</DrawerHeader>
        <DrawerBody>
          {!employee ? (
            <Text color="gray.500">Selecciona un Colaborador.</Text>
          ) : (
            <Flex direction="column" gap={3}>
              <Text fontWeight="600">{employee.name}</Text>
              <Text fontSize="sm" color="gray.600">
                Teléfono: {employee.phone || '-'}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Documento de identidad: {employee.identityDocument || '-'}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Estado: {employee.active ? 'Activo' : 'Inactivo'}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Zona asignada: {role?.name ?? '-'}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Tipo de jornada: {getContractTypeLabel(employee.contractType)}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Turno: {getShiftTypeLabel(employee.shiftType, employee.contractType)}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Horas semanales objetivo: {(employee.weeklyHours ?? 0).toFixed(1)} h
              </Text>
              <Text fontSize="sm" color="gray.600">
                Día de descanso: {getRestDayLabelForProfile(employee.restDay, employee.contractType)}
              </Text>
              <Box borderWidth="1px" rounded="md" p={3}>
                <Text fontSize="sm" fontWeight="600">
                  Horas asignadas: {weeklyStats.assignedHours.toFixed(2)} h
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Turnos asignados: {weeklyStats.assignedSlots}
                </Text>
                {weeklyStats.roleSummaries.length ? (
                  <Flex direction="column" gap={2} mt={3}>
                    <Text fontSize="sm" fontWeight="600">
                      Zonas trabajadas
                    </Text>
                    {weeklyStats.roleSummaries.map((item) => {
                      const percentage = weeklyStats.assignedHours
                        ? Math.round((item.hours / weeklyStats.assignedHours) * 100)
                        : 0;
                      return (
                        <Box key={item.roleId}>
                          <HStack justify="space-between" mb={1}>
                            <HStack spacing={2}>
                              <Box w={2.5} h={2.5} rounded="full" bg={item.colorHex} />
                              <Text fontSize="sm">{item.roleName}</Text>
                            </HStack>
                            <Text fontSize="xs" color="gray.600">
                              {item.hours.toFixed(2)} h ({item.slots})
                            </Text>
                          </HStack>
                          <Progress value={percentage} size="xs" rounded="md" />
                        </Box>
                      );
                    })}
                  </Flex>
                ) : (
                  <Text fontSize="sm" color="gray.500" mt={2}>
                    Aun no tiene turnos asignados esta semana.
                  </Text>
                )}
              </Box>
              {employee.notes ? <Text fontSize="sm">Notas: {employee.notes}</Text> : null}
              <Badge w="fit-content" colorScheme={employee.active ? 'green' : 'gray'}>
                {employee.active ? 'Disponible' : 'No disponible'}
              </Badge>
            </Flex>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function getContractTypeLabel(value: Employee['contractType']): string {
  if (value === 'part-time') return 'Part Time';
  if (value === 'full-time') return 'Full Time';
  return 'Sin contrato';
}

function getShiftTypeLabel(value: Employee['shiftType'], contractType: Employee['contractType']): string {
  if (!contractType) return '';
  if (contractType === 'full-time') return 'Día/Noche';
  if (value === 'day') return 'Día';
  if (value === 'night') return 'Noche';
  return '';
}

function getRestDayLabelForProfile(restDay: Employee['restDay'], contractType: Employee['contractType']): string {
  if (!contractType) return '';
  return getRestDayLabel(restDay);
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
