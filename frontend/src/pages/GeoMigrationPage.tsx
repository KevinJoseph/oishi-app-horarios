import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalFooter,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  Progress,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { FiEye, FiSend } from 'react-icons/fi';
import {
  addGeoVictoriaOvertime,
  clearGeoVictoriaOvertime,
  fetchMigrationLogs,
  migrateGeoVictoriaPlanning,
  saveMigrationLogs,
  type GeoVictoriaOvertimeClearItem,
  type GeoVictoriaOvertimeItem,
  type GeoVictoriaOvertimeResult,
  type GeoVictoriaPlanningMigrationResult
} from '../api/plannerApi';
import { EmployeeWeekGrid } from '../components/EmployeeWeekGrid';
import { useAuthStore } from '../store/useAuthStore';
import { WeekSelector } from '../components/WeekSelector';
import { isWeekValidatedForCompany, useAppStore } from '../store/useAppStore';
import type { AreaId } from '../types';
import { buildGeoMigrationRows, buildOvertimeRows, minutesToHHMM, type GeoMigrationRow } from '../utils/geovictoriaMigration';

/** Valor de hora extra que existe en GeoVictoria. La plataforma aplica los tramos 25%/35% por día. */
const OVERTIME_VALUE = '25';

function scopedWeekKey(areaId: AreaId, weekId: string): string {
  return `${areaId}::${weekId}`;
}


type GeoMigrationGroup = {
  key: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  companyId: string;
  companyLabel: string;
  userIdentifier: string;
  roleSummary: string;
  canMigrate: boolean;
  warnings: string[];
  rows: GeoMigrationRow[];
};

type StoredMigrationResult = {
  result: GeoVictoriaPlanningMigrationResult;
  migratedAt: string;
  migratedBy: string | null;
};

type OvertimeMigrationSummary = {
  added: number;
  deleted: number;
  failed: number;
  errors: string[];
  resultsByGroupKey: Record<string, GeoVictoriaOvertimeResult[]>;
};

type BatchMigrationProgress = {
  total: number;
  completed: number;
  migrated: number;
  failed: number;
  currentEmployeeName: string | null;
};


function formatMigrationDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function GeoMigrationPage(): JSX.Element {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isConfirmOpen,
    onOpen: openConfirm,
    onClose: closeConfirm
  } = useDisclosure();
  const selectedGeoVictoriaCompanyId = useAuthStore((state) => state.selectedGeoVictoriaCompanyId);
  const currentUser = useAuthStore((state) => state.currentUser);
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const areaBreakConfig = useAppStore((state) => state.breakConfigByArea[state.currentAreaId] ?? state.breakConfig);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const validatedWeekIds = useAppStore((state) => state.validatedWeekIds);

  const currentWeek = useMemo(
    () => weeks.find((week) => week.startDateISO === currentWeekStartDateISO),
    [weeks, currentWeekStartDateISO]
  );
  const currentScopedWeekId = currentWeek ? scopedWeekKey(currentAreaId, currentWeek.id) : null;
  const effectiveWeekConfig = currentScopedWeekId ? weekConfigById[currentScopedWeekId] : undefined;
  const timeSlots = effectiveWeekConfig?.timeSlots?.length ? effectiveWeekConfig.timeSlots : areaTimeSlots;
  const breakConfig = effectiveWeekConfig?.breakConfig ?? areaBreakConfig;
  const weekPlan = currentScopedWeekId ? weekPlans[currentScopedWeekId] : undefined;
  const scopedEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.areaId === currentAreaId &&
          (!selectedGeoVictoriaCompanyId ||
            (employee.companyId ?? '') === selectedGeoVictoriaCompanyId ||
            (employee.companyAlias ?? '').trim().toLowerCase() === 'recibo')
      ),
    [employees, currentAreaId, selectedGeoVictoriaCompanyId]
  );
  const scopedRoles = useMemo(
    () => roles.filter((role) => (role.areaId ?? 'salon') === currentAreaId),
    [roles, currentAreaId]
  );
  const rows = useMemo(
    () => buildGeoMigrationRows(scopedEmployees, scopedRoles, timeSlots, breakConfig, weekPlan),
    [scopedEmployees, scopedRoles, timeSlots, breakConfig, weekPlan]
  );
  const groups = useMemo<GeoMigrationGroup[]>(() => {
    const grouped = new Map<string, GeoMigrationGroup>();

    for (const row of rows) {
      const effectiveCompanyId = row.companyId;
      const effectiveCompanyLabel = row.companyLabel;
      const effectiveWarnings = row.warnings;
      const effectiveCanMigrate = Boolean(effectiveCompanyId) && effectiveWarnings.length === 0;
      const key = `${row.employeeId}:${effectiveCompanyId}:${row.userIdentifier}`;
      const current = grouped.get(key);
      if (current) {
        current.rows.push(row);
        current.canMigrate = current.canMigrate && effectiveCanMigrate;
        current.warnings = Array.from(new Set([...current.warnings, ...effectiveWarnings]));
        continue;
      }

      grouped.set(key, {
        key,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        companyId: effectiveCompanyId,
        companyLabel: effectiveCompanyLabel,
        userIdentifier: row.userIdentifier,
        roleSummary: row.roleName,
        canMigrate: effectiveCanMigrate,
        warnings: [...effectiveWarnings],
        rows: [row]
      });
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => {
          const dateOrder = a.dateISO.localeCompare(b.dateISO);
          if (dateOrder !== 0) return dateOrder;
          return a.startHour.localeCompare(b.startHour);
        }),
        roleSummary: Array.from(new Set(group.rows.map((row) => row.roleName))).join(', ')
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [rows]);

  const migratableKeys = useMemo(() => groups.filter((group) => group.canMigrate).map((group) => group.key), [groups]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migratingKeys, setMigratingKeys] = useState<string[]>([]);
  const [resultByKey, setResultByKey] = useState<Record<string, StoredMigrationResult>>({});
  const [overtimeByGroupKey, setOvertimeByGroupKey] = useState<Record<string, GeoVictoriaOvertimeResult[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<GeoMigrationGroup | null>(null);
  const [pendingMigrationKeys, setPendingMigrationKeys] = useState<string[]>([]);
  const [pendingMigrationLabel, setPendingMigrationLabel] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchMigrationProgress | null>(null);
  const selectedEmployee = useMemo(
    () => scopedEmployees.find((employee) => employee.id === selectedGroup?.employeeId) ?? null,
    [scopedEmployees, selectedGroup]
  );
  const migrationToastId = 'geo-migration-progress';
  const isCurrentWeekValidated = isWeekValidatedForCompany(
    validatedWeekIds,
    currentScopedWeekId,
    selectedGeoVictoriaCompanyId
  );

  const ensureWeekValidated = (): boolean => {
    if (!isCurrentWeekValidated) {
      toast({
        status: 'warning',
        title: 'La semana seleccionada debe estar validada antes de migrar.'
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    setSelectedKeys((current) => current.filter((key) => migratableKeys.includes(key)));
  }, [migratableKeys]);

  useEffect(() => {
    if (!currentScopedWeekId) {
      setResultByKey({});
      setOvertimeByGroupKey({});
      return;
    }

    let cancelled = false;
    fetchMigrationLogs(currentScopedWeekId)
      .then(({ logs }) => {
        if (cancelled) return;
        const next: Record<string, StoredMigrationResult> = {};
        const nextOvertime: Record<string, GeoVictoriaOvertimeResult[]> = {};
        for (const log of logs) {
          for (const result of log.results) {
            const r = result as GeoVictoriaPlanningMigrationResult;
            const rowKey =
              r.assignmentType === 'rest'
                ? `${r.employeeId}:${r.dateISO}:rest`
                : r.assignmentType === 'free'
                  ? `${r.employeeId}:${r.dateISO}:free`
                  : `${r.employeeId}:${r.dateISO}:${r.startHour}:${r.endHour}:${r.breakStartHour ?? ''}:${r.breakEndHour ?? ''}`;
            // Pueden existir varios logs para la misma fila (p. ej. migrada con
            // distinta company/groupKey). Nos quedamos siempre con el resultado
            // mas reciente, sin depender del orden de iteracion.
            const existing = next[rowKey];
            if (!existing || log.migratedAt > existing.migratedAt) {
              next[rowKey] = { result: r, migratedAt: log.migratedAt, migratedBy: log.migratedBy };
            }
          }
          if (log.overtimeResults?.length) {
            nextOvertime[log.groupKey] = log.overtimeResults;
          }
        }
        setResultByKey(next);
        setOvertimeByGroupKey(nextOvertime);
      })
      .catch(() => {
        if (!cancelled) {
          setResultByKey({});
          setOvertimeByGroupKey({});
        }
      });

    return () => { cancelled = true; };
  }, [currentScopedWeekId]);

  const allMigratableSelected = migratableKeys.length > 0 && migratableKeys.every((key) => selectedKeys.includes(key));

  const buildMigrationItems = (group: GeoMigrationGroup) =>
    group.rows.map((row) => ({
      assignmentType: row.assignmentType,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      companyId: row.companyId,
      companyAlias: row.companyAlias,
      userIdentifier: row.userIdentifier,
      dateISO: row.dateISO,
      startHour: row.startHour,
      endHour: row.endHour,
      breakStartHour: row.breakStartHour,
      breakEndHour: row.breakEndHour,
      costCenterCode: row.costCenterCode,
      custom: row.custom,
      crossesMidnight: row.crossesMidnight
    }));

  const overtimeRows = useMemo(
    () => buildOvertimeRows(scopedEmployees, timeSlots, weekPlan),
    [scopedEmployees, timeSlots, weekPlan]
  );

  const buildOvertimeItems = (group: GeoMigrationGroup): GeoVictoriaOvertimeItem[] =>
    overtimeRows
      .filter((row) => row.employeeId === group.employeeId)
      .map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        companyId: row.companyId || group.companyId,
        companyAlias: row.companyAlias,
        userIdentifier: row.userIdentifier || group.userIdentifier,
        dateISO: row.dateISO,
        durationBefore: row.beforeMinutes > 0 ? minutesToHHMM(row.beforeMinutes) : '00:00',
        durationAfter: row.afterMinutes > 0 ? minutesToHHMM(row.afterMinutes) : '00:00',
        valueBefore: row.beforeMinutes > 0 ? OVERTIME_VALUE : '0',
        valueAfter: row.afterMinutes > 0 ? OVERTIME_VALUE : '0'
      }));

  const buildOvertimeClearItems = (group: GeoMigrationGroup): GeoVictoriaOvertimeClearItem[] => {
    const itemsByKey = new Map<string, GeoVictoriaOvertimeClearItem>();

    // Solo se limpia lo que este mismo modulo agrego antes (sabemos la duracion exacta
    // que hay que quitar). No hay endpoint verificado para consultar horas extra existentes
    // en GeoVictoria, asi que no se puede limpiar hora extra creada fuera de esta pantalla.
    for (const item of overtimeByGroupKey[group.key] ?? []) {
      if (!item.ok) continue;
      if (item.durationBefore === '00:00' && item.durationAfter === '00:00') continue;
      itemsByKey.set(`${item.employeeId}:${item.dateISO}`, {
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        companyId: item.companyId,
        companyAlias: item.companyAlias,
        userIdentifier: item.userIdentifier,
        dateISO: item.dateISO,
        durationBefore: item.durationBefore,
        durationAfter: item.durationAfter
      });
    }

    return Array.from(itemsByKey.values());
  };

  const sendOvertimeForGroups = async (groupsToSend: GeoMigrationGroup[]): Promise<OvertimeMigrationSummary> => {
    const currentByGroupKey = new Map<string, GeoVictoriaOvertimeItem[]>();
    for (const group of groupsToSend) {
      currentByGroupKey.set(group.key, buildOvertimeItems(group));
    }

    const clearItems = groupsToSend.flatMap((group) => buildOvertimeClearItems(group));
    const items = Array.from(currentByGroupKey.values()).flat();
    const resultsByGroupKey: Record<string, GeoVictoriaOvertimeResult[]> = {};

    let deleted = 0;
    const clearErrors: string[] = [];
    if (clearItems.length > 0) {
      try {
        const clearResponse = await clearGeoVictoriaOvertime(clearItems);
        deleted = clearResponse.deleted;
        clearErrors.push(
          ...clearResponse.results
            .filter((result) => !result.ok)
            .map((result) => `No se pudo limpiar hora extra previa de ${result.employeeName} (${result.dateISO}): ${result.error ?? 'error'}`)
        );
      } catch (error) {
        clearErrors.push(
          error instanceof Error
            ? `No se pudieron actualizar las horas extra existentes: ${error.message}`
            : 'No se pudieron actualizar las horas extra existentes.'
        );
      }
    }

    if (items.length === 0) {
      return { added: 0, deleted, failed: 0, errors: clearErrors, resultsByGroupKey };
    }

    try {
      const response = await addGeoVictoriaOvertime(items);
      const errors = response.results
        .filter((result) => !result.ok)
        .map((result) => `${result.employeeName} (${result.dateISO}): ${result.error ?? 'error'}`);

      for (const group of groupsToSend) {
        const groupItems = new Set((currentByGroupKey.get(group.key) ?? []).map((item) => `${item.employeeId}:${item.dateISO}`));
        resultsByGroupKey[group.key] = response.results.filter((result) => result.ok && groupItems.has(`${result.employeeId}:${result.dateISO}`));
      }

      return { added: response.added, deleted, failed: response.failed, errors: [...clearErrors, ...errors], resultsByGroupKey };
    } catch (error) {
      return {
        added: 0,
        deleted,
        failed: items.length,
        errors: [...clearErrors, error instanceof Error ? error.message : 'No se pudieron registrar las horas extra.'],
        resultsByGroupKey
      };
    }
  };

  const formatOvertimeSummary = (overtime: OvertimeMigrationSummary): string => {
    if (!overtime.added && !overtime.deleted && !overtime.failed) return '';
    return ` Horas extra: ${overtime.deleted} eliminadas, ${overtime.added} agregadas, ${overtime.failed} con error.`;
  };

  const persistMigrationResults = (
    group: GeoMigrationGroup,
    response: { migrated: number; failed: number; results: GeoVictoriaPlanningMigrationResult[] },
    migratedAt: string,
    migratedBy: string | null,
    overtimeResults: GeoVictoriaOvertimeResult[] = []
  ): void => {
    setResultByKey((current) => {
      const nextResults = { ...current };
      for (const result of response.results) {
        const rowKey =
          result.assignmentType === 'rest'
            ? `${result.employeeId}:${result.dateISO}:rest`
            : result.assignmentType === 'free'
              ? `${result.employeeId}:${result.dateISO}:free`
              : `${result.employeeId}:${result.dateISO}:${result.startHour}:${result.endHour}:${result.breakStartHour ?? ''}:${result.breakEndHour ?? ''}`;
        nextResults[rowKey] = { result, migratedAt, migratedBy };
      }
      return nextResults;
    });
    setOvertimeByGroupKey((current) => ({ ...current, [group.key]: overtimeResults }));

    if (!currentScopedWeekId) return;

    const log = {
      companyId: group.companyId,
      areaId: currentAreaId,
      scopedWeekId: currentScopedWeekId,
      employeeId: group.employeeId,
      employeeName: group.employeeName,
      userIdentifier: group.userIdentifier,
      groupKey: group.key,
      results: response.results,
      overtimeResults,
      migratedBy,
      migratedAt
    };
    saveMigrationLogs([log]).catch((err) => {
      console.error('Failed to save migration logs:', err);
    });
  };

  const migrateSingleGroup = async (
    group: GeoMigrationGroup
  ): Promise<{ migrated: number; failed: number; results: GeoVictoriaPlanningMigrationResult[] }> => {
    const items = buildMigrationItems(group);
    if (items.length === 0) {
      return { migrated: 0, failed: 0, results: [] };
    }

    const response = await migrateGeoVictoriaPlanning(items);
    return { migrated: response.migrated, failed: response.failed, results: response.results };
  };

  const handleMigrate = async (keys: string[]): Promise<void> => {
    if (!ensureWeekValidated()) {
      setPendingMigrationKeys([]);
      setPendingMigrationLabel('');
      closeConfirm();
      return;
    }
    const groupsToMigrate = groups.filter((group) => keys.includes(group.key) && group.canMigrate);
    const items = groupsToMigrate.flatMap((group) => buildMigrationItems(group));

    if (items.length === 0) {
      toast({
        status: 'warning',
        title: 'No hay turnos validos para migrar.'
      });
      return;
    }

    const isBatchSelection = keys.length > 1 && keys.every((key) => selectedKeys.includes(key));
    const shouldShowBatchProgress = isBatchSelection;

    setIsMigrating(true);
    setMigratingKeys(keys);
    if (shouldShowBatchProgress) {
      setBatchProgress({
        total: groupsToMigrate.length,
        completed: 0,
        migrated: 0,
        failed: 0,
        currentEmployeeName: null
      });
    }
    toast({
      id: migrationToastId,
      status: 'info',
      title: 'Migrando...',
      duration: null,
      isClosable: false
    });

    try {
      if (shouldShowBatchProgress) {
        let migrated = 0;
        let failed = 0;
        const responsesByGroup = new Map<string, { migrated: number; failed: number; results: GeoVictoriaPlanningMigrationResult[] }>();

        for (const [index, group] of groupsToMigrate.entries()) {
          setBatchProgress((current) =>
            current
              ? {
                  ...current,
                  currentEmployeeName: group.employeeName
                }
              : current
          );

          try {
            const response = await migrateSingleGroup(group);
            responsesByGroup.set(group.key, response);
            migrated += response.migrated;
            failed += response.failed;
          } catch (error) {
            failed += group.rows.length;
            throw new Error(
              error instanceof Error
                ? `No se pudo migrar a ${group.employeeName}: ${error.message}`
                : `No se pudo migrar a ${group.employeeName}.`
            );
          } finally {
            setBatchProgress((current) =>
              current
                ? {
                    ...current,
                    completed: index + 1,
                    migrated,
                    failed
                  }
                : current
            );
          }
        }

        const overtime = await sendOvertimeForGroups(groupsToMigrate);
        const migratedAt = new Date().toISOString();
        const migratedBy = currentUser?.name?.trim() || currentUser?.username?.trim() || null;
        for (const group of groupsToMigrate) {
          const response = responsesByGroup.get(group.key);
          if (!response) continue;
          const nextOvertimeResults = overtime.failed > 0
            ? overtimeByGroupKey[group.key] ?? []
            : overtime.resultsByGroupKey[group.key] ?? [];
          persistMigrationResults(group, response, migratedAt, migratedBy, nextOvertimeResults);
        }

        toast.close(migrationToastId);
        toast({
          status: failed > 0 || overtime.failed > 0 ? 'warning' : 'success',
          title: `Migracion completada: ${migrated} ok, ${failed} con error.${formatOvertimeSummary(overtime)}`,
          description: overtime.errors.length ? overtime.errors.join(' | ') : undefined,
          duration: overtime.errors.length ? 9000 : undefined
        });
        return;
      }

      const response = await migrateGeoVictoriaPlanning(items);
      const overtime = await sendOvertimeForGroups(groupsToMigrate);
      const migratedAt = new Date().toISOString();
      const migratedBy = currentUser?.name?.trim() || currentUser?.username?.trim() || null;
      for (const group of groupsToMigrate) {
        const nextOvertimeResults = overtime.failed > 0
          ? overtimeByGroupKey[group.key] ?? []
          : overtime.resultsByGroupKey[group.key] ?? [];
        persistMigrationResults(group, {
          migrated: response.migrated,
          failed: response.failed,
          results: response.results.filter((result) => result.employeeId === group.employeeId)
        }, migratedAt, migratedBy, nextOvertimeResults);
      }

      toast.close(migrationToastId);
      toast({
        status: response.failed > 0 || overtime.failed > 0 ? 'warning' : 'success',
        title: `Migracion completada: ${response.migrated} ok, ${response.failed} con error.${formatOvertimeSummary(overtime)}`,
        description: overtime.errors.length ? overtime.errors.join(' | ') : undefined,
        duration: overtime.errors.length ? 9000 : undefined
      });
    } catch (error) {
      toast.close(migrationToastId);
      toast({
        status: 'error',
        title: error instanceof Error ? error.message : 'No se pudo migrar la planificacion a GeoVictoria.'
      });
    } finally {
      toast.close(migrationToastId);
      setIsMigrating(false);
      setMigratingKeys([]);
      setPendingMigrationKeys([]);
      setPendingMigrationLabel('');
      setBatchProgress(null);
      closeConfirm();
    }
  };

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardHeader pb={0}>
          <VStack align="stretch" spacing={1}>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Migrar Turnos
            </Text>
            <Text color="gray.600">
              Revisa la semana seleccionada y migra los turnos diarios a GeoVictoria. Si eliges una empresa global en el
              menú del usuario, todas las migraciones se enviarán a esa company; si no, se usará la company de cada
              colaborador.
            </Text>
          </VStack>
        </CardHeader>
        <CardBody>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <WeekSelector />
            <HStack spacing={3}>
              <Badge colorScheme="blue" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
                Filas: {groups.length}
              </Badge>
                <Badge colorScheme="green" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
                  Migrables: {migratableKeys.length}
                </Badge>
                {selectedGeoVictoriaCompanyId ? (
                  <Badge colorScheme="purple" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
                    Filtro empresa activo
                  </Badge>
                ) : null}
              <Button
                  colorScheme="teal"
                  leftIcon={<FiSend />}
                onClick={() => {
                  if (!ensureWeekValidated()) return;
                  setPendingMigrationKeys(selectedKeys);
                  setPendingMigrationLabel('migrar los seleccionados');
                  openConfirm();
                }}
                isDisabled={selectedKeys.length === 0}
                isLoading={isMigrating}
                loadingText="Migrando"
              >
                Migrar seleccionados
              </Button>
            <Button
              display="none"
              variant="outline"
              colorScheme="teal"
              onClick={() => {
                if (!ensureWeekValidated()) return;
                setPendingMigrationKeys(migratableKeys);
                setPendingMigrationLabel('migrar la semana');
                openConfirm();
              }}
            >
              Migrar semana
            </Button>
            </HStack>
          </HStack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {!groups.length ? (
            <Text color="gray.500">No hay turnos asignados para el area y semana seleccionadas.</Text>
          ) : (
            <Box overflowX="auto">
              <Table size="sm" bg="white" minW="1040px">
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={allMigratableSelected}
                        isIndeterminate={selectedKeys.length > 0 && !allMigratableSelected}
                        onChange={(event) => {
                          setSelectedKeys(event.target.checked ? migratableKeys : []);
                        }}
                      />
                    </Th>
                    <Th>Colaborador</Th>
                    <Th>Codigo</Th>
                    <Th>Empresa</Th>
                    <Th>Identificador</Th>
                    <Th>Turno</Th>
                    <Th>Planificacion</Th>
                    <Th>Actualizado</Th>
                    <Th>Accion</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {groups.map((group) => {
                    const groupResults = group.rows.map((row) => resultByKey[row.key]).filter((result): result is StoredMigrationResult => result !== undefined);
                    const allRowsMigrated = group.rows.length > 0 && group.rows.every((row) => resultByKey[row.key] !== undefined);
                    const shiftResults = groupResults.map((entry) => entry.result);
                    const shiftErrors = shiftResults.filter((result) => !result.shiftOk);
                    const planningErrors = shiftResults.filter((result) => !result.planningOk);
                    // "Enviado" verde solo si TODAS las filas migraron por completo
                    // (turno + planificacion). Crear el turno no basta: si la
                    // planificacion fallo, el estado es Parcial, no Enviado.
                    const fullyMigrated =
                      allRowsMigrated && shiftResults.length > 0 && shiftResults.every((result) => result.ok);
                    const shiftCreated = shiftResults.filter((result) => result.shiftOk && result.shiftSource === 'created').length;
                    const shiftReused = shiftResults.filter((result) => result.shiftOk && result.shiftSource === 'existing').length;
                    const lastMigratedAt = groupResults.reduce<string | null>(
                      (latest, entry) => (latest === null || entry.migratedAt > latest ? entry.migratedAt : latest),
                      null
                    );
                    const lastMigratedBy =
                      groupResults.find((entry) => entry.migratedAt === lastMigratedAt)?.migratedBy ?? null;
                    const isRowMigrating = migratingKeys.includes(group.key);
                    return (
                      <Tr key={group.key}>
                        <Td>
                          <Checkbox
                            isChecked={selectedKeys.includes(group.key)}
                            isDisabled={!group.canMigrate || isMigrating}
                            onChange={(event) => {
                              setSelectedKeys((current) =>
                                event.target.checked ? [...current, group.key] : current.filter((key) => key !== group.key)
                              );
                            }}
                          />
                        </Td>
                        <Td>{group.employeeName}</Td>
                        <Td>{group.employeeCode}</Td>
                        <Td>{group.companyLabel}</Td>
                        <Td>{group.userIdentifier || '-'}</Td>
                        <Td>
                          {groupResults.length ? (
                            <Tooltip
                              label={
                                shiftErrors.length
                                  ? shiftErrors.map((result) => result.error ?? result.shiftMessage ?? 'Error al crear turno.').join(' | ')
                                  : `Creados: ${shiftCreated} | Reutilizados: ${shiftReused}`
                              }
                              hasArrow
                            >
                              <Badge colorScheme={shiftErrors.length ? 'red' : fullyMigrated ? 'green' : 'orange'} textTransform="none">
                                {shiftErrors.length ? 'Con errores' : fullyMigrated ? 'Enviado' : 'Parcial'}
                              </Badge>
                            </Tooltip>
                          ) : group.canMigrate ? (
                            <Badge colorScheme="gray" textTransform="none">
                              Pendiente
                            </Badge>
                          ) : (
                            <Tooltip label={group.warnings.join(' ')} hasArrow>
                              <Badge colorScheme="orange" textTransform="none">
                                Incompleto
                              </Badge>
                            </Tooltip>
                          )}
                        </Td>
                        <Td>
                          {groupResults.length ? (
                            <Tooltip
                              label={
                                planningErrors.length
                                  ? planningErrors.map((result) => result.error ?? result.planningMessage ?? 'Error al crear planificacion.').join(' | ')
                                  : `Dias enviados: ${groupResults.length}/${group.rows.length}`
                              }
                              hasArrow
                            >
                              <Badge colorScheme={planningErrors.length ? 'red' : fullyMigrated ? 'green' : 'orange'} textTransform="none">
                                {planningErrors.length ? 'Con errores' : fullyMigrated ? 'Enviado' : 'Parcial'}
                              </Badge>
                            </Tooltip>
                          ) : group.canMigrate ? (
                            <Badge colorScheme="gray" textTransform="none">
                              Pendiente
                            </Badge>
                          ) : (
                            <Badge colorScheme="orange" textTransform="none">
                              Sin enviar
                            </Badge>
                          )}
                        </Td>
                        <Td>
                          {lastMigratedAt ? (
                            <Tooltip label={lastMigratedBy ? `Actualizado por ${lastMigratedBy}` : 'Usuario no registrado'} hasArrow>
                              <Text fontSize="xs" color="gray.600">
                                {formatMigrationDateTime(lastMigratedAt)}
                              </Text>
                            </Tooltip>
                          ) : (
                            <Text fontSize="xs" color="gray.400">
                              -
                            </Text>
                          )}
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="blue"
                              leftIcon={<FiEye />}
                              onClick={() => {
                                setSelectedGroup(group);
                                onOpen();
                              }}
                            >
                              Ver
                            </Button>
                            <Button
                              size="xs"
                              colorScheme="teal"
                              variant="outline"
                              leftIcon={<FiSend />}
                              onClick={() => {
                                if (!ensureWeekValidated()) return;
                                setPendingMigrationKeys([group.key]);
                                setPendingMigrationLabel(`migrar a ${group.employeeName}`);
                                openConfirm();
                              }}
                              isDisabled={!group.canMigrate}
                              isLoading={isRowMigrating}
                            >
                              Migrar
                            </Button>
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

      <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedGroup ? `Planificación semanal: ${selectedGroup.employeeName}` : 'Planificación semanal'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {!selectedGroup || !selectedEmployee || !weekPlan ? (
              <Text color="gray.500">No hay colaborador seleccionado.</Text>
            ) : (
              <VStack align="stretch" spacing={4}>
                <HStack spacing={6} flexWrap="wrap">
                  <Text fontSize="sm" color="gray.600">
                    <b>Código:</b> {selectedGroup.employeeCode}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    <b>Empresa:</b> {selectedGroup.companyLabel}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    <b>Identificador:</b> {selectedGroup.userIdentifier || '-'}
                  </Text>
                </HStack>
                <EmployeeWeekGrid
                  employee={selectedEmployee}
                  days={weekPlan.days}
                  roles={scopedRoles}
                  timeSlots={timeSlots}
                  breakConfig={breakConfig}
                  restDayOverrides={weekPlan.restDayOverrides?.[selectedEmployee.id]}
                  maxTableHeight="60vh"
                />
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => {
          if (!isMigrating) {
            closeConfirm();
          }
        }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isMigrating && batchProgress ? 'Migrando seleccionados' : 'Confirmar migración'}</ModalHeader>
          <ModalCloseButton isDisabled={isMigrating} />
          <ModalBody>
            {isMigrating && batchProgress ? (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="600" color="gray.800">
                    {batchProgress.completed} de {batchProgress.total} colaboradores migrados
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {batchProgress.currentEmployeeName
                      ? `Procesando a ${batchProgress.currentEmployeeName}`
                      : 'Preparando migración...'}
                  </Text>
                </Box>
                <Progress
                  value={batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}
                  colorScheme="teal"
                  size="md"
                  borderRadius="md"
                  hasStripe
                  isAnimated
                />
                <HStack justify="space-between" fontSize="sm" color="gray.600">
                  <Text>Ok: {batchProgress.migrated}</Text>
                  <Text>Errores: {batchProgress.failed}</Text>
                </HStack>
              </VStack>
            ) : (
              <Text>
                ¿Deseas {pendingMigrationLabel || 'ejecutar la migración'}?
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={closeConfirm} isDisabled={isMigrating}>
                Cancelar
              </Button>
              <Button
                colorScheme="teal"
                onClick={() => void handleMigrate(pendingMigrationKeys)}
                isLoading={isMigrating}
                loadingText="Migrando"
                isDisabled={pendingMigrationKeys.length === 0 || isMigrating}
              >
                Migrar
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
