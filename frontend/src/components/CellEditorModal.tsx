import {
  Button,
  Checkbox,
  Divider,
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
  Text
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type { Assignment, Role } from '../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  employeeName?: string;
  roles: Role[];
  isCurrentWeek?: boolean;
  isNormalRestDay?: boolean;
  isExceptionalRestDay?: boolean;
  onSave: (payload: {
    assignment: Assignment;
    applyToEmployeeDay: boolean;
    dayHours?: number;
    exceptionalRestDay?: boolean;
  }) => void;
};

export function CellEditorModal({
  isOpen,
  onClose,
  assignment,
  employeeName,
  roles,
  isCurrentWeek = false,
  isNormalRestDay = false,
  isExceptionalRestDay = false,
  onSave
}: Props): JSX.Element {
  const [roleId, setRoleId] = useState<string>('');
  const [code, setCode] = useState<string>('LIBRE');
  const [applyToEmployeeDay, setApplyToEmployeeDay] = useState(false);
  const [dayHours, setDayHours] = useState<string>('0');
  const [exRestDay, setExRestDay] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    setRoleId(assignment.roleId ?? '');
    setCode(assignment.code);
  }, [assignment]);

  useEffect(() => {
    if (!isOpen) return;
    setApplyToEmployeeDay(false);
    setDayHours('0');
    setExRestDay(isExceptionalRestDay);
  }, [isOpen, isExceptionalRestDay]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId), [roles, roleId]);
  const options = selectedRole?.validCodes ?? [];
  const isFree = !roleId || exRestDay;

  useEffect(() => {
    if (isFree) {
      setCode('LIBRE');
      return;
    }
    if (selectedRole && !selectedRole.validCodes.includes(code)) {
      setCode(selectedRole.validCodes[0] ?? '');
    }
  }, [selectedRole, isFree, code]);

  // Mostrar el checkbox de descanso excepcional solo en la semana actual y si no es el día de descanso normal
  const showExRestDayOption = isCurrentWeek && !isNormalRestDay;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Editar Celda{employeeName ? ` — ${employeeName}` : ''}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {showExRestDayOption && (
            <>
              <FormControl mb={4}>
                <Checkbox
                  isChecked={exRestDay}
                  colorScheme="orange"
                  onChange={(event) => {
                    setExRestDay(event.target.checked);
                    if (event.target.checked) {
                      setRoleId('');
                      setApplyToEmployeeDay(false);
                    }
                  }}
                >
                  Día de descanso (solo esta semana)
                </Checkbox>
                {exRestDay && (
                  <Text fontSize="xs" color="orange.600" mt={1}>
                    Este día será el descanso excepcional. El día de descanso habitual quedará libre para trabajar.
                  </Text>
                )}
              </FormControl>
              <Divider mb={4} />
            </>
          )}
          <FormControl mb={4} isDisabled={exRestDay}>
            <FormLabel>Zona</FormLabel>
            <Select value={exRestDay ? '' : roleId} onChange={(event) => setRoleId(event.target.value)} isDisabled={exRestDay}>
              <option value="">SIN ASIGNAR</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isDisabled={exRestDay}>
            <FormLabel>Código</FormLabel>
            <Select value={exRestDay ? 'LIBRE' : code} isDisabled={isFree} onChange={(event) => setCode(event.target.value)}>
              {isFree ? <option value="LIBRE">SIN ASIGNAR</option> : options.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </FormControl>
          {!exRestDay && (
            <>
              <FormControl mt={4}>
                <Checkbox isChecked={applyToEmployeeDay} onChange={(event) => setApplyToEmployeeDay(event.target.checked)}>
                  Se aplicará a toda la columna (día actual)
                </Checkbox>
              </FormControl>
              {applyToEmployeeDay ? (
                <FormControl mt={4}>
                  <FormLabel>Horas a asignar en el día</FormLabel>
                  <Input type="number" min={0} step={0.5} value={dayHours} onChange={(event) => setDayHours(event.target.value)} />
                </FormControl>
              ) : null}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              colorScheme={exRestDay ? 'orange' : 'blue'}
              onClick={() => {
                if (exRestDay || (showExRestDayOption && isExceptionalRestDay && !exRestDay)) {
                  // Cambio en descanso excepcional
                  onSave({
                    assignment: { roleId: null, code: 'LIBRE' },
                    applyToEmployeeDay: false,
                    exceptionalRestDay: exRestDay
                  });
                } else {
                  onSave({
                    assignment: { roleId: roleId || null, code: roleId ? code : 'LIBRE' },
                    applyToEmployeeDay,
                    dayHours: applyToEmployeeDay ? Math.max(0, Number.parseFloat(dayHours) || 0) : undefined
                  });
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
