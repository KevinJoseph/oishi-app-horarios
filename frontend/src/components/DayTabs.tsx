import { Tab, TabList, Tabs } from '@chakra-ui/react';
import type { DayPlan } from '../types';

type Props = {
  days: DayPlan[];
  activeIndex: number;
  onChange: (index: number) => void;
};

export function DayTabs({ days, activeIndex, onChange }: Props): JSX.Element {
  return (
    <Tabs index={activeIndex} onChange={onChange} colorScheme="blue" variant="unstyled">
      <TabList overflowX="auto" whiteSpace="nowrap" gap={1} borderBottomWidth="1px" borderColor="gray.200">
        {days.map((day) => (
          <Tab
            key={day.dateISO}
            fontWeight="600"
            px={3}
            py={2}
            borderRadius="md"
            borderBottomWidth="2px"
            borderBottomColor="transparent"
            _selected={{ bg: 'blue.50', color: 'blue.700', fontWeight: '800', borderBottomColor: 'blue.500' }}
          >
            {day.dayName}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
