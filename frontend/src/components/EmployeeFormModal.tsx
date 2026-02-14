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
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [mainRoleId, setMainRoleId] = useState('');

  useEffect(() => {
    setName(editing?.name ?? '');
    setActive(editing?.active ?? true);
    setNotes(editing?.notes ?? '');
    setPhone(editing?.phone ?? '');
    setMainRoleId(editing?.mainRoleId ?? '');
  }, [editing, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{editing ? 'Editar Empleado' : 'Nuevo Empleado'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3} isRequired>
            <FormLabel>Nombre</FormLabel>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </FormControl>
          <FormControl mb={3}>
            <FormLabel>Rol Principal</FormLabel>
            <Select value={mainRoleId} onChange={(event) => setMainRoleId(event.target.value)}>
              <option value="">Sin rol principal</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
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
