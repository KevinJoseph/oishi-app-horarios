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
  Text,
  useToast
} from '@chakra-ui/react';
import { useEffect, useState, type FormEvent } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import type { AppUser, UserRole } from '../types/auth';
import type { GeoVictoriaCompany } from '../api/plannerApi';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editingUser?: AppUser;
  companies: GeoVictoriaCompany[];
  onSubmit: (payload: {
    username: string;
    name: string;
    celular?: string | null;
    role: UserRole;
    password?: string;
    companyId?: string | null;
  }) => Promise<void>;
};

export function UserFormModal({ isOpen, onClose, editingUser, companies, onSubmit }: Props): JSX.Element {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [celular, setCelular] = useState('');
  const [role, setRole] = useState<UserRole>('supervisor');
  const [companyId, setCompanyId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setUsername(editingUser?.username ?? '');
    setName(editingUser?.name ?? '');
    setCelular(editingUser?.celular ?? '');
    setRole(editingUser?.role ?? 'supervisor');
    setCompanyId(editingUser?.companyId ?? '');
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

  const handleSubmit = async (event?: FormEvent<HTMLDivElement>): Promise<void> => {
    event?.preventDefault();

    if (!name.trim()) {
      toast({ status: 'error', title: 'El nombre es obligatorio.' });
      return;
    }

    if (!username.trim()) {
      toast({ status: 'error', title: 'El usuario es obligatorio.' });
      return;
    }

    const normalizedCellular = celular.trim();
    if (normalizedCellular.length > 20) {
      toast({ status: 'error', title: 'El celular no puede superar 20 caracteres.' });
      return;
    }

    if (normalizedCellular && !/^[0-9+\-\s()]+$/.test(normalizedCellular)) {
      toast({ status: 'error', title: 'El celular solo puede contener números, espacios, +, - y paréntesis.' });
      return;
    }

    if (!isEditing && password.trim().length < 6) {
      toast({ status: 'error', title: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    if (role === 'administrador' && !companyId.trim()) {
      toast({ status: 'error', title: 'Debe seleccionar una empresa.' });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        username: username.trim(),
        celular: normalizedCellular ? normalizedCellular : null,
        role,
        companyId: role === 'administrador' ? companyId.trim() : null,
        password: password.trim() ? password : undefined
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent as="form" autoComplete="off" onSubmit={(event) => void handleSubmit(event)}>
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
          <FormControl mb={3}>
            <FormLabel>Celular</FormLabel>
            <Input
              value={celular}
              onChange={(event) => setCelular(event.target.value)}
              placeholder="Ej. +51 999 888 777"
              autoComplete="tel"
              name="app-user-celular"
            />
            <Text mt={1} fontSize="xs" color="gray.500">
              Opcional. Se guardará vacío si no lo completas.
            </Text>
          </FormControl>
          <FormControl isRequired mb={3}>
            <FormLabel>Perfil</FormLabel>
            <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="super_administrador">Super Administrador</option>
              <option value="administrador">Administrador</option>
              <option value="supervisor">Supervisor</option>
            </Select>
          </FormControl>
          <FormControl isRequired={role === 'administrador'} mb={3} isDisabled={role !== 'administrador'}>
            <FormLabel>Empresa</FormLabel>
            <Select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">
                {role === 'administrador' ? 'Seleccione una empresa' : 'Acceso a todas las empresas'}
              </option>
              {companies.map((company) => (
                <option key={company.companyId} value={company.companyId}>
                  {company.alias} - {company.name}
                </option>
              ))}
            </Select>
            {role === 'administrador' ? (
              <Text mt={1} fontSize="xs" color="gray.500">
                Este usuario quedará limitado a la empresa seleccionada.
              </Text>
            ) : null}
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
                  type="button"
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
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting}>
              Guardar
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
