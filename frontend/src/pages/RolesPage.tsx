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
import { useAuthStore } from '../store/useAuthStore';
import type { Role } from '../types';

export function RolesPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const allRoles = useAppStore((state) => state.roles);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const upsertRole = useAppStore((state) => state.upsertRole);
  const deleteRole = useAppStore((state) => state.deleteRole);
  const flushPersistence = useAppStore((state) => state.flushPersistence);
  const currentUser = useAuthStore((state) => state.currentUser);
  const canEdit =
    currentUser?.role === 'super_administrador' || currentUser?.role === 'administrador' || currentUser?.role === 'supervisor';
  const roles = allRoles.filter((role) => (role.areaId ?? 'salon') === currentAreaId);

  const [editing, setEditing] = useState<Role | undefined>(undefined);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const handleSaveRole = async (role: Role): Promise<{ ok: boolean; error?: string }> => {
    if (!canEdit) {
      return { ok: false, error: 'Tu perfil es solo de visualización.' };
    }

    setIsSavingRole(true);
    const result = upsertRole(role);
    if (!result.ok) {
      toast({ status: 'error', title: result.error ?? 'No se pudo guardar la zona.' });
      setIsSavingRole(false);
      return result;
    }

    const persisted = await flushPersistence();
    setIsSavingRole(false);
    if (!persisted.ok) {
      toast({ status: 'error', title: persisted.error ?? 'No se pudo guardar la zona en el backend.' });
      return { ok: false, error: persisted.error ?? 'No se pudo guardar la zona en el backend.' };
    }

    toast({ status: 'success', title: editing ? 'Zona actualizada.' : 'Zona creada.' });
    return result;
  };

  const handleDeleteRole = async (roleId: string): Promise<void> => {
    if (!canEdit || deletingRoleId) return;

    setDeletingRoleId(roleId);
    toast({
      id: `role-delete-${roleId}`,
      status: 'info',
      title: 'Guardando zona...',
      duration: null,
      isClosable: false
    });

    try {
      deleteRole(roleId);
      const persisted = await flushPersistence();
      toast.close(`role-delete-${roleId}`);
      if (!persisted.ok) {
        toast({ status: 'error', title: persisted.error ?? 'No se pudo eliminar la zona en el backend.' });
        return;
      }
      toast({ status: 'success', title: 'Zona eliminada.' });
    } finally {
      toast.close(`role-delete-${roleId}`);
      setDeletingRoleId(null);
    }
  };

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
              isDisabled={!canEdit}
            >
              Nueva Zona
            </Button>
          </HStack>
          <Box overflowX="auto">
            <Table size="sm" bg="white" minW="700px">
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
                            isDisabled={!canEdit}
                          />
                        </Tooltip>
                        <Tooltip label="Eliminar" hasArrow>
                          <IconButton
                            aria-label="Eliminar zona"
                            size="xs"
                            variant="outline"
                            colorScheme="brand"
                            icon={<FiTrash2 />}
                            onClick={() => void handleDeleteRole(role.id)}
                            isDisabled={!canEdit || deletingRoleId === role.id}
                            isLoading={deletingRoleId === role.id}
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      <RoleFormModal
        isOpen={isOpen}
        onClose={onClose}
        editing={editing}
        onSave={handleSaveRole}
        isSaving={isSavingRole}
      />
    </Box>
  );
}
