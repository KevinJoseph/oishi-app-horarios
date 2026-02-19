import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { FiEdit2, FiFileText, FiPower, FiSearch, FiUserCheck } from 'react-icons/fi';
import { EmployeeFormModal } from '../components/EmployeeFormModal';
import { useAppStore } from '../store/useAppStore';
import type { Employee } from '../types';
import { downloadEmployeeWeekPdf } from '../utils/pdf';
import { getRestDayLabel } from '../utils/weekdays';

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

function getEmployeeRestDayLabel(restDay: Employee['restDay'], contractType: Employee['contractType']): string {
  if (!contractType) return '';
  return getRestDayLabel(restDay);
}

function getWeeklyHoursLabel(value: Employee['weeklyHours']): string {
  return value === undefined ? '-' : `${value.toFixed(1)} h`;
}

export function EmployeesPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const timeSlots = useAppStore((state) => state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const upsertEmployee = useAppStore((state) => state.upsertEmployee);

  const [editing, setEditing] = useState<Employee | undefined>(undefined);
  const [exportingEmployeeId, setExportingEmployeeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
  const currentWeek = useMemo(() => weeks.find((week) => week.id === currentWeekId), [weeks, currentWeekId]);
  const currentWeekPlan = currentWeek ? weekPlans[currentWeek.id] : undefined;
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => employee.name.toLowerCase().includes(term));
  }, [employees, search]);

  const handleDownloadPdf = (employee: Employee): void => {
    if (!currentWeek || !currentWeekPlan) {
      toast({
        status: 'warning',
        title: 'No hay planificación guardada para la semana actual.'
      });
      return;
    }

    setExportingEmployeeId(employee.id);
    try {
      downloadEmployeeWeekPdf({
        employee,
        roles,
        timeSlots,
        week: currentWeek,
        weekPlan: currentWeekPlan
      });
      toast({
        status: 'success',
        title: `PDF generado para ${employee.name}.`
      });
    } catch {
      toast({
        status: 'error',
        title: `No se pudo generar el PDF de ${employee.name}.`
      });
    } finally {
      setExportingEmployeeId(null);
    }
  };

  const handleToggleActive = (employee: Employee): void => {
    upsertEmployee({ ...employee, active: !employee.active });
    toast({
      status: 'success',
      title: employee.active ? `${employee.name} fue desactivado.` : `${employee.name} fue activado.`
    });
  };

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
          <HStack justify="space-between" flexWrap="wrap" gap={4}>
            <InputGroup maxW={{ base: '100%', md: '520px' }}>
              <InputLeftElement pointerEvents="none">
                <FiSearch color="var(--chakra-colors-gray-400)" />
              </InputLeftElement>
              <Input
                placeholder="Buscar colaborador por nombre..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                h="44px"
                bg="white"
                borderColor="gray.200"
                _focusVisible={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
              />
            </InputGroup>
            <Button
              colorScheme="blue"
              h="44px"
              px={6}
              onClick={() => {
                setEditing(undefined);
                onOpen();
              }}
            >
              Nuevo Colaborador
            </Button>
          </HStack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
            <Badge px={3} py={1} rounded="md" colorScheme="blue" variant="subtle">
              Total Colaboradores: {employees.length}
            </Badge>
          </HStack>
          <Table size="sm" bg="white">
            <Thead>
              <Tr>
                <Th>Nombre</Th>
                <Th>Activo</Th>
                <Th>Horas semanales</Th>
                <Th>Tipo jornada</Th>
                <Th>Turno</Th>
                <Th>Día descanso</Th>
                <Th>Zona asignada</Th>
                <Th>Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredEmployees.map((employee) => (
                <Tr key={employee.id}>
                  <Td>{employee.name}</Td>
                  <Td>
                    <Badge colorScheme={employee.active ? 'green' : 'gray'}>{employee.active ? 'Sí' : 'No'}</Badge>
                  </Td>
                  <Td>{employee.contractType ? getWeeklyHoursLabel(employee.weeklyHours) : ''}</Td>
                  <Td>{getContractTypeLabel(employee.contractType)}</Td>
                  <Td>{getShiftTypeLabel(employee.shiftType, employee.contractType)}</Td>
                  <Td>{getEmployeeRestDayLabel(employee.restDay, employee.contractType)}</Td>
                  <Td>{employee.mainRoleId ? roleById.get(employee.mainRoleId) ?? '-' : '-'}</Td>
                  <Td>
                    <HStack>
                      <Tooltip label="Editar" hasArrow>
                        <IconButton
                          aria-label="Editar colaborador"
                          size="xs"
                          variant="outline"
                          colorScheme="brand"
                          icon={<FiEdit2 />}
                          onClick={() => {
                            setEditing(employee);
                            onOpen();
                          }}
                        />
                      </Tooltip>
                      <Tooltip label={employee.active ? 'Desactivar' : 'Activar'} hasArrow>
                        <IconButton
                          aria-label={employee.active ? 'Desactivar colaborador' : 'Activar colaborador'}
                          size="xs"
                          variant="outline"
                          colorScheme="brand"
                          icon={employee.active ? <FiPower /> : <FiUserCheck />}
                          onClick={() => handleToggleActive(employee)}
                        />
                      </Tooltip>
                      <Tooltip label="Exportar PDF" hasArrow>
                        <IconButton
                          aria-label="Exportar PDF"
                          size="xs"
                          variant="outline"
                          colorScheme="brand"
                          icon={<FiFileText />}
                          onClick={() => handleDownloadPdf(employee)}
                          isLoading={exportingEmployeeId === employee.id}
                        />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <EmployeeFormModal
        isOpen={isOpen}
        onClose={onClose}
        editing={editing}
        roles={roles}
        onSave={(employee) => {
          upsertEmployee(employee);
        }}
      />
    </Box>
  );
}
