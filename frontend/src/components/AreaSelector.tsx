import { Select } from '@chakra-ui/react';
import { useAppStore } from '../store/useAppStore';
import type { AreaId } from '../types';

const AREA_OPTIONS: Array<{ id: AreaId; label: string }> = [
  { id: 'salon', label: 'Area Salon' },
  { id: 'cocina', label: 'Area Cocina' },
  { id: 'oficina', label: 'Area Oficina' },
  { id: 'produccion', label: 'Area Produccion' }
];

type Props = {
  maxW?: string | { base?: string; md?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

export function AreaSelector({ maxW = { base: '100%', md: '200px' }, size = 'md' }: Props): JSX.Element {
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const setCurrentArea = useAppStore((state) => state.setCurrentArea);

  return (
    <Select maxW={maxW} size={size} value={currentAreaId} onChange={(event) => setCurrentArea(event.target.value as AreaId)}>
      {AREA_OPTIONS.map((area) => (
        <option key={area.id} value={area.id}>
          {area.label}
        </option>
      ))}
    </Select>
  );
}
