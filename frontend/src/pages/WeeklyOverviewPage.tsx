import { Badge, Box, Card, CardBody, Flex, Heading, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { useEffect } from 'react';
import { DayGrid } from '../components/DayGrid';
import { WeekSelector } from '../components/WeekSelector';
import { useAppStore } from '../store/useAppStore';
import { getOpeningClosingSummary } from '../utils/summary';

export function WeeklyOverviewPage(): JSX.Element {
  const employees = useAppStore((state) => state.employees);
  const roles = useAppStore((state) => state.roles);
  const timeSlots = useAppStore((state) => state.timeSlots);
  const weeks = useAppStore((state) => state.weeks);
  const weekPlans = useAppStore((state) => state.weekPlans);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const ensureWeekPlan = useAppStore((state) => state.ensureWeekPlan);

  const currentWeek = weeks.find((week) => week.id === currentWeekId);
  useEffect(() => {
    if (currentWeek) ensureWeekPlan(currentWeek);
  }, [currentWeek, ensureWeekPlan]);

  const days = currentWeek ? weekPlans[currentWeek.id]?.days ?? [] : [];

  return (
    <Box>
      <Card mb={4}>
        <CardBody>
          <Flex justify="space-between" align="center" gap={3} wrap="wrap">
            <Heading size="md">Vista General Semanal</Heading>
            <WeekSelector />
          </Flex>
        </CardBody>
      </Card>

      {!days.length ? (
        <Card>
          <CardBody>
            <Text color="gray.500">No hay datos para esta semana.</Text>
          </CardBody>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
          {days.map((day) => {
            const summary = getOpeningClosingSummary(day, timeSlots);
            return (
              <Card key={day.dateISO}>
                <CardBody>
                  <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
                    <Heading size="sm">{`${day.dayName} (${day.dateISO})`}</Heading>
                    <HStack>
                      <Badge colorScheme="orange" px={3} py={1} rounded="md">
                        Apertura: {summary.opening}
                      </Badge>
                      <Badge colorScheme="purple" px={3} py={1} rounded="md">
                        Cierre: {summary.closing}
                      </Badge>
                    </HStack>
                  </Flex>
                  <DayGrid
                    dayPlan={day}
                    employees={employees}
                    roles={roles}
                    timeSlots={timeSlots}
                    readOnly
                    compact
                    maxTableHeight="42vh"
                  />
                </CardBody>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}
