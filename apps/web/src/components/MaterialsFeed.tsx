'use client';

import { Button, Stack, Text } from '@mantine/core';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { HighImportanceSwitch } from '@/components/HighImportanceSwitch';
import { MaterialCard } from '@/components/MaterialCard';
import { MaterialSearchInput } from '@/components/MaterialSearchInput';
import { SourceCategoryFilter } from '@/components/SourceCategoryFilter';
import {
  filterMaterials,
  MATERIAL_SOURCES,
  resolveEmptyState,
  type Material,
  type MaterialSource,
} from '@/lib/materials';

type Props = {
  materials: Material[];
  locale: string;
};

function parseSources(raw: string | null): MaterialSource[] {
  if (!raw) return [];
  const allowed = new Set<string>(MATERIAL_SOURCES);
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is MaterialSource => allowed.has(s));
}

export function MaterialsFeed({ materials, locale }: Props) {
  const t = useTranslations('Materials');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const sources = useMemo(() => parseSources(searchParams.get('sources')), [searchParams]);
  const important = searchParams.get('important') === '1';

  const pushState = useCallback(
    (next: { q: string; sources: MaterialSource[]; important: boolean }) => {
      const params = new URLSearchParams();
      if (next.q.trim()) params.set('q', next.q.trim());
      if (next.sources.length > 0) params.set('sources', next.sources.join(','));
      if (next.important) params.set('important', '1');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const filtered = useMemo(
    () => filterMaterials(materials, { q, sources, important }),
    [materials, q, sources, important],
  );

  const emptyState = resolveEmptyState(materials.length, filtered.length);
  const controlsDisabled = materials.length === 0;

  if (controlsDisabled) {
    return (
      <Stack gap="md">
        <Text>{t('emptyProject')}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Stack gap="sm">
        <MaterialSearchInput
          value={q}
          onChange={(value) => pushState({ q: value, sources, important })}
        />
        <SourceCategoryFilter
          value={sources}
          onChange={(value) => pushState({ q, sources: value, important })}
        />
        <HighImportanceSwitch
          checked={important}
          onChange={(value) => pushState({ q, sources, important: value })}
        />
      </Stack>

      <Text size="sm" c="dimmed" aria-live="polite" aria-atomic="true">
        {t('visibleCount', { count: filtered.length })}
      </Text>

      {emptyState === 'no-matches' ? (
        <Stack gap="xs">
          <Text>{t('noMatches')}</Text>
          <Button
            variant="light"
            size="xs"
            w="fit-content"
            onClick={() => pushState({ q: '', sources: [], important: false })}
          >
            {t('clearFilters')}
          </Button>
        </Stack>
      ) : (
        <Stack gap="sm">
          {filtered.map((material) => (
            <MaterialCard key={material.id} material={material} locale={locale} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
