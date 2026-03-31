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
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/http';
import { createUser, deleteUser, fetchUsers, updateUser } from '../api/usersApi';
import { fetchGeoVictoriaCompanies, type GeoVictoriaCompany } from '../api/plannerApi';
import { UserFormModal } from '../components/UserFormModal';
import { useAuthStore } from '../store/useAuthStore';
import type { AppUser } from '../types/auth';

function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeUser(user: Partial<AppUser>): AppUser {
  const normalizedRole =
    user.role === 'administrador' || user.role === 'supervisor' || user.role === 'lector' ? user.role : 'lector';

  return {
    id: safeText(user.id, ''),
    username: safeText(user.username, ''),
    name: safeText(user.name, 'Sin nombre'),
    role: normalizedRole,
    companyId: typeof user.companyId === 'string' ? user.companyId : null,
    companyLabel: typeof user.companyLabel === 'string' ? user.companyLabel : null,
    createdAt: safeText(user.createdAt, new Date(0).toISOString()),
    updatedAt: safeText(user.updatedAt, new Date(0).toISOString())
  };
}

export function UsersPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const currentUser = useAuthStore((state) => state.currentUser);
  const canManageUsers = currentUser?.role === 'administrador';

  if (!canManageUsers) {
    return <Navigate to="/planning" replace />;
  }

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<GeoVictoriaCompany[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | undefined>(undefined);

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await fetchUsers();
      setUsers(result.map((user) => normalizeUser(user)));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No se pudo cargar usuarios.';
      toast({ status: 'error', title: message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    fetchGeoVictoriaCompanies()
      .then((result) => setCompanies(result.filter((company) => company.alias.trim().toLowerCase() !== 'recibo')))
      .catch(() => setCompanies([]));
  }, []);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return a.username.localeCompare(b.username);
      }),
    [users]
  );

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
          <HStack justify="space-between" flexWrap="wrap" gap={4}>
            <HStack>
              <Badge px={3} py={1} rounded="md" colorScheme="blue" variant="subtle">
                Total usuarios: {users.length}
              </Badge>
              {!canManageUsers ? (
                <Badge px={3} py={1} rounded="md" colorScheme="gray" variant="subtle">
                  Modo lectura
                </Badge>
              ) : null}
            </HStack>
            <Button
              onClick={() => {
                setEditingUser(undefined);
                onOpen();
              }}
              isDisabled={!canManageUsers}
            >
              Nuevo usuario
            </Button>
          </HStack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Box overflowX="auto">
            <Table size="sm" minW="760px">
              <Thead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>Usuario</Th>
                  <Th>Perfil</Th>
                  <Th>Empresa</Th>
                  <Th>Creado</Th>
                  <Th>Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sortedUsers.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      {user.name}
                      {currentUser?.id === user.id ? (
                        <Text as="span" color="gray.500" fontSize="xs" ml={2}>
                          (Tú)
                        </Text>
                      ) : null}
                    </Td>
                    <Td>{user.username}</Td>
                    <Td>
                      <Badge colorScheme={user.role === 'administrador' ? 'green' : user.role === 'supervisor' ? 'blue' : 'gray'}>
                        {user.role === 'administrador' ? 'Administrador' : user.role === 'supervisor' ? 'Supervisor' : 'Lector'}
                      </Badge>
                    </Td>
                    <Td>{user.companyLabel ?? 'Todas'}</Td>
                    <Td>{new Date(user.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <HStack>
                        <Tooltip label="Editar" hasArrow>
                          <IconButton
                            aria-label="Editar usuario"
                            size="xs"
                            variant="outline"
                            icon={<FiEdit2 />}
                            isDisabled={!canManageUsers}
                            onClick={() => {
                              setEditingUser(user);
                              onOpen();
                            }}
                          />
                        </Tooltip>
                        <Tooltip label="Eliminar" hasArrow>
                          <IconButton
                            aria-label="Eliminar usuario"
                            size="xs"
                            variant="outline"
                            colorScheme="red"
                            icon={<FiTrash2 />}
                            isDisabled={!canManageUsers || currentUser?.id === user.id}
                            onClick={async () => {
                              try {
                                await deleteUser(user.id);
                                toast({ status: 'success', title: 'Usuario eliminado.' });
                                await loadUsers();
                              } catch (error) {
                                const message = error instanceof ApiError ? error.message : 'No se pudo eliminar usuario.';
                                toast({ status: 'error', title: message });
                              }
                            }}
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          {loading ? (
            <Text color="gray.500" mt={3} fontSize="sm">
              Cargando usuarios...
            </Text>
          ) : null}
        </CardBody>
      </Card>

      <UserFormModal
        isOpen={isOpen}
        onClose={onClose}
        editingUser={editingUser}
        companies={companies}
        onSubmit={async (payload) => {
          try {
            if (editingUser) {
              await updateUser(editingUser.id, payload);
              toast({ status: 'success', title: 'Usuario actualizado.' });
            } else {
              if (!payload.password) {
                toast({ status: 'error', title: 'La contraseña es obligatoria.' });
                return;
              }
              await createUser({
                name: payload.name,
                username: payload.username,
                role: payload.role,
                companyId: payload.companyId,
                password: payload.password
              });
              toast({ status: 'success', title: 'Usuario creado.' });
            }

            await loadUsers();
          } catch (error) {
            const message = error instanceof ApiError ? error.message : 'No se pudo guardar usuario.';
            toast({ status: 'error', title: message });
            throw error;
          }
        }}
      />
    </Box>
  );
}
