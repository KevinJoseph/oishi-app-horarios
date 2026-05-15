import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { fetchGeoVictoriaEmployeesAll, type GeoVictoriaEmployee } from '../api/plannerApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  companyLabel: string | null;
}

export function GeoVictoriaUsersViewModal({ isOpen, onClose, companyId, companyLabel }: Props): JSX.Element {
  const toast = useToast();
  const [users, setUsers] = useState<GeoVictoriaEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setLoading(true);
    fetchGeoVictoriaEmployeesAll(companyId ?? undefined)
      .then((data) => setUsers(data))
      .catch((err: unknown) => {
        toast({
          status: 'error',
          title: err instanceof Error ? err.message : 'No se pudo obtener la lista de GeoVictoria.'
        });
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, companyId, toast]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.Identifier ?? '').toLowerCase().includes(term) ||
        (u.Name ?? '').toLowerCase().includes(term) ||
        (u.LastName ?? '').toLowerCase().includes(term) ||
        (u.GroupDescription ?? '').toLowerCase().includes(term)
    );
  }, [users, search]);

  const enabledCount = useMemo(() => users.filter((u) => u.Enabled === '1').length, [users]);
  const disabledCount = users.length - enabledCount;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack justify="space-between" flexWrap="wrap" gap={3}>
            <Text>Colaborador en GeoVictoria{companyLabel ? ` - ${companyLabel}` : ''}</Text>
            <HStack gap={2}>
              <Badge colorScheme="blue">Total: {users.length}</Badge>
              <Badge colorScheme="green">Activos: {enabledCount}</Badge>
              <Badge colorScheme="gray">Inactivos: {disabledCount}</Badge>
            </HStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <InputGroup mb={3}>
            <InputLeftElement pointerEvents="none">
              <FiSearch color="var(--chakra-colors-gray-400)" />
            </InputLeftElement>
            <Input
              placeholder="Buscar por documento, nombre, apellido o grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          {loading ? (
            <Box py={10} textAlign="center">
              <Spinner />
            </Box>
          ) : filtered.length === 0 ? (
            <Box py={10} textAlign="center">
              <Text color="gray.500">Sin resultados.</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Identifier</Th>
                    <Th>Name</Th>
                    <Th>LastName</Th>
                    <Th>Estado Geo</Th>
                    <Th>GroupDescription</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filtered.map((u) => (
                    <Tr key={u.Id || `${u.Identifier}-${u.Name}`}>
                      <Td>{u.Identifier || '-'}</Td>
                      <Td>{u.Name || '-'}</Td>
                      <Td>{u.LastName || '-'}</Td>
                      <Td>
                        <Badge colorScheme={u.Enabled === '1' ? 'green' : 'gray'}>
                          {u.Enabled === '1' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </Td>
                      <Td>{u.GroupDescription || '-'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
