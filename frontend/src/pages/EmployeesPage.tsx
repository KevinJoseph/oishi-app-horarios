import {
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
import { useMemo, useState } from 'react';
import { EmployeeFormModal } from '../components/EmployeeFormModal';
import { useAppStore } from '../store/useAppStore';
import type { Employee } from '../types';
import { downloadEmployeeWeekPdf } from '../utils/pdf';

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
  const toggleEmployeeActive = useAppStore((state) => state.toggleEmployeeActive);

  const [editing, setEditing] = useState<Employee | undefined>(undefined);
  const [exportingEmployeeId, setExportingEmployeeId] = useState<string | null>(null);
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

  return (
    <Box>
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Badge px={3} py={1} rounded="md" colorScheme="blue">
              Total empleados: {employees.length}
            </Badge>
            <Button
              colorScheme="blue"
              onClick={() => {
                setEditing(undefined);
                onOpen();
              }}
            >
              Nuevo Empleado
            </Button>
          </HStack>
          <Table size="sm" bg="white">
            <Thead>
              <Tr>
                <Th>Nombre</Th>
                <Th>Activo</Th>
                <Th>Horas semanales</Th>
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
                  <Td>{(employee.weeklyHours ?? 40).toFixed(1)} h</Td>
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
                      <Button size="xs" variant="outline" onClick={() => toggleEmployeeActive(employee.id)}>
                        {employee.active ? 'Desactivar' : 'Activar'}
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
    </Box>
  );
}
