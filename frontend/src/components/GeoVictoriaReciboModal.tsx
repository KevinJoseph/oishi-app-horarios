import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
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
import { useEffect, useState } from 'react';
import { fetchGeoVictoriaReciboEmployees, type GeoVictoriaEmployee } from '../api/plannerApi';
import { useAppStore } from '../store/useAppStore';
import type { AreaId, Employee } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentAreaId: AreaId;
}

export function GeoVictoriaReciboModal({ isOpen, onClose, currentAreaId }: Props): JSX.Element {
  const toast = useToast();
  const employees = useAppStore((state) => state.employees);
  const batchUpsertEmployees = useAppStore((state) => state.batchUpsertEmployees);

  const [users, setUsers] = useState<GeoVictoriaEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setLoading(true);
    fetchGeoVictoriaReciboEmployees()
      .then((data) => setUsers(data))
      .catch((err: unknown) => {
        toast({
          status: 'error',
          title: err instanceof Error ? err.message : 'No se pudo obtener la lista de GeoVictoria Recibo.'
        });
        onClose();
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const allSelected = users.length > 0 && selected.size === users.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = (): void => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.Id)));
    }
  };

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const alreadyExists = (user: GeoVictoriaEmployee): boolean => {
    const doc = user.Identifier?.trim();
    return !!doc && employees.some((e) => e.identityDocument?.trim() === doc);
  };

  const handleImport = (): void => {
    if (selected.size === 0) return;
    setImporting(true);

    const toImport = users.filter((u) => selected.has(u.Id));
    let created = 0;
    let updated = 0;
    const toUpsert: Employee[] = [];

    for (const user of toImport) {
      const fullName = `${user.Name} ${user.LastName}`.trim();
      const doc = user.Identifier?.trim() || undefined;
      const existing = employees.find((e) => doc && e.identityDocument?.trim() === doc);
      if (existing) {
        toUpsert.push({
          ...existing,
          name: fullName,
          phone: user.Phone || existing.phone,
          groupDescription: user.GroupDescription || existing.groupDescription,
          positionDescription: user.PositionDescription || existing.positionDescription
        });
        updated++;
      } else {
        toUpsert.push({
          id: `geo-recibo-${user.Id}`,
          name: fullName,
          identityDocument: doc,
          phone: user.Phone || undefined,
          groupDescription: user.GroupDescription || undefined,
          positionDescription: user.PositionDescription || undefined,
          active: true,
          areaId: currentAreaId
        });
        created++;
      }
    }

    batchUpsertEmployees(toUpsert);
    toast({
      status: 'success',
      title: `Importación completada: ${created} nuevos, ${updated} actualizados.`
    });
    setImporting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Sincronización Recibo — GeoVictoria
          {!loading && users.length > 0 && (
            <Badge ml={3} colorScheme="gray" fontSize="sm">
              {users.length} activos
            </Badge>
          )}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          {loading ? (
            <HStack justify="center" py={10}>
              <Spinner size="lg" color="gray.500" />
              <Text color="gray.500">Cargando colaboradores...</Text>
            </HStack>
          ) : users.length === 0 ? (
            <Text color="gray.500" textAlign="center" py={8}>
              No se encontraron colaboradores activos.
            </Text>
          ) : (
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th w="40px">
                      <Checkbox
                        isChecked={allSelected}
                        isIndeterminate={someSelected}
                        onChange={toggleAll}
                      />
                    </Th>
                    <Th>Nombre</Th>
                    <Th>Documento</Th>
                    <Th>Empresa</Th>
                    <Th>Cargo</Th>
                    <Th>Estado</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {users.map((user) => {
                    const exists = alreadyExists(user);
                    return (
                      <Tr
                        key={user.Id}
                        bg={selected.has(user.Id) ? 'gray.50' : undefined}
                        cursor="pointer"
                        onClick={() => toggle(user.Id)}
                        _hover={{ bg: 'gray.50' }}
                      >
                        <Td onClick={(e) => e.stopPropagation()}>
                          <Checkbox isChecked={selected.has(user.Id)} onChange={() => toggle(user.Id)} />
                        </Td>
                        <Td fontWeight="medium">{`${user.Name} ${user.LastName}`.trim()}</Td>
                        <Td color="gray.600">{user.Identifier || '-'}</Td>
                        <Td color="gray.600">{user.GroupDescription || '-'}</Td>
                        <Td color="gray.600">{user.PositionDescription || '-'}</Td>
                        <Td>
                          {exists ? (
                            <Badge colorScheme="blue" variant="subtle">Ya existe</Badge>
                          ) : (
                            <Badge colorScheme="green" variant="subtle">Nuevo</Badge>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          )}
        </ModalBody>

        <ModalFooter>
          <HStack gap={3}>
            <Text fontSize="sm" color="gray.500">
              {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
            </Text>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              colorScheme="gray"
              isDisabled={selected.size === 0}
              isLoading={importing}
              onClick={handleImport}
            >
              Agregar seleccionados
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
