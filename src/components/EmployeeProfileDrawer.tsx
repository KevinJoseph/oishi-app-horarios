import {
  Badge,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Text
} from '@chakra-ui/react';
import type { Employee, Role } from '../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee;
  roles: Role[];
};

export function EmployeeProfileDrawer({ isOpen, onClose, employee, roles }: Props): JSX.Element {
  const role = roles.find((item) => item.id === employee?.mainRoleId);

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Perfil de Empleado</DrawerHeader>
        <DrawerBody>
          {!employee ? (
            <Text color="gray.500">Selecciona un empleado.</Text>
          ) : (
            <Flex direction="column" gap={3}>
              <Text fontWeight="600">{employee.name}</Text>
              <Text fontSize="sm" color="gray.600">
                Teléfono: {employee.phone || '-'}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Estado: {employee.active ? 'Activo' : 'Inactivo'}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Rol principal: {role?.name ?? '-'}
              </Text>
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
