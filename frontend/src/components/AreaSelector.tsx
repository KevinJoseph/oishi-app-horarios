import { Select } from '@chakra-ui/react';
import { useAppStore } from '../store/useAppStore';
import type { AreaId } from '../types';

type Props = {
  maxW?: string | { base?: string; md?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

export function AreaSelector({ maxW = { base: '100%', md: '200px' }, size = 'md' }: Props): JSX.Element {
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const areas = useAppStore((state) => state.areas);
  const setCurrentArea = useAppStore((state) => state.setCurrentArea);

  if (!areas || areas.length === 0) {
    return (
      <Select maxW={maxW} size={size} value={currentAreaId} isDisabled>
        <option>Sin áreas</option>
      </Select>
    );
  }

  return (
    <Select maxW={maxW} size={size} value={currentAreaId} onChange={(event) => setCurrentArea(event.target.value as AreaId)}>
      {areas.map((area) => (
        <option key={area.code} value={area.code}>
          {area.label}
        </option>
      ))}
    </Select>
  );
}
