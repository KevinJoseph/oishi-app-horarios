import {
  Badge,
  Box,
  Button,
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
  Text
} from '@chakra-ui/react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Role } from '../types';
import { createId } from '../store/useAppStore';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  editing?: Role;
  onSave: (role: Role) => { ok: boolean; error?: string };
};

export function RoleFormModal({ isOpen, onClose, editing, onSave }: Props): JSX.Element {
  const colorPickerRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#90CDF4');
  const [newCode, setNewCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    setName(editing?.name ?? '');
    setColorHex(editing?.colorHex ?? '#90CDF4');
    setCodes(editing?.validCodes ?? []);
    setNewCode('');
  }, [editing, isOpen]);

  const addCode = (): void => {
    const cleaned = newCode.trim().toUpperCase();
    if (!cleaned || codes.includes(cleaned)) return;
    setCodes([...codes, cleaned]);
    setNewCode('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCode();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{editing ? 'Editar Puesto' : 'Nuevo Puesto'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3} isRequired>
            <FormLabel>Nombre</FormLabel>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </FormControl>
          <FormControl mb={3} isRequired>
            <FormLabel>Color Hex</FormLabel>
            <HStack>
              <Input value={colorHex} onChange={(event) => setColorHex(event.target.value)} />
              <Box
                as="button"
                type="button"
                w={8}
                h={8}
                rounded="md"
                bg={colorHex}
                borderWidth="1px"
                cursor="pointer"
                onClick={() => colorPickerRef.current?.click()}
                aria-label="Seleccionar color"
              />
              <Input
                ref={colorPickerRef}
                type="color"
                value={colorHex}
                onChange={(event) => setColorHex(event.target.value.toUpperCase())}
                position="absolute"
                opacity={0}
                pointerEvents="none"
                w="1px"
                h="1px"
                p={0}
                border={0}
              />
            </HStack>
          </FormControl>
          <FormControl>
            <FormLabel>Códigos válidos</FormLabel>
            <HStack mb={2}>
              <Input
                placeholder="Escribe código y Enter"
                value={newCode}
                onChange={(event) => setNewCode(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <Button onClick={addCode}>Agregar</Button>
            </HStack>
            <HStack wrap="wrap" spacing={2}>
              {codes.map((code) => (
                <Badge key={code} px={2} py={1} rounded="md" cursor="pointer" onClick={() => setCodes(codes.filter((item) => item !== code))}>
                  {code}
                </Badge>
              ))}
            </HStack>
            <Text fontSize="xs" color="gray.500" mt={2}>
              Click en un código para eliminarlo.
            </Text>
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
                const pending = newCode.trim().toUpperCase();
                const nextCodes = pending && !codes.includes(pending) ? [...codes, pending] : codes;
                if (!name.trim() || !nextCodes.length) return;
                const result = onSave({
                  id: editing?.id ?? createId('role'),
                  name: name.trim(),
                  colorHex: colorHex.trim() || '#90CDF4',
                  validCodes: nextCodes
                });
                if (!result.ok) return;
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
