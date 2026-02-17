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
  Textarea
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import type { Employee, Role } from '../types';
import { createId } from '../store/useAppStore';
import { normalizeRestDay, WEEKDAY_OPTIONS } from '../utils/weekdays';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editing?: Employee;
  roles: Role[];
  onSave: (employee: Employee) => void;
};

export function EmployeeFormModal({ isOpen, onClose, editing, roles, onSave }: Props): JSX.Element {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [weeklyHours, setWeeklyHours] = useState('');
  const [contractType, setContractType] = useState<'full-time' | 'part-time' | ''>('full-time');
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [restDay, setRestDay] = useState('0');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [mainRoleId, setMainRoleId] = useState('');

  useEffect(() => {
    const initialContractType =
      editing && (editing.weeklyHours ?? 0) <= 0 ? '' : editing ? editing.contractType ?? '' : 'full-time';
    setName(editing?.name ?? '');
    setActive(editing?.active ?? true);
    setContractType(initialContractType);
    setWeeklyHours(getWeeklyHoursLabelForContract(initialContractType));
    setShiftType(editing?.shiftType ?? 'day');
    setRestDay(String(normalizeRestDay(editing?.restDay)));
    setNotes(editing?.notes ?? '');
    setPhone(editing?.phone ?? '');
    setMainRoleId(editing?.mainRoleId ?? '');
  }, [editing, isOpen]);

  useEffect(() => {
    setWeeklyHours(getWeeklyHoursLabelForContract(contractType));
  }, [contractType]);

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
            <FormLabel>Zona asignada</FormLabel>
            <Select value={mainRoleId} onChange={(event) => setMainRoleId(event.target.value)}>
              <option value="">Sin zona asignada</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <HStack mb={3} align="flex-start" spacing={3}>
            <FormControl flex="1">
              <FormLabel>Tipo de contrato</FormLabel>
              <Select
                value={contractType}
                onChange={(event) => setContractType(event.target.value as 'full-time' | 'part-time' | '')}
              >
                <option value="">Sin contrato</option>
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
              </Select>
            </FormControl>
            <FormControl flex="1">
              <FormLabel>Horas semanales</FormLabel>
              <Input type="number" min={0} step={0.5} value={weeklyHours} isDisabled />
            </FormControl>
          </HStack>
          <FormControl mb={3}>
            <FormLabel>Turno</FormLabel>
            <Select value={shiftType} onChange={(event) => setShiftType(event.target.value as 'day' | 'night')}>
              <option value="day">Día</option>
              <option value="night">Noche</option>
            </Select>
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Día de descanso</FormLabel>
            <Select value={restDay} onChange={(event) => setRestDay(event.target.value)}>
              {WEEKDAY_OPTIONS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </Select>
          </FormControl>
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
                onSave({
                  id: editing?.id ?? createId('emp'),
                  name: name.trim(),
                  active,
                  weeklyHours: getWeeklyHoursForContract(contractType),
                  contractType: contractType || undefined,
                  shiftType: contractType ? shiftType : undefined,
                  restDay: normalizeRestDay(Number.parseInt(restDay, 10)),
                  notes: notes.trim() || undefined,
                  phone: phone.trim() || undefined,
                  mainRoleId: mainRoleId || undefined
                });
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

function getWeeklyHoursForContract(contractType: Employee['contractType'] | ''): number | undefined {
  if (contractType === 'full-time') return 56;
  if (contractType === 'part-time') return 28;
  return 0;
}

function getWeeklyHoursLabelForContract(contractType: Employee['contractType'] | ''): string {
  const hours = getWeeklyHoursForContract(contractType);
  return String(hours);
}
