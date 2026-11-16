import {
  Badge,
  Box,
  Button,
  Checkbox,
  Card,
  CardBody,
  CardHeader,
  Collapse,
  HStack,
  Icon,
  Link,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useDisclosure,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiDownload } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import {
  fetchBukRecintos,
  fetchBukShifts,
  registerBukShifts,
  type BukRecinto,
  type BukRegisteredShift
} from '../api/bukApi';
import { WeekSelector } from '../components/WeekSelector';
import { useAuthStore } from '../store/useAuthStore';
import { getWeekAuditForCompany, isWeekValidatedForCompany, useAppStore } from '../store/useAppStore';
import type { AreaId } from '../types';
import {
  BUK_REST_CODE,
  buildBukExportData,
  buildDefaultBukPrefix,
  downloadBukAsignarTurnos,
  getBukCompanyId,
  getBukCreacionEntries,
  type BukWeekSource,
  downloadBukCreacionTurnos,
  formatBukDate
} from '../utils/buk';
import { fetchAllSubAreas, type SubAreaResponse } from '../api/subAreaApi';
import { fetchEmployeeDirectory, type EmployeeDirectoryEntry } from '../api/employeeDirectoryApi';
import { isVisibleInPlanning, resolvePlanningEmployees } from '../utils/planningEmployees';

