import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useMemo, useRef, useState } from 'react';
import { EmployeeFormModal } from '../components/EmployeeFormModal';
import { useAppStore } from '../store/useAppStore';
import type { Employee } from '../types';
import { downloadEmployeeWeekPdf } from '../utils/pdf';
import { getRestDayLabel } from '../utils/weekdays';

function getContractTypeLabel(value: Employee['contractType']): string {
  if (value === 'part-time') return 'Part Time';
  if (value === 'full-time') return 'Full Time';
  return '-';
}

function getShiftTypeLabel(value: Employee['shiftType']): string {
  if (value === 'day') return 'Día';
  if (value === 'night') return 'Noche';
  return '-';
}

function getWeeklyHoursLabel(value: Employee['weeklyHours']): string {
  return value === undefined ? '-' : `${value.toFixed(1)} h`;
}

export function EmployeesPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: openDeleteDialog,
    onClose: closeDeleteDialog
  } = useDisclosure();
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const timeSlots = useAppStore((state) => state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const upsertEmployee = useAppStore((state) => state.upsertEmployee);
  const deleteEmployee = useAppStore((state) => state.deleteEmployee);

  const [editing, setEditing] = useState<Employee | undefined>(undefined);
  const [exportingEmployeeId, setExportingEmployeeId] = useState<string | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | undefined>(undefined);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
  const currentWeek = useMemo(() => weeks.find((week) => week.id === currentWeekId), [weeks, currentWeekId]);
  const currentWeekPlan = currentWeek ? weekPlans[currentWeek.id] : undefined;

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

  const handleDeleteClick = (employee: Employee): void => {
    setEmployeeToDelete(employee);
    openDeleteDialog();
  };

  const handleConfirmDelete = (): void => {
    if (!employeeToDelete) return;
    deleteEmployee(employeeToDelete.id);
    toast({
      status: 'success',
      title: `${employeeToDelete.name} fue eliminado permanentemente.`
    });
    setEmployeeToDelete(undefined);
    closeDeleteDialog();
  };

  return (
    <Box>
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Badge px={3} py={1} rounded="md" colorScheme="blue">
              Total Colaboradores: {employees.length}
            </Badge>
            <Button
              colorScheme="blue"
              onClick={() => {
                setEditing(undefined);
                onOpen();
              }}
            >
              Nuevo Colaborador
            </Button>
          </HStack>
          <Table size="sm" bg="white">
            <Thead>
              <Tr>
                <Th>Nombre</Th>
                <Th>Activo</Th>
                <Th>Horas semanales</Th>
                <Th>Tipo contrato</Th>
                <Th>Turno</Th>
                <Th>Día descanso</Th>
                <Th>Zona asignada</Th>
                <Th>Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {employees.map((employee) => (
                <Tr key={employee.id}>
                  <Td>{employee.name}</Td>
                  <Td>
                    <Badge colorScheme={employee.active ? 'green' : 'gray'}>{employee.active ? 'Sí' : 'No'}</Badge>
                  </Td>
                  <Td>{getWeeklyHoursLabel(employee.weeklyHours)}</Td>
                  <Td>{getContractTypeLabel(employee.contractType)}</Td>
                  <Td>{getShiftTypeLabel(employee.shiftType)}</Td>
                  <Td>{getRestDayLabel(employee.restDay)}</Td>
                  <Td>{employee.mainRoleId ? roleById.get(employee.mainRoleId) ?? '-' : '-'}</Td>
                  <Td>
                    <HStack>
                      <Button
                        size="xs"
                        onClick={() => {
                          setEditing(employee);
                          onOpen();
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="xs" colorScheme="red" variant="outline" onClick={() => handleDeleteClick(employee)}>
                        Eliminar
                      </Button>
                      <Button
                        size="xs"
                        colorScheme="teal"
                        variant="outline"
                        onClick={() => handleDownloadPdf(employee)}
                        isLoading={exportingEmployeeId === employee.id}
                      >
                        PDF
                      </Button>
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

      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelDeleteRef}
        onClose={() => {
          setEmployeeToDelete(undefined);
          closeDeleteDialog();
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Confirmar eliminación
            </AlertDialogHeader>
            <AlertDialogBody>
              ¿Estás seguro? Esta acción eliminará a {employeeToDelete?.name ?? 'este colaborador'} de forma
              permanente.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelDeleteRef}
                onClick={() => {
                  setEmployeeToDelete(undefined);
                  closeDeleteDialog();
                }}
              >
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={handleConfirmDelete} ml={3}>
                Eliminar permanentemente
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
