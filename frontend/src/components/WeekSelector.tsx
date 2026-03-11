import { HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildRelativeWeekLabel, buildWeekLabel } from '../utils/dates';

type Props = {
  compact?: boolean;
};

export function WeekSelector({ compact = false }: Props): JSX.Element {
  const currentWeekStartDateISO = useAppStore((state) => state.currentWeekStartDateISO);
  const goToAdjacentWeek = useAppStore((state) => state.goToAdjacentWeek);

  const currentWeekLabel = useMemo(() => {
    if (!currentWeekStartDateISO) return 'Sin semana';
    return buildWeekLabel(new Date(`${currentWeekStartDateISO}T00:00:00`));
  }, [currentWeekStartDateISO]);
  const currentWeekRelativeLabel = useMemo(() => {
    if (!currentWeekStartDateISO) return '';
    const weekStartDate = new Date(`${currentWeekStartDateISO}T00:00:00`);
    return buildRelativeWeekLabel(weekStartDate);
  }, [currentWeekStartDateISO]);

  return (
    <HStack
      spacing={compact ? 1 : 2}
      px={compact ? 2 : 2}
      py={compact ? 2 : 2}
      borderWidth="1px"
      borderColor="blue.200"
      borderRadius="md"
      bg="white"
      w={compact ? 'auto' : '100%'}
      minW={compact ? '280px' : undefined}
      maxW={compact ? '320px' : undefined}
      justify="space-between"
    >
      <IconButton
        aria-label="Semana anterior"
        icon={<FiChevronLeft />}
        variant="ghost"
        colorScheme="blue"
        size="sm"
        minW={compact ? '32px' : '34px'}
        h={compact ? '32px' : '34px'}
        onClick={() => goToAdjacentWeek(-1)}
      />
      {compact ? (
        <Text
          flex="1"
          textAlign="center"
          fontWeight="600"
          color="gray.700"
          fontSize="xs"
          noOfLines={1}
          whiteSpace="nowrap"
        >
          {currentWeekRelativeLabel ? `${currentWeekRelativeLabel} · ${currentWeekLabel}` : currentWeekLabel}
        </Text>
      ) : (
        <Stack flex="1" spacing={0} align="center">
          <Text
            fontSize="11px"
            fontWeight="600"
            color="blue.500"
            textTransform="uppercase"
            letterSpacing="0.04em"
            lineHeight="1.1"
            noOfLines={1}
          >
            {currentWeekRelativeLabel}
          </Text>
          <Text textAlign="center" fontWeight="700" color="gray.700" noOfLines={1} fontSize="sm">
            {currentWeekLabel}
          </Text>
        </Stack>
      )}
      <IconButton
        aria-label="Semana siguiente"
        icon={<FiChevronRight />}
        variant="ghost"
        colorScheme="blue"
        size="sm"
        minW={compact ? '32px' : '34px'}
        h={compact ? '32px' : '34px'}
        onClick={() => goToAdjacentWeek(1)}
      />
    </HStack>
  );
}
