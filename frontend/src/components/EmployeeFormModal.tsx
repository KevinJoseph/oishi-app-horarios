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
  Textarea,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type { AreaId, Employee, Role } from '../types';
import { createId } from '../store/useAppStore';
import { normalizeRestDay, WEEKDAY_OPTIONS } from '../utils/weekdays';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editing?: Employee;
  roles: Role[];
  currentAreaId: AreaId;
  onSave: (employee: Employee) => { ok: boolean; error?: string };
};

export function EmployeeFormModal({ isOpen, onClose, editing, roles, currentAreaId, onSave }: Props): JSX.Element {
  const toast = useToast();
  const [areaId, setAreaId] = useState<AreaId>('salon');
  const [name, setName] = useState('');
  const [identityDocument, setIdentityDocument] = useState('');
  const [active, setActive] = useState(true);
  const [weeklyHours, setWeeklyHours] = useState('');
  const [contractType, setContractType] = useState<'full-time' | 'part-time' | ''>('');
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [restDay, setRestDay] = useState('0');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [mainRoleId, setMainRoleId] = useState('');
  const filteredRoles = useMemo(
    () => roles.filter((role) => (role.areaId ?? 'salon') === areaId),
    [roles, areaId]
  );

  useEffect(() => {
    const initialArea = (editing
      ? editing?.areaId ?? roles.find((role) => role.id === editing?.mainRoleId)?.areaId ?? 'salon'
      : currentAreaId ?? 'salon') as AreaId;
    setAreaId(initialArea);
    setName(editing?.name ?? '');
    setIdentityDocument(editing?.identityDocument ?? '');
    setActive(editing?.active ?? true);
    setContractType(editing?.contractType ?? '');
    setWeeklyHours(editing?.weeklyHours !== undefined ? String(editing.weeklyHours) : '0');
    setShiftType(editing?.shiftType ?? 'day');
    setRestDay(String(normalizeRestDay(editing?.restDay)));
    setNotes(editing?.notes ?? '');
    setPhone(editing?.phone ?? '');
    setMainRoleId(editing?.mainRoleId ?? '');
  }, [editing, isOpen, roles, currentAreaId]);

  useEffect(() => {
    if (!mainRoleId) return;
    const selectedRole = roles.find((role) => role.id === mainRoleId);
    if (!selectedRole) return;
    if ((selectedRole.areaId ?? 'salon') !== areaId) {
      setMainRoleId('');
    }
  }, [areaId, mainRoleId, roles]);

  useEffect(() => {
    if (contractType === '') {
      setWeeklyHours('');
    }
  }, [contractType]);

  const isWithoutContract = contractType === '';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{editing ? 'Editar Colaborador' : 'Nuevo Colaborador'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3} isRequired>
            <FormLabel>Nombre</FormLabel>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Documento de Identidad</FormLabel>
            <Input value={identityDocument} onChange={(event) => setIdentityDocument(event.target.value)} />
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Área</FormLabel>
            <Select
              value={areaId}
              onChange={(event) => setAreaId(event.target.value as AreaId)}
              isDisabled={!editing}
            >
              <option value="salon">Salón</option>
              <option value="cocina">Cocina</option>
              <option value="oficina">Oficina</option>
              <option value="produccion">Producción</option>
            </Select>
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Zona asignada</FormLabel>
            <Select value={mainRoleId} onChange={(event) => setMainRoleId(event.target.value)}>
              <option value="">Sin zona asignada</option>
              {filteredRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormControl>
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
          <FormControl mb={3}>
            <FormLabel>Teléfono</FormLabel>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Notas</FormLabel>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormControl>
          <Checkbox isChecked={active} onChange={(event) => setActive(event.target.checked)}>
            Activo
          </Checkbox>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                if (!name.trim()) return;
                const parsedWeeklyHours = Number.parseFloat(weeklyHours);
                if (!isWithoutContract && (!Number.isFinite(parsedWeeklyHours) || parsedWeeklyHours <= 0)) {
                  toast({
                    status: 'error',
                    title: 'Horas semanales es obligatorio.'
                  });
                  return;
                }
                const result = onSave({
                  id: editing?.id ?? createId('emp'),
                  name: name.trim(),
                  identityDocument: identityDocument.trim() || undefined,
                  areaId,
                  active,
                  weeklyHours: isWithoutContract ? 0 : parsedWeeklyHours,
                  contractType: contractType || undefined,
                  shiftType: contractType === 'part-time' ? shiftType : undefined,
                  restDay: isWithoutContract ? undefined : normalizeRestDay(Number.parseInt(restDay, 10)),
                  notes: notes.trim() || undefined,
                  phone: phone.trim() || undefined,
                  mainRoleId: mainRoleId || undefined,
                  groupDescription: editing?.groupDescription,
                  positionDescription: editing?.positionDescription
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
