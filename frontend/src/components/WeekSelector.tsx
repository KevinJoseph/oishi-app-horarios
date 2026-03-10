import { HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildWeekLabel, getWeekNumberInMonth } from '../utils/dates';

export function WeekSelector(): JSX.Element {
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const goToAdjacentWeek = useAppStore((state) => state.goToAdjacentWeek);

  const currentWeekLabel = useMemo(() => {
    if (!currentWeekStartDateISO) return 'Sin semana';
    return buildWeekLabel(new Date(`${currentWeekStartDateISO}T00:00:00`));
  }, [currentWeekStartDateISO]);
  const currentWeekNumberLabel = useMemo(() => {
    if (!currentWeekStartDateISO) return '';
    const weekStartDate = new Date(`${currentWeekStartDateISO}T00:00:00`);
    return `Semana ${getWeekNumberInMonth(weekStartDate)}`;
  }, [currentWeekStartDateISO]);

  return (
    <HStack
      spacing={2}
      px={3}
      py={3}
      borderWidth="1px"
      borderColor="blue.200"
      borderRadius="md"
      bg="white"
      w="100%"
      justify="space-between"
    >
      <IconButton
        aria-label="Semana anterior"
        icon={<FiChevronLeft />}
        variant="ghost"
        colorScheme="blue"
        onClick={() => goToAdjacentWeek(-1)}
      />
      <Stack flex="1" spacing={0} align="center">
        <Text fontSize="xs" fontWeight="600" color="blue.500" textTransform="uppercase" letterSpacing="0.04em">
          {currentWeekNumberLabel}
        </Text>
        <Text textAlign="center" fontWeight="700" color="gray.700" noOfLines={1}>
          {currentWeekLabel}
        </Text>
      </Stack>
      <IconButton
        aria-label="Semana siguiente"
        icon={<FiChevronRight />}
        variant="ghost"
        colorScheme="blue"
        onClick={() => goToAdjacentWeek(1)}
      />
    </HStack>
  );
}
