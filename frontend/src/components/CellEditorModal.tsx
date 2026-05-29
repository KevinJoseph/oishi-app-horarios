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
import type { Assignment, DayOvertime, Role } from '../types';
import { createBreakAssignment, createFreeAssignment, isBreakAssignment } from '../utils/assignments';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  employeeName?: string;
  roles: Role[];
  defaultDayHours?: number;
  isNormalRestDay?: boolean;
  isNormalBreakSlot?: boolean;
  isExceptionalRestDay?: boolean;
  isExceptionalBreak?: boolean;
  overtime?: DayOvertime | null;
  onSave: (payload: {
    assignment: Assignment;
    applyToEmployeeDay: boolean;
    dayHours?: number;
    exceptionalRestDay?: boolean;
    exceptionalBreak?: boolean;
    overtime?: DayOvertime | null;
  }) => void;
};

export function CellEditorModal({
  isOpen,
  onClose,
  assignment,
  employeeName,
  roles,
  defaultDayHours = 0,
  isNormalRestDay = false,
  isNormalBreakSlot = false,
  isExceptionalRestDay = false,
  isExceptionalBreak = false,
  overtime = null,
  onSave
}: Props): JSX.Element {
  const [roleId, setRoleId] = useState<string>('');
  const [code, setCode] = useState<string>('LIBRE');
  const [applyToEmployeeDay, setApplyToEmployeeDay] = useState(false);
  const [dayHours, setDayHours] = useState<string>('0');
  const [exRestDay, setExRestDay] = useState(false);
  const [exBreak, setExBreak] = useState(false);
  const [otBefore, setOtBefore] = useState(false);
  const [otBeforeDuration, setOtBeforeDuration] = useState('01:00');
  const [otBeforeValue, setOtBeforeValue] = useState('50');
  const [otAfter, setOtAfter] = useState(false);
  const [otAfterDuration, setOtAfterDuration] = useState('01:00');
  const [otAfterValue, setOtAfterValue] = useState('50');

  useEffect(() => {
    if (!assignment) return;
    setRoleId(assignment.roleId ?? '');
    setCode(assignment.code);
    setExBreak(isBreakAssignment(assignment));
  }, [assignment]);

  useEffect(() => {
    if (!isOpen) return;
    setApplyToEmployeeDay(false);
    setDayHours(String(defaultDayHours));
    setExRestDay(isExceptionalRestDay);
    setExBreak(isExceptionalBreak);
    setOtBefore(Boolean(overtime?.before));
    setOtBeforeDuration(overtime?.before?.duration ?? '01:00');
    setOtBeforeValue(overtime?.before?.value ?? '50');
    setOtAfter(Boolean(overtime?.after));
    setOtAfterDuration(overtime?.after?.duration ?? '01:00');
    setOtAfterValue(overtime?.after?.value ?? '50');
  }, [defaultDayHours, isExceptionalBreak, isExceptionalRestDay, isOpen, overtime]);

  const buildOvertime = (): DayOvertime | null => {
    const result: DayOvertime = {};
    if (otBefore) result.before = { duration: otBeforeDuration || '00:00', value: otBeforeValue || '0' };
    if (otAfter) result.after = { duration: otAfterDuration || '00:00', value: otAfterValue || '0' };
    return result.before || result.after ? result : null;
  };

  const selectedRole = useMemo(() => roles.find((role) => role.id === roleId), [roles, roleId]);
  const options = selectedRole?.validCodes ?? [];
  const isFree = !roleId || exRestDay || exBreak;
  const shouldShowDayHours = applyToEmployeeDay;

  useEffect(() => {
    if (isFree) {
      setCode('LIBRE');
      return;
    }
    if (selectedRole && !selectedRole.validCodes.includes(code)) {
      setCode(selectedRole.validCodes[0] ?? '');
    }
  }, [selectedRole, isFree, code]);

  const showExRestDayOption = true;
  const showExBreakOption = true;

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
                    {isNormalRestDay
                      ? 'Se restaurará este día como descanso y se limpiarán las asignaciones del colaborador.'
                      : 'Este día será el descanso excepcional. El día de descanso habitual quedará libre para trabajar.'}
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
              {shouldShowDayHours ? (
                <FormControl mt={4}>
                  <FormLabel>{isFree ? 'Horas sin asignar en el día' : 'Horas a asignar en el día'}</FormLabel>
                  <Input type="number" min={0} step={0.5} value={dayHours} onChange={(event) => setDayHours(event.target.value)} />
                </FormControl>
              ) : null}
            </>
          )}
          {!exRestDay && !exBreak && (
            <>
              <Divider my={4} />
              <Text fontSize="sm" fontWeight="700" color="gray.700" mb={2}>
                Horas extra (se aplican a todo el día)
              </Text>
              <FormControl mb={3}>
                <Checkbox
                  isChecked={otBefore}
                  colorScheme="purple"
                  onChange={(event) => setOtBefore(event.target.checked)}
                >
                  Antes del horario habitual
                </Checkbox>
                {otBefore && (
                  <HStack mt={2} spacing={3} align="end">
                    <FormControl>
                      <FormLabel fontSize="xs" mb={1}>
                        Duración (HH:MM)
                      </FormLabel>
                      <Input
                        type="time"
                        size="sm"
                        value={otBeforeDuration}
                        onChange={(event) => setOtBeforeDuration(event.target.value)}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs" mb={1}>
                        Valor HE
                      </FormLabel>
                      <Input
                        type="number"
                        min={0}
                        size="sm"
                        value={otBeforeValue}
                        onChange={(event) => setOtBeforeValue(event.target.value)}
                      />
                    </FormControl>
                  </HStack>
                )}
              </FormControl>
              <FormControl>
                <Checkbox
                  isChecked={otAfter}
                  colorScheme="purple"
                  onChange={(event) => setOtAfter(event.target.checked)}
                >
                  Después del horario habitual
                </Checkbox>
                {otAfter && (
                  <HStack mt={2} spacing={3} align="end">
                    <FormControl>
                      <FormLabel fontSize="xs" mb={1}>
                        Duración (HH:MM)
                      </FormLabel>
                      <Input
                        type="time"
                        size="sm"
                        value={otAfterDuration}
                        onChange={(event) => setOtAfterDuration(event.target.value)}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs" mb={1}>
                        Valor HE
                      </FormLabel>
                      <Input
                        type="number"
                        min={0}
                        size="sm"
                        value={otAfterValue}
                        onChange={(event) => setOtAfterValue(event.target.value)}
                      />
                    </FormControl>
                  </HStack>
                )}
              </FormControl>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Las horas extra se enviarán a GeoVictoria al migrar la semana. El valor HE debe existir previamente en la
                plataforma.
              </Text>
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
                const nextOvertime = buildOvertime();
                if (exRestDay || (showExRestDayOption && isExceptionalRestDay && !exRestDay)) {
                  // Cambio en descanso excepcional: sin horas extra
                  onSave({
                    assignment: createFreeAssignment(),
                    applyToEmployeeDay: false,
                    exceptionalRestDay: exRestDay,
                    overtime: null
                  });
                } else if (exBreak) {
                  onSave({
                    assignment: createBreakAssignment(),
                    applyToEmployeeDay: false,
                    exceptionalBreak: exBreak,
                    overtime: nextOvertime
                  });
                } else {
                  const nextAssignment = roleId ? { roleId, code, explicitFree: false } : createFreeAssignment(true);
                  onSave({
                    assignment: nextAssignment,
                    applyToEmployeeDay,
                    dayHours: shouldShowDayHours ? Math.max(0, Number.parseFloat(dayHours) || 0) : undefined,
                    overtime: nextOvertime
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
