import { Tab, TabList, Tabs } from '@chakra-ui/react';
import type { DayPlan } from '../types';

type Props = {
  days: DayPlan[];
  activeIndex: number;
  onChange: (index: number) => void;
};

export function DayTabs({ days, activeIndex, onChange }: Props): JSX.Element {
  return (
    <Tabs index={activeIndex} onChange={onChange} colorScheme="blue" variant="line">
      <TabList overflowX="auto" whiteSpace="nowrap">
        {days.map((day) => (
          <Tab key={day.dateISO}>{day.dayName}</Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
