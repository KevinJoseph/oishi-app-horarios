import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { migrateGeoVictoriaPlanning, type GeoVictoriaPlanningMigrationResult } from '../api/plannerApi';
import { WeekSelector } from '../components/WeekSelector';
import { useAppStore } from '../store/useAppStore';
import type { AreaId } from '../types';
import { buildGeoMigrationRows } from '../utils/geovictoriaMigration';

function scopedWeekKey(areaId: AreaId, weekId: string): string {
  return `${areaId}::${weekId}`;
}

export function GeoMigrationPage(): JSX.Element {
  const toast = useToast();
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const areaTimeSlots = useAppStore((state) => state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots);
  const areaBreakConfig = useAppStore((state) => state.breakConfigByArea[state.currentAreaId] ?? state.breakConfig);
  const weekConfigById = useAppStore((state) => state.weekConfigById);

  const currentWeek = useMemo(
    () => weeks.find((week) => week.startDateISO === currentWeekStartDateISO),
    [weeks, currentWeekStartDateISO]
  );
  const currentScopedWeekId = currentWeek ? scopedWeekKey(currentAreaId, currentWeek.id) : null;
  const effectiveWeekConfig = currentScopedWeekId ? weekConfigById[currentScopedWeekId] : undefined;
  const timeSlots = effectiveWeekConfig?.timeSlots ?? areaTimeSlots;
  const breakConfig = effectiveWeekConfig?.breakConfig ?? areaBreakConfig;
  const weekPlan = currentScopedWeekId ? weekPlans[currentScopedWeekId] : undefined;
  const scopedEmployees = useMemo(
    () => employees.filter((employee) => (employee.areaId ?? 'salon') === currentAreaId),
    [employees, currentAreaId]
  );
  const scopedRoles = useMemo(
    () => roles.filter((role) => (role.areaId ?? 'salon') === currentAreaId),
    [roles, currentAreaId]
  );
  const rows = useMemo(
    () => buildGeoMigrationRows(scopedEmployees, scopedRoles, timeSlots, breakConfig, weekPlan),
    [scopedEmployees, scopedRoles, timeSlots, breakConfig, weekPlan]
  );

  const migratableKeys = useMemo(() => rows.filter((row) => row.canMigrate).map((row) => row.key), [rows]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migratingKeys, setMigratingKeys] = useState<string[]>([]);
  const [resultByKey, setResultByKey] = useState<Record<string, GeoVictoriaPlanningMigrationResult>>({});

  useEffect(() => {
    setSelectedKeys((current) => current.filter((key) => migratableKeys.includes(key)));
  }, [migratableKeys]);

  const allMigratableSelected = migratableKeys.length > 0 && migratableKeys.every((key) => selectedKeys.includes(key));

  const handleMigrate = async (keys: string[]): Promise<void> => {
    const items = rows
      .filter((row) => keys.includes(row.key) && row.canMigrate)
      .map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        companyId: row.companyId,
        userIdentifier: row.userIdentifier,
        dateISO: row.dateISO,
        startHour: row.startHour,
        endHour: row.endHour,
        custom: row.custom
      }));

    if (items.length === 0) {
      toast({
        status: 'warning',
        title: 'No hay turnos validos para migrar.'
      });
      return;
    }

    setIsMigrating(true);
    setMigratingKeys(keys);
    try {
      const response = await migrateGeoVictoriaPlanning(items);
      const nextResults = { ...resultByKey };
      for (const result of response.results) {
        const rowKey = `${result.employeeId}:${result.dateISO}:${result.startHour}:${result.endHour}`;
        nextResults[rowKey] = result;
      }
      setResultByKey(nextResults);
      toast({
        status: response.failed > 0 ? 'warning' : 'success',
        title: `Migracion completada: ${response.migrated} ok, ${response.failed} con error.`
      });
    } catch (error) {
      toast({
        status: 'error',
        title: error instanceof Error ? error.message : 'No se pudo migrar la planificacion a GeoVictoria.'
      });
    } finally {
      setIsMigrating(false);
      setMigratingKeys([]);
    }
  };

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardHeader pb={0}>
          <VStack align="stretch" spacing={1}>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Migrar a Geo
            </Text>
            <Text color="gray.600">
              Revisa la semana seleccionada y migra los turnos diarios a GeoVictoria usando la company de cada colaborador.
            </Text>
          </VStack>
        </CardHeader>
        <CardBody>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <WeekSelector />
            <HStack spacing={3}>
              <Badge colorScheme="blue" variant="subtle" px={3} py={1} rounded="md">
                Filas: {rows.length}
              </Badge>
              <Badge colorScheme="green" variant="subtle" px={3} py={1} rounded="md">
                Migrables: {migratableKeys.length}
              </Badge>
              <Button
                colorScheme="teal"
                leftIcon={<FiSend />}
                onClick={() => void handleMigrate(selectedKeys)}
                isDisabled={selectedKeys.length === 0}
                isLoading={isMigrating}
                loadingText="Migrando"
              >
                Migrar seleccionados
              </Button>
              <Button
                variant="outline"
                colorScheme="teal"
                onClick={() => void handleMigrate(migratableKeys)}
                isDisabled={migratableKeys.length === 0}
                isLoading={isMigrating && migratingKeys.length === migratableKeys.length}
              >
                Migrar semana
              </Button>
            </HStack>
          </HStack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {!rows.length ? (
            <Text color="gray.500">No hay turnos asignados para el area y semana seleccionadas.</Text>
          ) : (
            <Box overflowX="auto">
              <Table size="sm" bg="white" minW="1200px">
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
                    <Th>Fecha</Th>
                    <Th>Dia</Th>
                    <Th>Hora</Th>
                    <Th>Colaborador</Th>
                    <Th>Codigo</Th>
                    <Th>Empresa</Th>
                    <Th>Zona</Th>
                    <Th>Identificador</Th>
                    <Th>Estado</Th>
                    <Th>Accion</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((row) => {
                    const result = resultByKey[row.key];
                    const isRowMigrating = migratingKeys.includes(row.key);
                    return (
                      <Tr key={row.key}>
                        <Td>
                          <Checkbox
                            isChecked={selectedKeys.includes(row.key)}
                            isDisabled={!row.canMigrate || isMigrating}
                            onChange={(event) => {
                              setSelectedKeys((current) =>
                                event.target.checked ? [...current, row.key] : current.filter((key) => key !== row.key)
                              );
                            }}
                          />
                        </Td>
                        <Td>{row.dateISO}</Td>
                        <Td textTransform="capitalize">{row.dayName}</Td>
                        <Td>{`${row.startHour} - ${row.endHour}`}</Td>
                        <Td>{row.employeeName}</Td>
                        <Td>{row.employeeCode}</Td>
                        <Td>{row.companyLabel}</Td>
                        <Td>{row.roleName}</Td>
                        <Td>{row.userIdentifier || '-'}</Td>
                        <Td>
                          {result ? (
                            <Tooltip label={result.error ?? result.planningResponse ?? 'Migrado'} hasArrow>
                              <Badge colorScheme={result.ok ? 'green' : 'red'}>
                                {result.ok ? 'Migrado' : 'Error'}
                              </Badge>
                            </Tooltip>
                          ) : row.canMigrate ? (
                            <Badge colorScheme="gray">Pendiente</Badge>
                          ) : (
                            <Tooltip label={row.warnings.join(' ')} hasArrow>
                              <Badge colorScheme="orange">Incompleto</Badge>
                            </Tooltip>
                          )}
                        </Td>
                        <Td>
                          <Button
                            size="xs"
                            colorScheme="teal"
                            variant="outline"
                            leftIcon={<FiSend />}
                            onClick={() => void handleMigrate([row.key])}
                            isDisabled={!row.canMigrate}
                            isLoading={isRowMigrating}
                          >
                            Migrar
                          </Button>
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
