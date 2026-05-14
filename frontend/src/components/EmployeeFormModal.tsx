import {
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchGeoVictoriaPositions } from '../api/plannerApi';
import type { GeoVictoriaCompany, GeoVictoriaPosition } from '../api/plannerApi';
import type { AreaId, AreaInfo, Employee, Role } from '../types';
import { createId } from '../store/useAppStore';
import { normalizeRestDay, WEEKDAY_OPTIONS } from '../utils/weekdays';

const RECIBO_COMPANY: GeoVictoriaCompany = {
  alias: 'Recibo',
  name: 'OISHI RESTAURANTE(Recibo)',
  companyId: '2a8M03DV5w6g5gBak-4uA',
  ruc: '20230809234717',
  groups: []
};

function normalizeGroupValue(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editing?: Employee;
  roles: Role[];
  areas: AreaInfo[];
  companies: GeoVictoriaCompany[];
  currentAreaId: AreaId;
  selectedCompanyId?: string | null;
  adminAssignedCompanyId?: string | null;
  onSave: (employee: Employee) => { ok: boolean; error?: string };
};

function splitEmployeeName(employee?: Employee): { firstName: string; lastName: string } {
  if (!employee) return { firstName: '', lastName: '' };
  if (employee.firstName || employee.lastName) {
    return {
      firstName: employee.firstName ?? '',
      lastName: employee.lastName ?? ''
    };
  }

  const parts = employee.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: employee.name ?? '', lastName: '' };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  return {
    firstName: parts.slice(0, 2).join(' '),
    lastName: parts.slice(2).join(' ')
  };
}

function getRoleDisplayLabel(role: Role): string {
  return role.name;
}

