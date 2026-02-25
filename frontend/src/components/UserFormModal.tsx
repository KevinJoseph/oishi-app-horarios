import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import type { AppUser, UserRole } from '../types/auth';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editingUser?: AppUser;
  onSubmit: (payload: {
    username: string;
    name: string;
    role: UserRole;
    password?: string;
  }) => Promise<void>;
};

export function UserFormModal({ isOpen, onClose, editingUser, onSubmit }: Props): JSX.Element {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('lector');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setUsername(editingUser?.username ?? '');
    setName(editingUser?.name ?? '');
    setRole(editingUser?.role ?? 'lector');
    setPassword('');
    setShowPassword(false);
    setSubmitting(false);
  }, [editingUser, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = window.setTimeout(() => setPassword(''), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  const isEditing = Boolean(editingUser);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent as="form" autoComplete="off">
        <ModalHeader>{isEditing ? 'Editar usuario' : 'Nuevo usuario'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl isRequired mb={3}>
            <FormLabel>Nombre</FormLabel>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </FormControl>
          <FormControl isRequired mb={3}>
            <FormLabel>Usuario</FormLabel>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              name="app-username"
            />
          </FormControl>
          <FormControl isRequired mb={3}>
            <FormLabel>Perfil</FormLabel>
            <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="administrador">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="lector">Lector</option>
            </Select>
          </FormControl>
          <FormControl isRequired={!isEditing}>
            <FormLabel>{isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</FormLabel>
            <InputGroup>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEditing ? 'Solo completar para cambiar' : 'Mínimo 6 caracteres'}
                pr="2.75rem"
                autoComplete="new-password"
                name="app-user-password"
              />
              <InputRightElement>
                <Button
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  variant="ghost"
                  size="sm"
                  minW="auto"
                  h="1.75rem"
                  px={2}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </Button>
              </InputRightElement>
            </InputGroup>
            {isEditing ? (
              <Text mt={1} fontSize="xs" color="gray.500">
                Si la dejas vacía, se mantiene la contraseña actual.
              </Text>
            ) : null}
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              isLoading={submitting}
              onClick={async () => {
                if (!name.trim() || !username.trim()) return;
                if (!isEditing && password.trim().length < 6) return;

                setSubmitting(true);
                try {
                  await onSubmit({
                    name: name.trim(),
                    username: username.trim(),
                    role,
                    password: password.trim() ? password : undefined
                  });
                  onClose();
                } finally {
                  setSubmitting(false);
                }
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
