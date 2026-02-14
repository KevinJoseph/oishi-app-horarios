import { Select } from '@chakra-ui/react';
import { useAppStore } from '../store/useAppStore';

export function WeekSelector(): JSX.Element {
  const weeks = useAppStore((state) => state.weeks);
  const currentWeekId = useAppStore((state) => state.currentWeekId);
  const setCurrentWeek = useAppStore((state) => state.setCurrentWeek);

  return (
    <Select maxW="340px" value={currentWeekId} onChange={(event) => setCurrentWeek(event.target.value)}>
      {weeks.map((week) => (
        <option key={week.id} value={week.id}>
          {week.label}
        </option>
      ))}
    </Select>
  );
}