export function EmployeeFormModal({
  isOpen,
  onClose,
  editing,
  roles,
  areas,
  companies,
  currentAreaId,
  selectedCompanyId,
  adminAssignedCompanyId,
  onSave
}: Props): JSX.Element {
  const toast = useToast();
  const [areaId, setAreaId] = useState<AreaId>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identityDocument, setIdentityDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyAlias, setCompanyAlias] = useState('');
  const [reciboGroupCode, setReciboGroupCode] = useState('');
  const [positionDescription, setPositionDescription] = useState('');
  const [positions, setPositions] = useState<GeoVictoriaPosition[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [active, setActive] = useState(true);
  const [applyOpeningClosingRules, setApplyOpeningClosingRules] = useState(true);
  const [weeklyHours, setWeeklyHours] = useState('');
  const [contractType, setContractType] = useState<'full-time' | 'part-time' | ''>('');
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [restDay, setRestDay] = useState('0');
  const [mainRoleId, setMainRoleId] = useState('');
  const [mainRoleCode, setMainRoleCode] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const filteredRoles = useMemo(
    () => roles.filter((role) => (role.areaId ?? 'salon') === areaId),
    [roles, areaId]
  );
  const selectedRole = useMemo(() => roles.find((role) => role.id === mainRoleId) ?? null, [roles, mainRoleId]);
  const codeOptions = selectedRole?.validCodes ?? [];
  const selectedModuleCompany = selectedCompanyId
    ? companies.find((company) => company.companyId === selectedCompanyId)
    : null;
  const adminAssignedCompany = adminAssignedCompanyId
    ? companies.find((company) => company.companyId === adminAssignedCompanyId)
    : null;
  // Preferir la empresa Recibo que llega desde la API porque contiene los grupos configurados.
  const reciboCompany: GeoVictoriaCompany =
    companies.find((company) => company.alias.trim().toLowerCase() === 'recibo') ?? RECIBO_COMPANY;
  const selectableCompanies = [selectedModuleCompany, adminAssignedCompany, reciboCompany].filter(
    (company, index, array): company is GeoVictoriaCompany =>
      Boolean(company) && array.findIndex((item) => item?.companyId === company?.companyId) === index
  );
  const selectedCompany =
    selectableCompanies.find((company) => company.alias === companyAlias) ??
    selectableCompanies.find(
      (company) => company.companyId === editing?.companyId || company.companyId === editing?.moduleCompanyId
    ) ??
    null;

  useEffect(() => {
    const initialArea = (editing
      ? editing?.areaId ?? roles.find((role) => role.id === editing?.mainRoleId)?.areaId ?? ''
      : '') as AreaId;
    const nameParts = splitEmployeeName(editing);
    setAreaId(initialArea);
    setFirstName(nameParts.firstName);
    setLastName(nameParts.lastName);
    const initialDni = editing?.identityDocument ?? '';
    setIdentityDocument(initialDni);
    setEmail(editing?.email ?? '');
    setPhone(editing?.phone ?? '');
    const selectedModuleCompany = selectedCompanyId
      ? companies.find((company) => company.companyId === selectedCompanyId)
      : null;
    const editingCompanyAlias =
      editing?.companyAlias ??
      editing?.moduleCompanyAlias ??
      selectedModuleCompany?.alias ??
      '';
    const editingCompany = companies.find((company) => company.alias === editingCompanyAlias);
    const normalizedEditingGroupName = normalizeGroupValue(
      editing?.geoVictoriaGroupName ?? editing?.groupDescription
    );
    const matchingReciboGroup =
      editingCompany?.groups.find((group) => group.code_centro_costo === (editing?.geoVictoriaCostCenterCode ?? '')) ??
      editingCompany?.groups.find((group) => normalizeGroupValue(group.name) === normalizedEditingGroupName) ??
      null;
    setCompanyAlias(editing?.companyAlias ?? editing?.moduleCompanyAlias ?? selectedModuleCompany?.alias ?? '');
    setReciboGroupCode(matchingReciboGroup?.code_centro_costo ?? editing?.geoVictoriaCostCenterCode ?? '');
    setPositionDescription(editing?.positionDescription ?? '');
    setActive(editing?.active ?? true);
    setApplyOpeningClosingRules(editing?.applyOpeningClosingRules ?? true);
    setContractType(editing?.contractType ?? '');
    setWeeklyHours(editing?.weeklyHours !== undefined ? String(editing.weeklyHours) : '0');
    setShiftType(editing?.shiftType ?? 'day');
    setRestDay(String(normalizeRestDay(editing?.restDay)));
    setMainRoleId(editing?.mainRoleId ?? '');
    setMainRoleCode(
      editing?.mainRoleCode ??
        roles.find((role) => role.id === editing?.mainRoleId)?.validCodes[0] ??
        ''
    );
    setDisplayOrder(editing?.displayOrder !== undefined ? String(editing.displayOrder) : '');
  }, [editing, isOpen, roles, currentAreaId, selectedCompanyId, companies]);

  useEffect(() => {
    if (!mainRoleId) {
      setMainRoleCode('');
      return;
    }
    if (!selectedRole) {
      setMainRoleId('');
      setMainRoleCode('');
      return;
    }
    if ((selectedRole.areaId ?? '') !== areaId) {
      setMainRoleId('');
      setMainRoleCode('');
      return;
    }
    if (!codeOptions.includes(mainRoleCode)) {
      setMainRoleCode(codeOptions[0] ?? '');
    }
  }, [areaId, codeOptions, mainRoleCode, mainRoleId, selectedRole]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedCompany?.companyId) {
      setPositions([]);
      return;
    }

    let isMounted = true;
    setIsLoadingPositions(true);

    fetchGeoVictoriaPositions(selectedCompany.companyId)
      .then((data) => {
        if (!isMounted) return;
        setPositions(data);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setPositions([]);
        toast({
          status: 'error',
          title: error instanceof Error ? error.message : 'No se pudieron cargar los cargos.'
        });
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingPositions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedCompany?.companyId, toast]);

  useEffect(() => {
    if (contractType === '') {
      setWeeklyHours('');
    }
  }, [contractType]);

  const isWithoutContract = contractType === '';
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedIdentityDocument = identityDocument.trim();
  const trimmedEmail = email.trim();
  const selectedReciboGroup = selectedCompany?.groups.find((group) => group.code_centro_costo === reciboGroupCode);
  const requiresReciboGroup = Boolean(selectedCompany?.groups.length);
  const hasRequiredErrors = {
    firstName: !trimmedFirstName,
    lastName: !trimmedLastName,
    identityDocument: !trimmedIdentityDocument,
    email: !trimmedEmail,
    companyAlias: !companyAlias,
    reciboGroupCode: requiresReciboGroup && !selectedReciboGroup
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{editing ? 'Editar Colaborador' : 'Nuevo Colaborador'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3}>
            <FormLabel>Orden (planificación)</FormLabel>
            <Input
              type="number"
              min={1}
              step={1}
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
              placeholder="Ej: 1, 2, 3..."
            />
          </FormControl>
          <FormControl mb={3} isRequired>
            <FormLabel>Nombre</FormLabel>
            <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          </FormControl>
          <FormControl mb={3} isRequired>
            <FormLabel>Apellidos</FormLabel>
            <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </FormControl>
          <FormControl mb={3} isRequired>
            <FormLabel>DNI</FormLabel>
            <Input
              value={identityDocument}
              onChange={(event) => setIdentityDocument(event.target.value)}
            />
            <FormLabel mt={1} mb={0} fontSize="xs" fontWeight="400" color="gray.500">
              (*) Si cambias DNI se creará un nuevo usuario GEOVICTORIA
            </FormLabel>
          </FormControl>
          <FormControl mb={3} isRequired>
            <FormLabel>Email</FormLabel>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Celular</FormLabel>
            <Input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Permite la notificación por Whatsapp"
            />
          </FormControl>
          <FormControl mb={3} isRequired>
            <FormLabel>Empresa</FormLabel>
            <Select
              value={companyAlias}
              onChange={(event) => {
                setCompanyAlias(event.target.value);
                setReciboGroupCode('');
              }}
            >
              <option value="">Selecciona una empresa</option>
              {selectableCompanies.map((company) => (
                <option key={company.alias} value={company.alias}>
                  {`${company.alias} - ${company.name}`}
                </option>
              ))}
            </Select>
          </FormControl>
          {requiresReciboGroup ? (
            <FormControl mb={3} isRequired>
              <FormLabel>Grupo Recibo</FormLabel>
              <Select value={reciboGroupCode} onChange={(event) => setReciboGroupCode(event.target.value)}>
                <option value="">Selecciona un grupo</option>
                {selectedCompany?.groups.map((group) => (
                  <option key={group.code_centro_costo} value={group.code_centro_costo}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <FormControl mb={3}>
            <FormLabel>Cargo</FormLabel>
            <Select
              value={positionDescription}
              onChange={(event) => setPositionDescription(event.target.value)}
              isDisabled={!selectedCompany?.companyId || isLoadingPositions}
            >
              <option value="">{isLoadingPositions ? 'Cargando cargos...' : 'Selecciona un cargo'}</option>
              {positions.map((position) => (
                <option key={position.Identifier} value={position.PositionDescription}>
                  {position.PositionDescription}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Área</FormLabel>
            <Select value={areaId} onChange={(event) => setAreaId(event.target.value as AreaId)}>
              <option value="">Sin área</option>
              {areas.map((area) => (
                <option key={area.code} value={area.code}>
                  {area.label}
                </option>
              ))}
            </Select>
          </FormControl>
          <HStack mb={3} align="flex-start" spacing={3}>
            <FormControl flex="1">
              <FormLabel>Zona asignada</FormLabel>
              <Select value={mainRoleId} onChange={(event) => setMainRoleId(event.target.value)}>
                <option value="">Sin zona asignada</option>
                {filteredRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getRoleDisplayLabel(role)}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl flex="1">
              <FormLabel>Código de zona</FormLabel>
              <Select
                value={mainRoleCode}
                onChange={(event) => setMainRoleCode(event.target.value)}
                isDisabled={!selectedRole}
              >
                <option value="">{selectedRole ? 'Selecciona un código' : 'Primero elige una zona'}</option>
                {codeOptions.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </FormControl>
          </HStack>
          <HStack mb={3} align="flex-start" spacing={3}>
            <FormControl flex="1">
              <FormLabel>Tipo de jornada</FormLabel>
              <Select
                value={contractType}
                onChange={(event) => setContractType(event.target.value as 'full-time' | 'part-time' | '')}
              >
                <option value="">Sin contrato</option>
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
              </Select>
            </FormControl>
            <FormControl flex="1" isRequired>
              <FormLabel>Horas semanales</FormLabel>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={weeklyHours}
                onChange={(event) => setWeeklyHours(event.target.value)}
                isDisabled={isWithoutContract}
              />
            </FormControl>
          </HStack>
          <HStack mb={3} align="flex-start" spacing={3}>
            <FormControl flex="1">
              <FormLabel>Turno</FormLabel>
              <Select
                value={contractType === 'full-time' ? 'both' : contractType === '' ? 'none' : shiftType}
                onChange={(event) => {
                  if (event.target.value === 'both' || event.target.value === 'none') return;
                  setShiftType(event.target.value as 'day' | 'night');
                }}
                isDisabled={contractType === 'full-time' || isWithoutContract}
              >
                <option value="none"></option>
                <option value="both">Día/Noche</option>
                <option value="day">Día</option>
                <option value="night">Noche</option>
              </Select>
            </FormControl>
            <FormControl flex="1">
              <FormLabel>Día de descanso</FormLabel>
              <Select
                value={isWithoutContract ? 'none' : restDay}
                onChange={(event) => {
                  if (event.target.value === 'none') return;
                  setRestDay(event.target.value);
                }}
                isDisabled={isWithoutContract}
              >
                <option value="none"></option>
                {WEEKDAY_OPTIONS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </FormControl>
          </HStack>
          <Checkbox isChecked={active} onChange={(event) => setActive(event.target.checked)}>
            Activo
          </Checkbox>
          <FormControl mt={3}>
            <Checkbox
              isChecked={applyOpeningClosingRules}
              onChange={(event) => setApplyOpeningClosingRules(event.target.checked)}
            >
              Aplicar reglas de apertura/cierre
            </Checkbox>
            <FormLabel mt={1} mb={0} fontSize="xs" fontWeight="400" color="gray.500">
              Si está desmarcado, este colaborador no se cuenta para la validaciones de apertura y cierre.
            </FormLabel>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                if (
                  hasRequiredErrors.firstName ||
                  hasRequiredErrors.lastName ||
                  hasRequiredErrors.identityDocument ||
                  hasRequiredErrors.email ||
                  hasRequiredErrors.companyAlias ||
                  hasRequiredErrors.reciboGroupCode
                ) {
                  toast({
                    status: 'error',
                    title: 'Completa todos los campos obligatorios.'
                  });
                  return;
                }
                const parsedWeeklyHours = Number.parseFloat(weeklyHours);
                if (!isWithoutContract && (!Number.isFinite(parsedWeeklyHours) || parsedWeeklyHours <= 0)) {
                  toast({
                    status: 'error',
                    title: 'Horas semanales es obligatorio.'
                  });
                  return;
                }
                const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();
                const selectedGroupDescription = selectedReciboGroup?.name ?? editing?.groupDescription;
                const result = onSave({
                  id: editing?.id ?? createId('emp'),
                  name: fullName,
                  firstName: trimmedFirstName,
                  lastName: trimmedLastName,
                  identityDocument: trimmedIdentityDocument,
                  email: trimmedEmail,
                  moduleCompanyAlias: editing?.moduleCompanyAlias ?? selectedModuleCompany?.alias ?? selectedCompany?.alias,
                  moduleCompanyName: editing?.moduleCompanyName ?? selectedModuleCompany?.name ?? selectedCompany?.name,
                  moduleCompanyId: editing?.moduleCompanyId ?? selectedModuleCompany?.companyId ?? selectedCompany?.companyId,
                  moduleCompanyRuc: editing?.moduleCompanyRuc ?? selectedModuleCompany?.ruc ?? selectedCompany?.ruc,
                  companyAlias: selectedCompany?.alias,
                  companyName: selectedCompany?.name,
                  companyId: selectedCompany?.companyId,
                  companyRuc: selectedCompany?.ruc,
                  geoVictoriaGroupName: selectedReciboGroup?.name,
                  geoVictoriaCostCenterCode: selectedReciboGroup?.code_centro_costo ?? selectedCompany?.ruc,
                  areaId: areaId || undefined,
                  active,
                  weeklyHours: isWithoutContract ? 0 : parsedWeeklyHours,
                  contractType: contractType || undefined,
                  shiftType: contractType === 'part-time' ? shiftType : undefined,
                  restDay: isWithoutContract ? undefined : normalizeRestDay(Number.parseInt(restDay, 10)),
                  notes: editing?.notes,
                  phone: phone.trim() || undefined,
                  mainRoleId: mainRoleId || undefined,
                  mainRoleCode: mainRoleId ? mainRoleCode || undefined : undefined,
                  groupDescription: selectedGroupDescription,
                  positionDescription: positionDescription || undefined,
                  displayOrder: (() => {
                    const parsed = Number.parseInt(displayOrder, 10);
                    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
                  })(),
                  applyOpeningClosingRules
                });
                if (!result.ok) {
                  toast({
                    status: 'error',
                    title: result.error ?? 'No se pudo guardar el colaborador.'
                  });
                  return;
                }
                onClose();
              }}
            >
              Guardar
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
