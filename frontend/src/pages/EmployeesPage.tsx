import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiFileText, FiPower, FiRefreshCw, FiSearch, FiSend, FiTrash2, FiUserCheck } from 'react-icons/fi';
import { EmployeeFormModal } from '../components/EmployeeFormModal';
import { GeoVictoriaReciboModal } from '../components/GeoVictoriaReciboModal';
import { fetchGeoVictoriaCompanies, fetchGeoVictoriaEmployees, type GeoVictoriaCompany, sendEmployeeToGeoVictoria } from '../api/plannerApi';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import type { AreaId, Employee } from '../types';
import { downloadEmployeeWeekPdf } from '../utils/pdf';
import { getRestDayLabel } from '../utils/weekdays';

function getContractTypeLabel(value: Employee['contractType']): string {
  if (value === 'part-time') return 'Part Time';
  if (value === 'full-time') return 'Full Time';
  return 'Sin contrato';
}

function getShiftTypeLabel(value: Employee['shiftType'], contractType: Employee['contractType']): string {
  if (!contractType) return '';
  if (contractType === 'full-time') return 'Día/Noche';
  if (value === 'day') return 'Día';
  if (value === 'night') return 'Noche';
  return '';
}

function getEmployeeRestDayLabel(restDay: Employee['restDay'], contractType: Employee['contractType']): string {
  if (!contractType) return '';
  return getRestDayLabel(restDay);
}

function getWeeklyHoursLabel(value: Employee['weeklyHours']): string {
  return value === undefined ? '-' : `${value.toFixed(1)} h`;
}

function getAreaLabel(value: Employee['areaId']): string {
  if (value === 'cocina') return 'Cocina';
  if (value === 'oficina') return 'Oficina';
  if (value === 'produccion') return 'Producción';
  return 'Salón';
}

