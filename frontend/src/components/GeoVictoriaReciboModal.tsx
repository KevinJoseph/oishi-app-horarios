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
import type { GeoVictoriaCompany } from '../api/plannerApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentAreaId: AreaId;
  selectedCompany: GeoVictoriaCompany | null;
}

export function GeoVictoriaReciboModal({
  isOpen,
  onClose,
  currentAreaId,
  selectedCompany
}: Props): JSX.Element {
  const toast = useToast();
  const employees = useAppStore((state) => state.employees);
  const batchUpsertEmployees = useAppStore((state) => state.batchUpsertEmployees);
  const flushPersistence = useAppStore((state) => state.flushPersistence);

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

  const existingEmployeeForUser = (user: GeoVictoriaEmployee): Employee | undefined => {
    const doc = user.Identifier?.trim();
    return doc ? employees.find((e) => e.identityDocument?.trim() === doc) : undefined;
  };

  const alreadyExistsInSelectedCompany = (user: GeoVictoriaEmployee): boolean => {
    const existing = existingEmployeeForUser(user);
    return (
      !!existing &&
      !!selectedCompany &&
      (existing.moduleCompanyId ?? existing.companyId) === selectedCompany.companyId
    );
  };

  const handleImport = async (): Promise<void> => {
    if (selected.size === 0) return;
    if (!selectedCompany) {
      toast({
        status: 'warning',
        title: 'Selecciona una empresa arriba antes de importar colaboradores por Recibo.'
      });
      return;
    }
    setImporting(true);

    const toImport = users.filter((u) => selected.has(u.Id));
    let created = 0;
    let updated = 0;
    const toUpsert: Employee[] = [];
    const reciboCompany = users.length > 0
      ? {
          alias: 'Recibo',
          name: 'OISHI RESTAURANTE(Recibo)',
          companyId: '2a8M03DV5w6g5gBak-4uA',
          ruc: '20230809234717'
        }
      : null;

    for (const user of toImport) {
      const fullName = `${user.Name} ${user.LastName}`.trim();
      const doc = user.Identifier?.trim() || undefined;
      const existing = existingEmployeeForUser(user);
      if (existing) {
        toUpsert.push({
          ...existing,
          name: fullName,
          phone: user.Phone || existing.phone,
          moduleCompanyAlias: selectedCompany.alias,
          moduleCompanyName: selectedCompany.name,
          moduleCompanyId: selectedCompany.companyId,
          moduleCompanyRuc: selectedCompany.ruc,
          companyAlias: reciboCompany?.alias ?? existing.companyAlias,
          companyName: reciboCompany?.name ?? existing.companyName,
          companyId: reciboCompany?.companyId ?? existing.companyId,
          companyRuc: reciboCompany?.ruc ?? existing.companyRuc,
          geoVictoriaGroupName: user.GroupDescription || existing.geoVictoriaGroupName,
          geoVictoriaCostCenterCode: user.CostCenterCode || existing.geoVictoriaCostCenterCode,
          groupDescription: user.GroupDescription || existing.groupDescription,
          positionDescription: user.PositionDescription || existing.positionDescription,
          areaId: currentAreaId
        });
        updated++;
      } else {
        toUpsert.push({
          id: `geo-recibo-${user.Id}`,
          name: fullName,
          identityDocument: doc,
          phone: user.Phone || undefined,
          moduleCompanyAlias: selectedCompany.alias,
          moduleCompanyName: selectedCompany.name,
          moduleCompanyId: selectedCompany.companyId,
          moduleCompanyRuc: selectedCompany.ruc,
          companyAlias: reciboCompany?.alias,
          companyName: reciboCompany?.name,
          companyId: reciboCompany?.companyId,
          companyRuc: reciboCompany?.ruc,
          geoVictoriaGroupName: user.GroupDescription || undefined,
          geoVictoriaCostCenterCode: user.CostCenterCode || undefined,
          groupDescription: user.GroupDescription || undefined,
          positionDescription: user.PositionDescription || undefined,
          active: true,
          areaId: currentAreaId
        });
        created++;
      }
    }

    batchUpsertEmployees(toUpsert);

    const persistence = await flushPersistence();
    if (!persistence.ok) {
      toast({
        status: 'error',
        title: persistence.error ?? 'No se pudo guardar la importación en el servidor.'
      });
      setImporting(false);
      return;
    }

    toast({
      status: 'success',
      title: `Importación completada en ${selectedCompany.name}: ${created} nuevos, ${updated} actualizados.`
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
          {selectedCompany ? (
            <Badge ml={3} colorScheme="blue" fontSize="sm">
              Destino: {selectedCompany.name}
            </Badge>
          ) : (
            <Badge ml={3} colorScheme="orange" fontSize="sm">
              Selecciona una empresa
            </Badge>
          )}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          {!selectedCompany ? (
            <Box mb={4} rounded="md" bg="orange.50" borderWidth="1px" borderColor="orange.200" px={4} py={3}>
              <Text color="orange.700" fontSize="sm">
                Debes elegir una empresa en la parte superior para agregar los colaboradores de Recibo a ese módulo.
              </Text>
            </Box>
          ) : null}
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
                    const existing = existingEmployeeForUser(user);
                    const exists = alreadyExistsInSelectedCompany(user);
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
                          ) : existing ? (
                            <Badge colorScheme="orange" variant="subtle">Se reasignará</Badge>
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
              isDisabled={selected.size === 0 || !selectedCompany}
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
