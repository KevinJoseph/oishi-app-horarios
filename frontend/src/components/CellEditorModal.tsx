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
import { createBreakAssignment, createFreeAssignment, isBreakAssignment } from '../utils/assignments';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  employeeName?: string;
  roles: Role[];
  isCurrentWeek?: boolean;
  isNormalRestDay?: boolean;
  isNormalBreakSlot?: boolean;
  isExceptionalRestDay?: boolean;
  isExceptionalBreak?: boolean;
  onSave: (payload: {
    assignment: Assignment;
    applyToEmployeeDay: boolean;
    dayHours?: number;
    exceptionalRestDay?: boolean;
    exceptionalBreak?: boolean;
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
  isNormalBreakSlot = false,
  isExceptionalRestDay = false,
  isExceptionalBreak = false,
  onSave
}: Props): JSX.Element {
  const [roleId, setRoleId] = useState<string>('');
  const [code, setCode] = useState<string>('LIBRE');
  const [applyToEmployeeDay, setApplyToEmployeeDay] = useState(false);
  const [dayHours, setDayHours] = useState<string>('0');
  const [exRestDay, setExRestDay] = useState(false);
  const [exBreak, setExBreak] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    setRoleId(assignment.roleId ?? '');
    setCode(assignment.code);
    setExBreak(isBreakAssignment(assignment));
  }, [assignment]);

  useEffect(() => {
    if (!isOpen) return;
    setApplyToEmployeeDay(false);
    setDayHours('0');
    setExRestDay(isExceptionalRestDay);
    setExBreak(isExceptionalBreak);
  }, [isExceptionalBreak, isExceptionalRestDay, isOpen]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId), [roles, roleId]);
  const options = selectedRole?.validCodes ?? [];
  const isFree = !roleId || exRestDay || exBreak;

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
  const showExBreakOption = isCurrentWeek;

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
                      setExBreak(false);
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
          {showExBreakOption && (
            <>
              <FormControl mb={4}>
                <Checkbox
                  isChecked={exBreak}
                  colorScheme="yellow"
                  onChange={(event) => {
                    setExBreak(event.target.checked);
                    if (event.target.checked) {
                      setRoleId('');
                      setApplyToEmployeeDay(false);
                      setExRestDay(false);
                    }
                  }}
                >
                  Break excepcional (solo esta celda)
                </Checkbox>
                {exBreak && (
                  <Text fontSize="xs" color="yellow.700" mt={1}>
                    Este bloque se marcará como break manual y no contará como tiempo trabajado.
                  </Text>
                )}
              </FormControl>
              <Divider mb={4} />
            </>
          )}
          {isNormalBreakSlot && !exRestDay ? (
            <Text fontSize="xs" color="gray.600" mb={4}>
              Este bloque pertenece al refrigerio configurado. En planificación puedes sobrescribirlo manualmente con una zona
              o marcarlo como break excepcional para esta celda.
            </Text>
          ) : null}
          <FormControl mb={4} isDisabled={exRestDay || exBreak}>
            <FormLabel>Zona</FormLabel>
            <Select
              value={exRestDay || exBreak ? '' : roleId}
              onChange={(event) => setRoleId(event.target.value)}
              isDisabled={exRestDay || exBreak}
            >
              <option value="">SIN ASIGNAR</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isDisabled={exRestDay || exBreak}>
            <FormLabel>Código</FormLabel>
            <Select
              value={exRestDay || exBreak ? 'LIBRE' : code}
              isDisabled={isFree}
              onChange={(event) => setCode(event.target.value)}
            >
              {isFree ? <option value="LIBRE">SIN ASIGNAR</option> : options.map((item) => <option key={item}>{item}</option>)}
            </Select>
          </FormControl>
          {!exRestDay && !exBreak && (
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
              colorScheme={exRestDay ? 'orange' : exBreak ? 'gray' : 'blue'}
              onClick={() => {
                if (exRestDay || (showExRestDayOption && isExceptionalRestDay && !exRestDay)) {
                  // Cambio en descanso excepcional
                  onSave({
                    assignment: createFreeAssignment(),
                    applyToEmployeeDay: false,
                    exceptionalRestDay: exRestDay
                  });
                } else if (exBreak) {
                  onSave({
                    assignment: createBreakAssignment(),
                    applyToEmployeeDay: false,
                    exceptionalBreak: exBreak
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