export function EmployeesPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isDeleteModalOpen,
    onOpen: openDeleteModal,
    onClose: closeDeleteModal
  } = useDisclosure();
  const {
    isOpen: isReciboModalOpen,
    onOpen: openReciboModal,
    onClose: closeReciboModal
  } = useDisclosure();
  const {
    isOpen: isGeoVictoriaModalOpen,
    onOpen: openGeoVictoriaModal,
    onClose: closeGeoVictoriaModal
  } = useDisclosure();
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const validatedWeekIds = useAppStore((state) => state.validatedWeekIds);
  const weekAuditById = useAppStore((state) => state.weekAuditById);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const upsertEmployee = useAppStore((state) => state.upsertEmployee);
  const batchUpsertEmployees = useAppStore((state) => state.batchUpsertEmployees);
  const deleteEmployee = useAppStore((state) => state.deleteEmployee);
  const currentUser = useAuthStore((state) => state.currentUser);
  const canEdit = currentUser?.role === 'administrador' || currentUser?.role === 'supervisor';

  const [editing, setEditing] = useState<Employee | undefined>(undefined);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeToSend, setEmployeeToSend] = useState<Employee | null>(null);
  const [exportingEmployeeId, setExportingEmployeeId] = useState<string | null>(null);
  const [sendingEmployeeId, setSendingEmployeeId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<GeoVictoriaCompany[]>([]);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const cancelGeoVictoriaRef = useRef<HTMLButtonElement>(null);
  const scopedWeekKey = (areaId: AreaId, weekId: string): string => `${areaId}::${weekId}`;
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);
  const currentWeek = useMemo(
    () => weeks.find((week) => week.startDateISO === currentWeekStartDateISO),
    [weeks, currentWeekStartDateISO]
  );
  const currentScopedWeekId = currentWeek ? scopedWeekKey(currentAreaId, currentWeek.id) : null;
  const currentWeekPlan = currentScopedWeekId ? weekPlans[currentScopedWeekId] : undefined;
  const currentWeekAudit = currentScopedWeekId ? weekAuditById[currentScopedWeekId] : undefined;
  const isCurrentWeekValidated = currentScopedWeekId ? validatedWeekIds.includes(currentScopedWeekId) : false;
  const effectiveWeekConfig = currentScopedWeekId ? weekConfigById[currentScopedWeekId] : undefined;
  const timeSlots = effectiveWeekConfig?.timeSlots ?? areaTimeSlots;
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(term) ||
        (employee.code ?? '').toLowerCase().includes(term) ||
        (employee.identityDocument ?? '').toLowerCase().includes(term)
    );
  }, [employees, search]);

  useEffect(() => {
    if (!canEdit) return;

    fetchGeoVictoriaCompanies()
      .then((items) => setCompanies(items))
      .catch((error) => {
        toast({
          status: 'error',
          title: error instanceof Error ? error.message : 'No se pudo obtener la lista de companies.'
        });
      });
  }, [canEdit, toast]);

  const getEmployeeGeoVictoriaPayload = (
    employee: Employee
  ): { Identifier: string; Email: string; Name: string; LastName: string; CostCenterCode: string } => {
    const firstName = employee.firstName?.trim() ?? '';
    const lastName = employee.lastName?.trim() ?? '';
    const fallbackParts = employee.name.trim().split(/\s+/).filter(Boolean);

    return {
      Identifier: employee.identityDocument?.trim() ?? '',
      Email: employee.email?.trim() ?? '',
      Name: firstName || fallbackParts.slice(0, Math.max(1, fallbackParts.length - 1)).join(' '),
      LastName: lastName || fallbackParts.slice(Math.max(1, fallbackParts.length - 1)).join(' '),
      CostCenterCode: employee.companyId?.trim() ?? ''
    };
  };

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
        weekPlan: currentWeekPlan,
        isValidated: currentScopedWeekId ? validatedWeekIds.includes(currentScopedWeekId) : false,
        validatedByName: currentWeekAudit?.validatedByName ?? null
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

  const handleToggleActive = (employee: Employee): void => {
    if (!canEdit) return;
    const result = upsertEmployee({ ...employee, active: !employee.active });
    if (!result.ok) {
      toast({
        status: 'error',
        title: result.error ?? 'No se pudo actualizar el colaborador.'
      });
      return;
    }
    toast({
      status: 'success',
      title: employee.active ? `${employee.name} fue desactivado.` : `${employee.name} fue activado.`
    });
  };

  const handleDeleteEmployee = (): void => {
    if (!employeeToDelete) return;
    deleteEmployee(employeeToDelete.id);
    toast({
      status: 'success',
      title: `${employeeToDelete.name} fue eliminado permanentemente.`
    });
    setEmployeeToDelete(null);
    closeDeleteModal();
  };

  const handleSyncGeoVictoria = async (): Promise<void> => {
    if (!canEdit) return;
    setIsSyncing(true);
    try {
      const geoUsers = await fetchGeoVictoriaEmployees();
      let created = 0;
      let updated = 0;
      const toUpsert: Employee[] = [];
      for (const user of geoUsers) {
        const fullName = `${user.Name} ${user.LastName}`.trim();
        const doc = user.Identifier?.trim() || undefined;
        const existing = employees.find((e) => doc && e.identityDocument?.trim() === doc);
        if (existing) {
          toUpsert.push({
            ...existing,
            name: fullName,
            firstName: user.Name || existing.firstName,
            lastName: user.LastName || existing.lastName,
            email: user.Email || existing.email,
            phone: user.Phone || existing.phone,
            groupDescription: user.GroupDescription || existing.groupDescription,
            positionDescription: user.PositionDescription || existing.positionDescription
          });
          updated++;
        } else {
          toUpsert.push({
            id: `geo-${user.Id}`,
            name: fullName,
            firstName: user.Name || undefined,
            lastName: user.LastName || undefined,
            identityDocument: doc,
            email: user.Email || undefined,
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
        title: `Sincronización completada: ${created} nuevos, ${updated} actualizados.`
      });
    } catch (error) {
      toast({
        status: 'error',
        title: error instanceof Error ? error.message : 'No se pudo sincronizar con GeoVictoria.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendToGeoVictoria = async (): Promise<void> => {
    if (!canEdit || !employeeToSend) return;

    const payload = getEmployeeGeoVictoriaPayload(employeeToSend);
    if (!payload.Identifier || !payload.Email || !payload.Name || !payload.LastName || !payload.CostCenterCode) {
      toast({
        status: 'error',
        title: 'El colaborador debe tener DNI, email, nombre, apellidos y company para enviarse a GeoVictoria.'
      });
      return;
    }

    setSendingEmployeeId(employeeToSend.id);
    try {
      const response = await sendEmployeeToGeoVictoria(payload);
      toast({
        status: 'success',
        title: response.message || `${employeeToSend.name} fue enviado a GeoVictoria.`
      });
      setEmployeeToSend(null);
      closeGeoVictoriaModal();
    } catch (error) {
      toast({
        status: 'error',
        title: error instanceof Error ? error.message : 'No se pudo enviar el colaborador a GeoVictoria.'
      });
    } finally {
      setSendingEmployeeId(null);
    }
  };

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
          <HStack justify="space-between" flexWrap="wrap" gap={4}>
            <InputGroup maxW={{ base: '100%', md: '520px' }}>
              <InputLeftElement pointerEvents="none">
                <FiSearch color="var(--chakra-colors-gray-400)" />
              </InputLeftElement>
              <Input
                placeholder="Buscar colaborador por nombre..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                h="44px"
                bg="white"
                borderColor="gray.200"
                _focusVisible={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
              />
            </InputGroup>
            <HStack gap={3}>
              <Button
                colorScheme="gray"
                h="44px"
                px={6}
                leftIcon={<FiRefreshCw />}
                onClick={openReciboModal}
                isDisabled={!canEdit}
              >
                Sincronización Recibo
              </Button>
              <Button
                colorScheme="teal"
                h="44px"
                px={6}
                leftIcon={<FiRefreshCw />}
                onClick={handleSyncGeoVictoria}
                isDisabled={!canEdit}
                isLoading={isSyncing}
                loadingText="Sincronizando"
              >
                Sincronizar GeoVictoria
              </Button>
              <Button
                colorScheme="blue"
                h="44px"
                px={6}
                onClick={() => {
                  setEditing(undefined);
                  onOpen();
                }}
                isDisabled={!canEdit}
              >
                Nuevo Colaborador
              </Button>
            </HStack>
          </HStack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
            <Badge px={3} py={1} rounded="md" colorScheme="blue" variant="subtle">
              Total Colaboradores: {employees.length}
            </Badge>
          </HStack>
          <Box overflowX="auto">
            <Table size="sm" bg="white" minW="980px">
              <Thead>
                <Tr>
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th>Documento</Th>
                  <Th>Activo</Th>
                  <Th>Empresa</Th>
                  <Th>Cargo</Th>
                  <Th>Área</Th>
                  <Th>Horas semanales</Th>
                  <Th>Tipo jornada</Th>
                  <Th>Turno</Th>
                  <Th>Día descanso</Th>
                  <Th>Zona asignada</Th>
                  <Th>Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredEmployees.map((employee) => (
                  <Tr key={employee.id}>
                    <Td>{employee.code ?? '-'}</Td>
                    <Td>{employee.name}</Td>
                    <Td>{employee.identityDocument ?? '-'}</Td>
                    <Td>
                      <Badge colorScheme={employee.active ? 'green' : 'gray'}>{employee.active ? 'Sí' : 'No'}</Badge>
                    </Td>
                    <Td>{employee.groupDescription ?? '-'}</Td>
                    <Td>{employee.positionDescription ?? '-'}</Td>
                    <Td>{getAreaLabel(employee.areaId)}</Td>
                    <Td>{employee.contractType ? getWeeklyHoursLabel(employee.weeklyHours) : ''}</Td>
                    <Td>{getContractTypeLabel(employee.contractType)}</Td>
                    <Td>{getShiftTypeLabel(employee.shiftType, employee.contractType)}</Td>
                    <Td>{getEmployeeRestDayLabel(employee.restDay, employee.contractType)}</Td>
                    <Td>{employee.mainRoleId ? roleById.get(employee.mainRoleId) ?? '-' : '-'}</Td>
                    <Td>
                      <HStack>
                        <Tooltip label="Editar" hasArrow>
                          <IconButton
                            aria-label="Editar colaborador"
                            size="xs"
                            variant="outline"
                            colorScheme="brand"
                            icon={<FiEdit2 />}
                            onClick={() => {
                              setEditing(employee);
                              onOpen();
                            }}
                            isDisabled={!canEdit}
                          />
                        </Tooltip>
                        <Tooltip label={employee.active ? 'Desactivar' : 'Activar'} hasArrow>
                          <IconButton
                            aria-label={employee.active ? 'Desactivar colaborador' : 'Activar colaborador'}
                            size="xs"
                            variant="outline"
                            colorScheme="brand"
                            icon={employee.active ? <FiPower /> : <FiUserCheck />}
                            onClick={() => handleToggleActive(employee)}
                            isDisabled={!canEdit}
                          />
                        </Tooltip>
                        <Tooltip label="Eliminar permanentemente" hasArrow>
                          <IconButton
                            aria-label="Eliminar colaborador"
                            size="xs"
                            variant="outline"
                            colorScheme="red"
                            icon={<FiTrash2 />}
                            onClick={() => {
                              if (!canEdit) return;
                              setEmployeeToDelete(employee);
                              openDeleteModal();
                            }}
                            isDisabled={!canEdit}
                          />
                        </Tooltip>
                        <Tooltip label="Exportar PDF" hasArrow>
                          <IconButton
                            aria-label="Exportar PDF"
                            size="xs"
                            variant="outline"
                            colorScheme="brand"
                            icon={<FiFileText />}
                            onClick={() => handleDownloadPdf(employee)}
                            isLoading={exportingEmployeeId === employee.id}
                          />
                        </Tooltip>
                        <Tooltip label="Enviar a GeoVictoria" hasArrow>
                          <IconButton
                            aria-label="Enviar a GeoVictoria"
                            size="xs"
                            variant="outline"
                            colorScheme="teal"
                            icon={<FiSend />}
                            onClick={() => {
                              if (!canEdit) return;
                              setEmployeeToSend(employee);
                              openGeoVictoriaModal();
                            }}
                            isDisabled={!canEdit}
                            isLoading={sendingEmployeeId === employee.id}
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

      <GeoVictoriaReciboModal
        isOpen={isReciboModalOpen}
        onClose={closeReciboModal}
        currentAreaId={currentAreaId}
      />

      <EmployeeFormModal
        isOpen={isOpen}
        onClose={onClose}
        editing={editing}
        roles={roles}
        companies={companies}
        currentAreaId={currentAreaId}
        onSave={(employee) => {
          if (!canEdit) return { ok: false, error: 'No tienes permisos para guardar colaboradores.' };
          return upsertEmployee({
            ...employee,
            areaId: editing ? employee.areaId : currentAreaId
          });
        }}
      />

      <AlertDialog
        isOpen={isDeleteModalOpen}
        leastDestructiveRef={cancelDeleteRef}
        onClose={() => {
          setEmployeeToDelete(null);
          closeDeleteModal();
        }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Eliminar colaborador</AlertDialogHeader>
            <AlertDialogBody>
              ¿Está seguro de eliminar permanentemente a {employeeToDelete?.name ?? 'este colaborador'}?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelDeleteRef}
                variant="ghost"
                onClick={() => {
                  setEmployeeToDelete(null);
                  closeDeleteModal();
                }}
              >
                Cancelar
              </Button>
              <Button colorScheme="red" ml={3} onClick={handleDeleteEmployee}>
                Eliminar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog
        isOpen={isGeoVictoriaModalOpen}
        leastDestructiveRef={cancelGeoVictoriaRef}
        onClose={() => {
          if (sendingEmployeeId) return;
          setEmployeeToSend(null);
          closeGeoVictoriaModal();
        }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Enviar a GeoVictoria</AlertDialogHeader>
            <AlertDialogBody>
              ¿Está seguro de enviar a {employeeToSend?.name ?? 'este colaborador'} a GeoVictoria?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelGeoVictoriaRef}
                variant="ghost"
                onClick={() => {
                  setEmployeeToSend(null);
                  closeGeoVictoriaModal();
                }}
                isDisabled={Boolean(sendingEmployeeId)}
              >
                Cancelar
              </Button>
              <Button
                colorScheme="teal"
                ml={3}
                onClick={handleSendToGeoVictoria}
                isLoading={Boolean(employeeToSend && sendingEmployeeId === employeeToSend.id)}
                loadingText="Enviando"
              >
                Enviar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
