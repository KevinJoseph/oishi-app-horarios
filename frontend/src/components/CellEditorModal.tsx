import {
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
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
  onSave: (payload: { assignment: Assignment; applyToEmployeeDay: boolean }) => void;
};

export function CellEditorModal({ isOpen, onClose, assignment, employeeName, roles, onSave }: Props): JSX.Element {
  const [roleId, setRoleId] = useState<string>('');
  const [code, setCode] = useState<string>('LIBRE');
  const [applyToEmployeeDay, setApplyToEmployeeDay] = useState(false);

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
              <option value="">LIBRE</option>
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
              {isFree ? <option value="LIBRE">LIBRE</option> : options.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </FormControl>
          <FormControl mt={4}>
            <Checkbox isChecked={applyToEmployeeDay} onChange={(event) => setApplyToEmployeeDay(event.target.checked)}>
              Aplicar a toda la columna{employeeName ? ` de ${employeeName}` : ''} (día actual)
            </Checkbox>
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
                onSave({
                  assignment: { roleId: roleId || null, code: roleId ? code : 'LIBRE' },
                  applyToEmployeeDay
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
