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
  useDisclosure
} from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { EmployeeFormModal } from '../components/EmployeeFormModal';
import { useAppStore } from '../store/useAppStore';
import type { Employee } from '../types';

export function EmployeesPage(): JSX.Element {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const upsertEmployee = useAppStore((state) => state.upsertEmployee);
  const toggleEmployeeActive = useAppStore((state) => state.toggleEmployeeActive);

  const [editing, setEditing] = useState<Employee | undefined>(undefined);
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);

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
                <Th>Rol principal</Th>
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
