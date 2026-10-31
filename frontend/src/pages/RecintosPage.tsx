import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  HStack,
  Input,
  Switch,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteBukRecinto, fetchBukRecintos, saveBukRecinto, type BukRecinto } from '../api/bukApi';
import { fetchGeoVictoriaCompanies, type GeoVictoriaCompany } from '../api/plannerApi';
import { useAuthStore } from '../store/useAuthStore';

type RecintoDraft = { code: string; name: string; attendanceEnabled: boolean };

const EMPTY_DRAFT: RecintoDraft = { code: '', name: '', attendanceEnabled: true };

export function RecintosPage(): JSX.Element {
  const toast = useToast();
  const currentUser = useAuthStore((state) => state.currentUser);
  const canEdit =
    currentUser?.role === 'super_administrador' || currentUser?.role === 'administrador' || currentUser?.role === 'supervisor';

  const [companies, setCompanies] = useState<GeoVictoriaCompany[]>([]);
  const [recintos, setRecintos] = useState<BukRecinto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RecintoDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingCompanyId, setSavingCompanyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyList, recintoList] = await Promise.all([fetchGeoVictoriaCompanies(), fetchBukRecintos()]);
      setCompanies(companyList.filter((company) => company.alias.trim().toLowerCase() !== 'recibo'));
      setRecintos(recintoList);
      setDrafts(
        Object.fromEntries(
          recintoList.map((recinto) => [
            recinto.companyId,
            { code: recinto.code, name: recinto.name, attendanceEnabled: recinto.attendanceEnabled }
          ])
        )
      );
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Error al cargar recintos.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const recintoByCompanyId = useMemo(() => new Map(recintos.map((recinto) => [recinto.companyId, recinto])), [recintos]);

  const updateDraft = (companyId: string, patch: Partial<RecintoDraft>): void => {
    setDrafts((current) => ({ ...current, [companyId]: { ...(current[companyId] ?? EMPTY_DRAFT), ...patch } }));
  };

  const handleSave = async (companyId: string): Promise<void> => {
    const draft = drafts[companyId] ?? EMPTY_DRAFT;
    if (!draft.code.trim() || !draft.name.trim()) {
      toast({ status: 'warning', title: 'Completa el código y el nombre del recinto.' });
      return;
    }
    setSavingCompanyId(companyId);
    try {
      const saved = await saveBukRecinto(companyId, {
        code: draft.code.trim(),
        name: draft.name.trim(),
        attendanceEnabled: draft.attendanceEnabled
      });
      setRecintos((current) => [...current.filter((recinto) => recinto.companyId !== companyId), saved]);
      updateDraft(companyId, { code: saved.code, name: saved.name, attendanceEnabled: saved.attendanceEnabled });
      toast({ status: 'success', title: `Recinto ${saved.code} guardado.` });
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'No se pudo guardar el recinto.' });
    } finally {
      setSavingCompanyId(null);
    }
  };

  const handleRemove = async (companyId: string): Promise<void> => {
    setSavingCompanyId(companyId);
    try {
      await deleteBukRecinto(companyId);
      setRecintos((current) => current.filter((recinto) => recinto.companyId !== companyId));
      setDrafts((current) => ({ ...current, [companyId]: EMPTY_DRAFT }));
      toast({ status: 'success', title: 'Asignación eliminada.' });
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'No se pudo eliminar el recinto.' });
    } finally {
      setSavingCompanyId(null);
    }
  };

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardHeader>
          <VStack align="stretch" spacing={1}>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Recintos BUK
            </Text>
            <Text color="gray.600">
              Asigna a cada empresa el código y nombre de su recinto en BUK. Se usan al exportar la creación de turnos en
              Migrar BUK.
            </Text>
          </VStack>
        </CardHeader>
      </Card>

      <Card>
        <CardBody>
          {loading ? (
            <Text color="gray.500">Cargando...</Text>
          ) : !companies.length ? (
            <Text color="gray.500">No hay empresas configuradas.</Text>
          ) : (
            <Box overflowX="auto">
              <Table size="sm" bg="white" minW="900px">
                <Thead>
                  <Tr>
                    <Th>Empresa</Th>
                    <Th>Código Recinto</Th>
                    <Th>Nombre Recinto</Th>
                    <Th>Habilitado para asistencia</Th>
                    <Th>Estado</Th>
                    <Th>Acción</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {companies.map((company) => {
                    const draft = drafts[company.companyId] ?? EMPTY_DRAFT;
                    const saved = recintoByCompanyId.get(company.companyId);
                    const isDirty =
                      !saved ||
                      saved.code !== draft.code.trim().toUpperCase() ||
                      saved.name !== draft.name.trim() ||
                      saved.attendanceEnabled !== draft.attendanceEnabled;
                    const isSaving = savingCompanyId === company.companyId;
                    return (
                      <Tr key={company.companyId}>
                        <Td>
                          <Text fontWeight="600">{company.alias}</Text>
                          <Text fontSize="xs" color="gray.500">
                            {company.name}
                          </Text>
                        </Td>
                        <Td w="160px">
                          <Input
                            size="sm"
                            value={draft.code}
                            placeholder="OSBC01"
                            isDisabled={!canEdit}
                            onChange={(event) => updateDraft(company.companyId, { code: event.target.value.toUpperCase() })}
                          />
                        </Td>
                        <Td>
                          <Input
                            size="sm"
                            value={draft.name}
                            placeholder="1. Oishi SB Cañete"
                            isDisabled={!canEdit}
                            onChange={(event) => updateDraft(company.companyId, { name: event.target.value })}
                          />
                        </Td>
                        <Td>
                          <Switch
                            isChecked={draft.attendanceEnabled}
                            isDisabled={!canEdit}
                            onChange={(event) => updateDraft(company.companyId, { attendanceEnabled: event.target.checked })}
                          />
                        </Td>
                        <Td>
                          <Badge colorScheme={saved ? 'green' : 'gray'} textTransform="none">
                            {saved ? 'Asignado' : 'Sin asignar'}
                          </Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              size="xs"
                              colorScheme="teal"
                              isDisabled={!canEdit || !isDirty}
                              isLoading={isSaving}
                              onClick={() => handleSave(company.companyId)}
                            >
                              Guardar
                            </Button>
                            {saved ? (
                              <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                isDisabled={!canEdit || isSaving}
                                onClick={() => handleRemove(company.companyId)}
                              >
                                Quitar
                              </Button>
                            ) : null}
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>
    </Box>
  );
}
