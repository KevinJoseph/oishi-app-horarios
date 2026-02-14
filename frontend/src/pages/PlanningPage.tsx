import { Badge, Box, Button, Card, CardBody, Flex, HStack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { CellEditorModal } from '../components/CellEditorModal';
import { DayGrid } from '../components/DayGrid';
import { DayTabs } from '../components/DayTabs';
import { EmployeeProfileDrawer } from '../components/EmployeeProfileDrawer';
import { LegendDrawer } from '../components/LegendDrawer';
import { WeekSelector } from '../components/WeekSelector';
import { useAppStore } from '../store/useAppStore';
import type { Assignment } from '../types';
import { getOpeningClosingSummary } from '../utils/summary';

type SelectedCell = {
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
} | null;

export function PlanningPage(): JSX.Element {
  const toast = useToast();
  const { isOpen: isLegendOpen, onOpen: openLegend, onClose: closeLegend } = useDisclosure();
  const { isOpen: isProfileOpen, onOpen: openProfile, onClose: closeProfile } = useDisclosure();
  const { isOpen: isEditorOpen, onOpen: openEditor, onClose: closeEditor } = useDisclosure();

  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const timeSlots = useAppStore((state) => state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);
  const updateAssignment = useAppStore((state) => state.updateAssignment);
  const updateEmployeeDayAssignments = useAppStore((state) => state.updateEmployeeDayAssignments);
  const resetAll = useAppStore((state) => state.resetAll);

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const currentWeek = weeks.find((week) => week.id === currentWeekId);
  useEffect(() => {
    if (currentWeek) ensureWeekPlan(currentWeek);
  }, [currentWeek, ensureWeekPlan]);

  const currentWeekPlan = currentWeek ? weekPlans[currentWeek.id] : undefined;
  const days = currentWeekPlan?.days ?? [];
  const activeDay = days[activeDayIndex];
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const summary = activeDay ? getOpeningClosingSummary(activeDay, timeSlots) : { opening: 0, closing: 0 };

  useEffect(() => {
    setActiveDayIndex(0);
  }, [currentWeekId]);

  const activeEmployeesCount = useMemo(() => employees.filter((employee) => employee.active).length, [employees]);

  return (
    <Box>
      <Card mb={4}>
        <CardBody>
          <Flex justify="space-between" gap={3} wrap="wrap">
            <HStack>
              <WeekSelector />
              <Button onClick={openLegend}>Leyenda</Button>
            </HStack>
            <HStack>
              <Badge colorScheme="green" px={3} py={1} rounded="md">
                Activos: {activeEmployeesCount}
              </Badge>
              <Button colorScheme="red" variant="outline" onClick={resetAll}>
                Borrar Planificación
              </Button>
            </HStack>
          </Flex>
        </CardBody>
      </Card>

      {!activeDay ? (
        <Card>
          <CardBody>
            <Text color="gray.500">No hay datos para esta semana.</Text>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <DayTabs days={days} activeIndex={activeDayIndex} onChange={setActiveDayIndex} />
            <Box mt={4}>
              <DayGrid
                dayPlan={activeDay}
                employees={employees}
                roles={roles}
                timeSlots={timeSlots}
                onCellClick={(cell) => {
                  setSelectedCell(cell);
                  openEditor();
                }}
                onEmployeeClick={(employeeId) => {
                  setSelectedEmployeeId(employeeId);
                  openProfile();
                }}
              />
            </Box>
            <HStack mt={4}>
              <Badge colorScheme="orange" px={3} py={1} rounded="md">
                Apertura: {summary.opening}
              </Badge>
              <Badge colorScheme="purple" px={3} py={1} rounded="md">
                Cierre: {summary.closing}
              </Badge>
            </HStack>
          </CardBody>
        </Card>
      )}

      <LegendDrawer isOpen={isLegendOpen} onClose={closeLegend} roles={roles} />
      <EmployeeProfileDrawer isOpen={isProfileOpen} onClose={closeProfile} employee={selectedEmployee} roles={roles} />
      <CellEditorModal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        assignment={selectedCell?.assignment ?? null}
        employeeName={employees.find((employee) => employee.id === selectedCell?.employeeId)?.name}
        roles={roles}
        onSave={({ assignment, applyToEmployeeDay }) => {
          if (!selectedCell || !activeDay || !currentWeek) return;
          const result = applyToEmployeeDay
            ? updateEmployeeDayAssignments({
                weekId: currentWeek.id,
                dateISO: activeDay.dateISO,
                employeeId: selectedCell.employeeId,
                assignment,
                timeSlotIds: timeSlots.map((slot) => slot.id)
              })
            : updateAssignment({
                weekId: currentWeek.id,
                dateISO: activeDay.dateISO,
                timeSlotId: selectedCell.timeSlotId,
                employeeId: selectedCell.employeeId,
                assignment
              });
          if (!result.ok) {
            toast({ status: 'error', title: result.error ?? 'No se pudo guardar.' });
          }
        }}
      />
    </Box>
  );
}
