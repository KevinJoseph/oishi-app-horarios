import {
  Button,
  FormControl,
  FormHelperText,
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
  Textarea,
  useToast
} from '@chakra-ui/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/http';
import { createTicket } from '../api/ticketsApi';
import { useAuthStore } from '../store/useAuthStore';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const APPLICATION_NAME = 'Sistema de Gestion de Horarios';

function splitFullName(name: string | undefined): { firstName: string; lastName: string } {
  if (!name?.trim()) {
    return { firstName: '', lastName: '' };
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join('')
  };
}

export function TicketReportModal({ isOpen, onClose }: Props): JSX.Element {
  const toast = useToast();
  const currentUser = useAuthStore((state) => state.currentUser);
  const defaultName = useMemo(() => splitFullName(currentUser?.name), [currentUser?.name]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFirstName(defaultName.firstName);
    setLastName(defaultName.lastName);
    setEmail('');
    setPhone('');
    setSubject('');
    setDescription('');
    setSubmitting(false);
  }, [defaultName.firstName, defaultName.lastName, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();

    if (!firstName.trim()) {
      toast({ status: 'error', title: 'El nombre es obligatorio.' });
      return;
    }

    if (!lastName.trim()) {
      toast({ status: 'error', title: 'El apellido es obligatorio.' });
      return;
    }

    if (!email.trim()) {
      toast({ status: 'error', title: 'El correo es obligatorio.' });
      return;
    }

    if (!phone.trim()) {
      toast({ status: 'error', title: 'El telefono es obligatorio.' });
      return;
    }

    if (!subject.trim()) {
      toast({ status: 'error', title: 'El asunto es obligatorio.' });
      return;
    }

    if (!description.trim()) {
      toast({ status: 'error', title: 'La descripcion es obligatoria.' });
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await createTicket({
        application: APPLICATION_NAME,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        description: description.trim()
      });

      toast({
        status: 'success',
        title: 'Incidencia registrada.',
        description: ticket._id ? `Ticket ${ticket._id} creado correctamente.` : 'El equipo de soporte ya recibio el reporte.'
      });
      onClose();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No se pudo registrar la incidencia.';
      toast({
        status: 'error',
        title: 'Error al enviar el reporte.',
        description: message
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent as="form" onSubmit={(event) => void handleSubmit(event)}>
        <ModalHeader>Reportar incidencia</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={2}>
          <FormControl isDisabled mb={4}>
            <FormLabel>Aplicacion</FormLabel>
            <Input value={APPLICATION_NAME} readOnly />
            <FormHelperText>Se enviara con el formato requerido por la mesa de ayuda.</FormHelperText>
          </FormControl>
          <HStack align="start" spacing={4} mb={4} flexDirection={{ base: 'column', md: 'row' }}>
            <FormControl isRequired>
              <FormLabel>Nombres</FormLabel>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Apellidos</FormLabel>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </FormControl>
          </HStack>
          <HStack align="start" spacing={4} mb={4} flexDirection={{ base: 'column', md: 'row' }}>
            <FormControl isRequired>
              <FormLabel>Correo</FormLabel>
              <Input
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Telefono</FormLabel>
              <Input
                placeholder="999999999"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormControl>
          </HStack>
          <FormControl isRequired mb={4}>
            <FormLabel>Asunto</FormLabel>
            <Input
              placeholder="Ej. Error al iniciar sesion"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Descripcion</FormLabel>
            <Textarea
              minH="140px"
              resize="vertical"
              placeholder="Describe el problema, cuando ocurrio y como reproducirlo."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting}>
              Enviar incidencia
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
