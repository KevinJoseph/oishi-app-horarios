import { Tab, TabList, Tabs } from '@chakra-ui/react';
import type { DayPlan } from '../types';

type Props = {
  days: DayPlan[];
  activeIndex: number;
  onChange: (index: number) => void;
};

export function DayTabs({ days, activeIndex, onChange }: Props): JSX.Element {
  return (
    <Tabs index={activeIndex} onChange={onChange} colorScheme="brand" variant="unstyled">
      <TabList overflowX="auto" whiteSpace="nowrap" gap={0} borderBottomWidth="1px" borderColor="blackAlpha.100" bg="gray.50" rounded="md">
        {days.map((day) => (
          <Tab
            key={day.dateISO}
            fontWeight="600"
            px={5}
            py={3}
            borderRadius="0"
            borderBottomWidth="2px"
            borderBottomColor="transparent"
            _selected={{ bg: 'white', color: 'brand.700', fontWeight: '800', borderBottomColor: 'brand.500' }}
          >
            {`${day.dayName} ${new Date(`${day.dateISO}T00:00:00`).getDate()}`}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}
