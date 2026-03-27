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
  Select
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type { Assignment, Role } from '../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  employeeName?: string;
  roles: Role[];
  onSave: (payload: { assignment: Assignment; applyToEmployeeDay: boolean; dayHours?: number }) => void;
};

export function CellEditorModal({ isOpen, onClose, assignment, employeeName, roles, onSave }: Props): JSX.Element {
  const [roleId, setRoleId] = useState<string>('');
  const [code, setCode] = useState<string>('LIBRE');
  const [applyToEmployeeDay, setApplyToEmployeeDay] = useState(false);
  const [dayHours, setDayHours] = useState<string>('0');

  useEffect(() => {
    if (!assignment) return;
    setRoleId(assignment.roleId ?? '');
    setCode(assignment.code);
  }, [assignment]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId), [roles, roleId]);
  const options = selectedRole?.validCodes ?? [];
  const isFree = !roleId;

  useEffect(() => {
    if (isFree) {
      setCode('LIBRE');
      return;
    }
    if (selectedRole && !selectedRole.validCodes.includes(code)) {
      setCode(selectedRole.validCodes[0] ?? '');
    }
  }, [selectedRole, isFree, code]);

  useEffect(() => {
    if (!isOpen) return;
    setApplyToEmployeeDay(false);
    setDayHours('0');
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Editar Celda</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>Zona</FormLabel>
            <Select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">SIN ASIGNAR</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Código</FormLabel>
            <Select value={code} isDisabled={isFree} onChange={(event) => setCode(event.target.value)}>
              {isFree ? <option value="LIBRE">SIN ASIGNAR</option> : options.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </FormControl>
          <FormControl mt={4}>
            <Checkbox isChecked={applyToEmployeeDay} onChange={(event) => setApplyToEmployeeDay(event.target.checked)}>
             Se aplicará a toda la columna(día actual)
            </Checkbox>
          </FormControl>
          {applyToEmployeeDay ? (
            <FormControl mt={4}>
              <FormLabel>Horas a asignar en el día</FormLabel>
              <Input type="number" min={0} step={0.5} value={dayHours} onChange={(event) => setDayHours(event.target.value)} />
            </FormControl>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                onSave({
                  assignment: { roleId: roleId || null, code: roleId ? code : 'LIBRE' },
                  applyToEmployeeDay,
                  dayHours: applyToEmployeeDay ? Math.max(0, Number.parseFloat(dayHours) || 0) : undefined
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
