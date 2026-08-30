'use client';

import { Chip, Group, Input } from '@mantine/core';
import { useTranslations } from 'next-intl';

import { MATERIAL_SOURCES, type MaterialSource } from '@/lib/materials';

type Props = {
  value: MaterialSource[];
  onChange: (value: MaterialSource[]) => void;
};

export function SourceCategoryFilter({ value, onChange }: Props) {
  const t = useTranslations('Materials');

  return (
    <Input.Wrapper label={t('sourceFilter')}>
      <Chip.Group multiple value={value} onChange={(next) => onChange(next as MaterialSource[])}>
        <Group gap="xs" mt={6} wrap="wrap">
          {MATERIAL_SOURCES.map((source) => (
            <Chip key={source} value={source} variant="light">
              {t(`badge.${source}`)}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Input.Wrapper>
  );
}