/** "Salon" y "Salón" son la misma área: los turnos ya creados en BUK guardan el nombre de entonces. */
function normalizeAreaLabel(label: string): string {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function scopedWeekKey(areaId: AreaId, weekId: string): string {
  return `${areaId}::${weekId}`;
}

export function BukMigrationPage(): JSX.Element {
  const selectedCompanyId = useAuthStore((state) => state.selectedGeoVictoriaCompanyId);
  const employees = useAppStore((state) => state.employees);
  const [directory, setDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  useEffect(() => {
    fetchEmployeeDirectory()
      .then(setDirectory)
      .catch(() => setDirectory([]));
  }, []);
  const areas = useAppStore((state) => state.areas);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const timeSlotsByArea = useAppStore((state) => state.timeSlotsByArea);
  const defaultTimeSlots = useAppStore((state) => state.timeSlots);
  const weekConfigById = useAppStore((state) => state.weekConfigById);
  const validatedWeekIds = useAppStore((state) => state.validatedWeekIds);
  const weekAuditById = useAppStore((state) => state.weekAuditById);

  // En BUK el área se nombra como la ve el selector: si el área tiene una única sub-área
  // (ej. "Salón (Servicio Al Cliente)") se usa la sub-área → HSL, "Horario de Salón ...".
  // Con varias sub-áreas no se puede separar colaboradores, así que se usa el área.
  const [subAreas, setSubAreas] = useState<SubAreaResponse[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSubAreas(null);
    fetchAllSubAreas(selectedCompanyId)
      .then((data) => {
        if (!cancelled) setSubAreas(data);
      })
      .catch(() => {
        if (!cancelled) setSubAreas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, areas]);
  const bukLabelByAreaId = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areas ?? []) {
      const subs = (subAreas ?? []).filter((sub) => sub.areaCode === area.code);
      map.set(area.code, subs.length === 1 ? subs[0].label : area.label);
    }
    return map;
  }, [areas, subAreas]);
  const areaLabel = bukLabelByAreaId.get(currentAreaId) ?? currentAreaId;
  const currentWeek = useMemo(
    () => weeks.find((week) => week.startDateISO === currentWeekStartDateISO),
    [weeks, currentWeekStartDateISO]
  );
  const currentScopedWeekId = currentWeek ? scopedWeekKey(currentAreaId, currentWeek.id) : null;
  const isCurrentWeekValidated = isWeekValidatedForCompany(validatedWeekIds, currentScopedWeekId, selectedCompanyId);

  const toast = useToast();
  const [recintos, setRecintos] = useState<BukRecinto[]>([]);
  const [registeredShifts, setRegisteredShifts] = useState<BukRegisteredShift[]>([]);
  const [includeRegistered, setIncludeRegistered] = useState(false);
  const [isExportingShifts, setIsExportingShifts] = useState(false);
  const { isOpen: isShiftsOpen, onToggle: toggleShifts } = useDisclosure();
  const { isOpen: isRowsOpen, onToggle: toggleRows } = useDisclosure();

  useEffect(() => {
    fetchBukRecintos()
      .then(setRecintos)
      .catch(() => setRecintos([]));
    fetchBukShifts()
      .then(setRegisteredShifts)
      .catch(() => setRegisteredShifts([]));
  }, []);

  const companyEmployees = useMemo(
    () => employees.filter((employee) => !selectedCompanyId || getBukCompanyId(employee) === selectedCompanyId),
    [employees, selectedCompanyId]
  );

  // Todas las semanas planificadas de todas las áreas: el catálogo de turnos sale de
  // aquí, la asignación solo de la semana/área seleccionada.
  const { sources, currentSource } = useMemo(() => {
    const allSources: BukWeekSource[] = [];
    let current: BukWeekSource | undefined;
    for (const [scopedId, weekPlan] of Object.entries(weekPlans)) {
      const [areaId] = scopedId.split('::');
      // Solo los colaboradores que la planificación muestra en esa semana.
      const isValidated = isWeekValidatedForCompany(validatedWeekIds, scopedId, selectedCompanyId);
      const audit = getWeekAuditForCompany(weekAuditById, scopedId, selectedCompanyId);
      const areaEmployees = resolvePlanningEmployees(
        companyEmployees.filter((employee) => employee.areaId === areaId),
        isValidated,
        audit?.inactiveEmployeeIds
      )
        .filter((employee) => isVisibleInPlanning(employee, weekPlan, isValidated))
        .map((employee) => ({ ...employee, active: true }));
      if (!areaEmployees.length) continue;
      const weekConfig = weekConfigById[scopedId];
      const source: BukWeekSource = {
        areaId,
        areaLabel: bukLabelByAreaId.get(areaId) ?? areaId,
        employees: areaEmployees,
        timeSlots: weekConfig?.timeSlots?.length ? weekConfig.timeSlots : timeSlotsByArea[areaId] ?? defaultTimeSlots,
        weekPlan
      };
      allSources.push(source);
      if (scopedId === currentScopedWeekId) current = source;
    }
    return { sources: allSources, currentSource: current };
  }, [
    weekPlans,
    companyEmployees,
    weekConfigById,
    bukLabelByAreaId,
    timeSlotsByArea,
    defaultTimeSlots,
    currentScopedWeekId,
    validatedWeekIds,
    weekAuditById,
    selectedCompanyId
  ]);

  // Código y nombre de cada turno los genera el sistema (ver buildBukExportData).
  // Los turnos ya creados en BUK conservan su código en cualquier semana.
  const exportData = useMemo(
    () => buildBukExportData(currentSource, sources, registeredShifts),
    [currentSource, sources, registeredShifts]
  );
  // Los códigos se asignan sobre el catálogo completo (sin colisiones entre áreas), pero solo
  // se muestran/exportan los turnos que planifica el área seleccionada (por código de área:
  // en Cañete "cocina" y "supervisión" se llaman las dos "Alimentos y Bebidas").
  const shifts = useMemo(() => {
    const areaSignatures = exportData.signaturesByAreaId.get(currentAreaId) ?? new Set<string>();
    return exportData.shifts.filter((shift) => areaSignatures.has(shift.signature));
  }, [exportData, currentAreaId]);
  const codeBySignature = useMemo(() => new Map(shifts.map((shift) => [shift.signature, shift.code])), [shifts]);

  // Empresas con turnos en la semana que aún no tienen recinto BUK asignado.
  const companiesWithoutRecinto = useMemo(() => {
    const recintoCompanyIds = new Set(recintos.map((recinto) => recinto.companyId));
    const usedCompanyIds = new Set(shifts.flatMap((shift) => shift.companyIds));
    return Array.from(usedCompanyIds)
      .filter((companyId) => !recintoCompanyIds.has(companyId))
      .map((companyId) => {
        const employee = employees.find((item) => getBukCompanyId(item) === companyId);
        return employee?.moduleCompanyAlias ?? employee?.companyAlias ?? companyId;
      });
  }, [recintos, shifts, employees]);

  const rowsWithWarnings = exportData.rows.filter((row) => row.warnings.length > 0).length;
  const weekSuffix = currentWeek?.startDateISO ?? 'semana';
  const canExport = exportData.rows.length > 0;
  const pendingEntries = useMemo(() => getBukCreacionEntries(shifts, recintos, false), [shifts, recintos]);
  // Sin turnos nuevos pendientes, el botón re-descarga todos (mismos códigos) en vez de quedar deshabilitado.
  const exportAllShifts = includeRegistered || pendingEntries.length === 0;
  const creacionEntries = useMemo(
    () => (exportAllShifts ? getBukCreacionEntries(shifts, recintos, true) : pendingEntries),
    [exportAllShifts, shifts, recintos, pendingEntries]
  );
  // Turnos con al menos un recinto pendiente (nuevo o creado solo en otra empresa).
  const pendingShiftsCount = new Set(pendingEntries.map((entry) => entry.shift.signature)).size;

  // Validación de área: nada de otra área puede salir en los Excel.
  const areaErrors = useMemo(() => {
    const errors: string[] = [];
    if (currentSource && currentSource.areaId !== currentAreaId) {
      errors.push(`La semana cargada es del área "${currentSource.areaLabel}", no de "${areaLabel}".`);
    }
    const employeeAreaById = new Map(employees.map((employee) => [employee.id, employee.areaId]));
    const foreignEmployees = exportData.rows.filter((row) => employeeAreaById.get(row.employeeId) !== currentAreaId);
    if (foreignEmployees.length) {
      errors.push(
        `Colaboradores que no son del área "${areaLabel}": ${foreignEmployees.map((row) => row.employeeName).join(', ')}.`
      );
    }
    // Mismo horario y mismo prefijo en otra área (ej. Producción/Pruebas → HPR): el turno
    // saldría con el nombre de la otra área.
    const foreignShifts = shifts.filter((shift) => normalizeAreaLabel(shift.areaLabel) !== normalizeAreaLabel(areaLabel));
    if (foreignShifts.length) {
      errors.push(
        `Turnos con nombre de otra área: ${foreignShifts.map((shift) => `${shift.code} (${shift.areaLabel})`).join(', ')}.`
      );
    }
    return errors;
  }, [currentSource, currentAreaId, areaLabel, employees, exportData, shifts]);
  // Hasta tener las sub-áreas no se conoce el nombre BUK del área: no se exporta.
  const hasAreaErrors = areaErrors.length > 0 || subAreas === null;

  // Dos áreas con el mismo prefijo (ej. Producción y Pruebas → HPR) comparten códigos si
  // planifican el mismo horario. Solo se avisa; si llega a mezclarse, areaErrors lo bloquea.
  const prefixClashWarning = useMemo(() => {
    const prefix = buildDefaultBukPrefix(areaLabel);
    const clashing = (areas ?? []).filter(
      (area) => area.code !== currentAreaId &&
        normalizeAreaLabel(bukLabelByAreaId.get(area.code) ?? area.label) !== normalizeAreaLabel(areaLabel) &&
        buildDefaultBukPrefix(bukLabelByAreaId.get(area.code) ?? area.label) === prefix
    );
    return clashing.length
      ? `"${areaLabel}" comparte el prefijo ${prefix} con: ${clashing.map((area) => bukLabelByAreaId.get(area.code) ?? area.label).join(', ')}. Si planifican el mismo horario, sus códigos se mezclarían.`
      : null;
  }, [areas, areaLabel, currentAreaId, bukLabelByAreaId]);

  const canExportShifts = creacionEntries.length > 0 && companiesWithoutRecinto.length === 0 && !hasAreaErrors;

  const handleExportShifts = async (): Promise<void> => {
    if (hasAreaErrors || creacionEntries.some((entry) => normalizeAreaLabel(entry.shift.areaLabel) !== normalizeAreaLabel(areaLabel))) {
      toast({ status: 'error', title: 'Exportación cancelada: hay turnos que no son del área seleccionada.' });
      return;
    }
    setIsExportingShifts(true);
    try {
      downloadBukCreacionTurnos(creacionEntries, recintos, `Creacion_Turnos_${currentAreaId}_${weekSuffix}.xls`);
      // Registra lo exportado: desde aquí su código queda fijo y no vuelve a salir como nuevo.
      const recintoCodesBySignature = new Map<string, Set<string>>();
      for (const { shift, recinto } of creacionEntries) {
        const codes = recintoCodesBySignature.get(shift.signature) ?? new Set<string>();
        if (recinto) codes.add(recinto.code);
        recintoCodesBySignature.set(shift.signature, codes);
      }
      const saved = await registerBukShifts(
        shifts
          .filter((shift) => recintoCodesBySignature.has(shift.signature))
          .map((shift) => ({
            signature: shift.signature,
            code: shift.code,
            name: shift.name,
            areaLabel: shift.areaLabel,
            start: shift.start,
            end: shift.end,
            nocturnal: shift.nocturnal,
            recintoCodes: Array.from(recintoCodesBySignature.get(shift.signature) ?? [])
          }))
      );
      setRegisteredShifts(saved);
      setIncludeRegistered(false);
      toast({ status: 'success', title: `Turnos exportados y registrados: ${recintoCodesBySignature.size}.` });
    } catch (error) {
      toast({
        status: 'error',
        title: error instanceof Error ? error.message : 'No se pudieron registrar los turnos exportados.'
      });
    } finally {
      setIsExportingShifts(false);
    }
  };

  return (
    <Box>
      <Card variant="outline" borderColor="gray.200" shadow="sm" mb={4}>
        <CardHeader pb={0}>
          <VStack align="stretch" spacing={1}>
            <Text fontSize="2xl" fontWeight="700" color="gray.800">
              Migrar BUK
            </Text>
            <Text color="gray.600">
              Genera los Excel de BUK para la semana y área seleccionadas: la creación de turnos (un código único por
              horario) y la asignación de turnos a cada colaborador.
            </Text>
          </VStack>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
              <WeekSelector />
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="teal" variant="solid" px={3} py={1} rounded="md" textTransform="none">
                  Área a migrar: {areaLabel}
                </Badge>
                <Badge colorScheme="blue" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
                  Colaboradores: {exportData.rows.length}
                </Badge>
                <Badge colorScheme="purple" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
                  Turnos: {shifts.length} ({exportData.currentWeekSignatures.size} esta semana)
                </Badge>
                <Checkbox
                  size="sm"
                  isChecked={includeRegistered}
                  onChange={(event) => setIncludeRegistered(event.target.checked)}
                >
                  Incluir turnos ya creados en BUK
                </Checkbox>
                {!isCurrentWeekValidated ? (
                  <Badge colorScheme="orange" variant="subtle" px={3} py={1} rounded="md" textTransform="none">
                    Semana sin validar
                  </Badge>
                ) : null}
                <Button
                  colorScheme="teal"
                  variant="outline"
                  leftIcon={<FiDownload />}
                  isDisabled={!canExportShifts}
                  isLoading={isExportingShifts}
                  onClick={handleExportShifts}
                >
                  {exportAllShifts
                    ? 'Creación de turnos (todos)'
                    : `Creación de turnos (${pendingShiftsCount} nuevos)`}
                </Button>
                <Button
                  colorScheme="teal"
                  leftIcon={<FiDownload />}
                  isDisabled={!canExport || hasAreaErrors}
                  onClick={() =>
                    downloadBukAsignarTurnos(
                      // Solo el catálogo del área: la hoja de turnos no lleva códigos de otras áreas.
                      { ...exportData, shifts },
                      areaLabel,
                      `Asignar_Turnos_Colaboradores_${currentAreaId}_${weekSuffix}.xls`,
                      new Map([
                        ...directory.map((entry) => [entry.id, entry.name] as const),
                        ...employees.map((employee) => [employee.id, employee.name] as const)
                      ])
                    )
                  }
                >
                  Asignación de turnos
                </Button>
              </HStack>
            </HStack>
            {companiesWithoutRecinto.length > 0 ? (
              <Text fontSize="sm" color="red.500">
                Empresas sin recinto BUK: {companiesWithoutRecinto.join(', ')}. Asígnalos en{' '}
                <Link as={RouterLink} to="/recintos" color="blue.600" textDecoration="underline">
                  Recintos
                </Link>{' '}
                para exportar la creación de turnos.
              </Text>
            ) : null}
            {areaErrors.length > 0 ? (
              <VStack align="stretch" spacing={1}>
                {areaErrors.map((error) => (
                  <Text key={error} fontSize="sm" color="red.500">
                    {error}
                  </Text>
                ))}
                <Text fontSize="sm" color="red.500" fontWeight="600">
                  Exportación bloqueada hasta corregirlo.
                </Text>
              </VStack>
            ) : null}
            {prefixClashWarning ? (
              <Text fontSize="sm" color="orange.500">
                {prefixClashWarning}
              </Text>
            ) : null}
            {rowsWithWarnings > 0 ? (
              <Text fontSize="sm" color="orange.500">
                {rowsWithWarnings} colaborador(es) con observaciones. Revisa la tabla de asignación.
              </Text>
            ) : null}
          </VStack>
        </CardBody>
      </Card>

      <Card mb={4}>
        <CardHeader cursor="pointer" onClick={toggleShifts} _hover={{ bg: 'gray.50' }} roundedTop="md">
          <HStack justify="space-between" align="flex-start">
            <VStack align="stretch" spacing={0}>
              <HStack spacing={2}>
                <Text fontWeight="700" color="gray.800">
                  Turnos a crear
                </Text>
                <Badge colorScheme="purple" variant="subtle" textTransform="none">
                  {shifts.length}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                Horarios planificados del área seleccionada en las semanas cargadas. Marcados en verde los que se usan en la
                semana seleccionada.
              </Text>
            </VStack>
            <Icon as={isShiftsOpen ? FiChevronUp : FiChevronDown} boxSize={5} color="gray.500" />
          </HStack>
        </CardHeader>
        <Collapse in={isShiftsOpen} animateOpacity>
          <CardBody pt={0}>
            {!shifts.length ? (
              <Text color="gray.500">No hay turnos planificados.</Text>
            ) : (
              <Box overflowX="auto">
                <Table size="sm" bg="white" minW="900px">
                  <Thead>
                    <Tr>
                      <Th>Código</Th>
                      <Th>Área</Th>
                      <Th>Nombre</Th>
                      <Th>Inicio</Th>
                      <Th>Fin</Th>
                      <Th>Colación</Th>
                      <Th>Nocturno</Th>
                      <Th>BUK</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {shifts.map((shift) => (
                      <Tr key={shift.signature}>
                        <Td>
                          <Badge
                            colorScheme={exportData.currentWeekSignatures.has(shift.signature) ? 'green' : 'blue'}
                            textTransform="none"
                          >
                            {shift.code}
                          </Badge>
                        </Td>
                        <Td>{shift.areaLabel}</Td>
                        <Td>{shift.name}</Td>
                        <Td>{shift.start}</Td>
                        <Td>{shift.end}</Td>
                        <Td>-</Td>
                        <Td>{shift.nocturnal ? 'Si' : 'No'}</Td>
                        <Td>
                          {shift.registeredRecintoCodes ? (
                            <Tooltip label={`Recintos: ${shift.registeredRecintoCodes.join(', ') || '-'}`} hasArrow>
                              <Badge colorScheme="green" variant="subtle" textTransform="none">
                                Creado
                              </Badge>
                            </Tooltip>
                          ) : (
                            <Badge colorScheme="orange" variant="subtle" textTransform="none">
                              Nuevo
                            </Badge>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </CardBody>
        </Collapse>
      </Card>

      <Card>
        <CardHeader cursor="pointer" onClick={toggleRows} _hover={{ bg: 'gray.50' }} roundedTop="md">
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Text fontWeight="700" color="gray.800">
                Asignación por colaborador
              </Text>
              <Badge colorScheme="blue" variant="subtle" textTransform="none">
                {exportData.rows.length}
              </Badge>
            </HStack>
            <Icon as={isRowsOpen ? FiChevronUp : FiChevronDown} boxSize={5} color="gray.500" />
          </HStack>
        </CardHeader>
        <Collapse in={isRowsOpen} animateOpacity>
          <CardBody pt={0}>
            {!exportData.rows.length ? (
              <Text color="gray.500">No hay colaboradores para el área y semana seleccionadas.</Text>
            ) : (
              <Box overflowX="auto">
                <Table size="sm" bg="white" minW="1040px">
                  <Thead>
                    <Tr>
                      <Th>Colaborador</Th>
                      <Th>DNI</Th>
                      {exportData.dates.map((dateISO) => (
                        <Th key={dateISO}>{formatBukDate(dateISO)}</Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {exportData.rows.map((row) => (
                      <Tr key={row.employeeId}>
                        <Td>
                          {row.warnings.length ? (
                            <Tooltip label={row.warnings.join(' ')} hasArrow>
                              <Text color="orange.600">{row.employeeName}</Text>
                            </Tooltip>
                          ) : (
                            row.employeeName
                          )}
                        </Td>
                        <Td>{row.identifier || '-'}</Td>
                        {exportData.dates.map((dateISO) => {
                          const cell = row.cells[dateISO];
                          if (cell?.kind === 'shift') {
                            return (
                              <Td key={dateISO}>
                                <Badge colorScheme="blue" textTransform="none">
                                  {codeBySignature.get(cell.signature)}
                                </Badge>
                              </Td>
                            );
                          }
                          return (
                            <Td key={dateISO}>
                              {cell?.kind === 'rest' ? (
                                <Badge colorScheme="gray" textTransform="none">
                                  {BUK_REST_CODE}
                                </Badge>
                              ) : (
                                <Text color="gray.400">-</Text>
                              )}
                            </Td>
                          );
                        })}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </CardBody>
        </Collapse>
      </Card>
    </Box>
  );
}
