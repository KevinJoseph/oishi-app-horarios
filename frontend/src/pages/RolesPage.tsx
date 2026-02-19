import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  IconButton,
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
import { useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { RoleFormModal } from '../components/RoleFormModal';
import { useAppStore } from '../store/useAppStore';
import type { Role } from '../types';

export function RolesPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const roles = useAppStore((state) => state.roles);
  const upsertRole = useAppStore((state) => state.upsertRole);
  const deleteRole = useAppStore((state) => state.deleteRole);

  const [editing, setEditing] = useState<Role | undefined>(undefined);

  return (
    <Box>
      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Badge px={3} py={1} rounded="md" colorScheme="blue">
              Total de Zonas: {roles.length}
            </Badge>
            <Button
              colorScheme="blue"
              onClick={() => {
                setEditing(undefined);
                onOpen();
              }}
            >
              Nueva Zona
            </Button>
          </HStack>
          <Table size="sm" bg="white">
            <Thead>
              <Tr>
                <Th>Color</Th>
                <Th>Nombre</Th>
                <Th>Códigos válidos</Th>
                <Th>Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {roles.map((role) => (
                <Tr key={role.id}>
                  <Td>
                    <Box w={5} h={5} rounded="md" bg={role.colorHex} borderWidth="1px" />
                  </Td>
                  <Td>{role.name}</Td>
                  <Td>
                    <HStack spacing={1}>
                      {role.validCodes.map((code) => (
                        <Badge key={code}>{code}</Badge>
                      ))}
                    </HStack>
                  </Td>
                  <Td>
                    <HStack>
                      <Tooltip label="Editar" hasArrow>
                        <IconButton
                          aria-label="Editar zona"
                          size="xs"
                          variant="outline"
                          colorScheme="brand"
                          icon={<FiEdit2 />}
                          onClick={() => {
                            setEditing(role);
                            onOpen();
                          }}
                        />
                      </Tooltip>
                      <Tooltip label="Eliminar" hasArrow>
                        <IconButton
                          aria-label="Eliminar zona"
                          size="xs"
                          variant="outline"
                          colorScheme="brand"
                          icon={<FiTrash2 />}
                          onClick={() => deleteRole(role.id)}
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

      <RoleFormModal
        isOpen={isOpen}
        onClose={onClose}
        editing={editing}
        onSave={(role) => {
          const result = upsertRole(role);
          if (!result.ok) {
            toast({ status: 'error', title: result.error ?? 'No se pudo guardar la zonas.' });
          }
          return result;
        }}
      />
    </Box>
  );
}
