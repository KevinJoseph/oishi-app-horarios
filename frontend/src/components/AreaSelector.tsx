import { useEffect, useMemo, useState } from 'react';
import { Select } from '@chakra-ui/react';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { fetchAllSubAreas, type SubAreaResponse } from '../api/subAreaApi';
import type { AreaId } from '../types';

type Props = {
  maxW?: string | { base?: string; md?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

type Option = { value: string; areaCode: AreaId; label: string };

const SELECTED_SUBAREA_STORAGE_KEY = 'app_horario2_current_subarea';

function readStoredOption(): string | null {
  try {
    return localStorage.getItem(SELECTED_SUBAREA_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeOption(value: string): void {
  try {
    localStorage.setItem(SELECTED_SUBAREA_STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

export function AreaSelector({ maxW = { base: '100%', md: '200px' }, size = 'md' }: Props): JSX.Element {
  const currentAreaId = useAppStore((state) => state.currentAreaId);
  const areas = useAppStore((state) => state.areas);
  const setCurrentArea = useAppStore((state) => state.setCurrentArea);
  const selectedCompanyId = useAuthStore((s) => s.selectedGeoVictoriaCompanyId);

  const [subAreas, setSubAreas] = useState<SubAreaResponse[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | null>(() => readStoredOption());

  useEffect(() => {
    let cancelled = false;
    fetchAllSubAreas(selectedCompanyId)
      .then((data) => {
        if (!cancelled) setSubAreas(data);
      })
      .catch(() => {
        if (!cancelled) setSubAreas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, areas]);

  // Visual only: each sub-area is shown as "Sub (Área)" and selecting it loads its parent area.
  // Areas without sub-areas are still listed by their own label so they remain selectable.
  const options = useMemo<Option[]>(() => {
    const result: Option[] = [];
    for (const area of areas ?? []) {
      const subs = subAreas
        .filter((sub) => sub.areaCode === area.code)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
      if (subs.length === 0) {
        result.push({ value: `area::${area.code}`, areaCode: area.code, label: area.label });
        continue;
      }
      for (const sub of subs) {
        result.push({ value: `sub::${area.code}::${sub.code}`, areaCode: area.code, label: `${sub.label} (${area.label})` });
      }
    }
    return result;
  }, [areas, subAreas]);

  if (!areas || areas.length === 0) {
    return (
      <Select maxW={maxW} size={size} value={currentAreaId} isDisabled>
        <option>Sin áreas</option>
      </Select>
    );
  }

  const value =
    options.find((opt) => opt.value === selectedValue && opt.areaCode === currentAreaId)?.value ??
    options.find((opt) => opt.areaCode === currentAreaId)?.value ??
    '';

  return (
    <Select
      maxW={maxW}
      size={size}
      value={value}
      onChange={(event) => {
        const option = options.find((opt) => opt.value === event.target.value);
        if (!option) return;
        setSelectedValue(option.value);
        storeOption(option.value);
        if (option.areaCode !== currentAreaId) setCurrentArea(option.areaCode);
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}
