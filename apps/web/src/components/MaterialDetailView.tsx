import { Anchor, Badge, Box, Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { SourceBadge } from '@/components/SourceBadge';
import { SUMMARY_SECTION_KEYS, type MaterialDetail, type SummarySectionKey } from '@/lib/materials';

type Props = {
  detail: MaterialDetail;
  locale: string;
};

export async function MaterialDetailView({ detail, locale }: Props) {
  const t = await getTranslations('Publication');
  const tMaterials = await getTranslations('Materials');
  const isHigh = detail.importance === 'high';
  const isTrial = detail.source === 'trials' || detail.studyCategory === 'trialRegistration';
  const recruitmentStatus = detail.trial?.recruitmentStatus;
  const isPreResultsTrial =
    isTrial &&
    (!recruitmentStatus ||
      recruitmentStatus === 'recruiting' ||
      recruitmentStatus === 'notYetRecruiting');
  const dateLabel = detail.date
    ? new Date(detail.date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const originalAria = `${t('originalLink')} ${tMaterials('opensInNewTab')}`;
  const trial = detail.trial;
  const eligibilityParts: string[] = [];
  if (trial?.minimumAge || trial?.maximumAge) {
    eligibilityParts.push([trial.minimumAge, trial.maximumAge].filter(Boolean).join(' – '));
  }
  if (trial?.sex) {
    eligibilityParts.push(t(`trialSex.${trial.sex}`));
  }
  const refs = detail.referenceIds;

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <Box
        py="md"
        px="sm"
        style={{
          borderLeft: isHigh ? '3px solid var(--mantine-color-teal-5)' : '3px solid transparent',
          background: isHigh ? 'var(--mantine-color-teal-light)' : undefined,
          borderRadius: 'var(--mantine-radius-sm)',
        }}
      >
        <Stack gap="xs">
          <Group gap="sm" wrap="wrap">
            <SourceBadge source={detail.source} />
            {detail.studyCategory ? (
              <Badge variant="outline" color="gray" size="sm">
                {tMaterials(`studyCategory.${detail.studyCategory}`)}
              </Badge>
            ) : null}
            {isPreResultsTrial ? (
              <Text size="xs" c="dimmed">
                {t('trialLabel')}
              </Text>
            ) : null}
            {isHigh ? (
              <Text size="xs" c="dimmed" fw={500}>
                {tMaterials('highImportance')}
              </Text>
            ) : null}
            {dateLabel ? (
              <Text size="xs" c="dimmed">
                {dateLabel}
              </Text>
            ) : null}
          </Group>
          <Title order={1}>{detail.title}</Title>
          {detail.originalUrl ? (
            <Anchor
              href={detail.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={originalAria}
              w="fit-content"
            >
              {t('originalLink')}
            </Anchor>
          ) : null}
        </Stack>
      </Box>

      {detail.isFallback ? (
        <Text size="xs" c="dimmed" fs="italic">
          {tMaterials('fallbackNote')}
        </Text>
      ) : null}

      {SUMMARY_SECTION_KEYS.map((key: SummarySectionKey) => {
        const body = detail.summary[key];
        if (!body) return null;
        const isWhy = key === 'whyItMatters';
        return (
          <Box
            key={key}
            p={isWhy ? 'sm' : undefined}
            style={
              isWhy
                ? {
                    borderLeft: '3px solid var(--mantine-color-teal-6)',
                    background: 'var(--mantine-color-gray-0)',
                    borderRadius: 'var(--mantine-radius-sm)',
                  }
                : undefined
            }
          >
            <Stack gap={4}>
              <Title order={3}>{t(key)}</Title>
              <Text>{body}</Text>
            </Stack>
          </Box>
        );
      })}

      {trial ? (
        <Box
          p="sm"
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        >
          <Stack gap="xs">
            <Title order={3} size="h4">
              {t('trialInfoHeading')}
            </Title>
            {trial.recruitmentStatus ? (
              <Group gap="xs" wrap="wrap">
                <Text size="sm" fw={500}>
                  {t('trialStatusLabel')}:
                </Text>
                <Badge
                  variant="light"
                  color={trial.recruitmentStatus === 'recruiting' ? 'teal' : 'gray'}
                  size="sm"
                >
                  {tMaterials(`recruitment.${trial.recruitmentStatus}`)}
                </Badge>
              </Group>
            ) : null}
            {trial.phases.length > 0 ? (
              <Text size="sm">
                <Text component="span" fw={500}>
                  {t('trialPhaseLabel')}:
                </Text>{' '}
                {trial.phases.join(', ')}
              </Text>
            ) : null}
            {eligibilityParts.length > 0 ? (
              <Text size="sm">
                <Text component="span" fw={500}>
                  {t('trialEligibilityLabel')}:
                </Text>{' '}
                {eligibilityParts.join(' · ')}
              </Text>
            ) : null}
            {trial.countries.length > 0 ? (
              <Text size="sm">
                <Text component="span" fw={500}>
                  {t('trialCountriesLabel')}:
                </Text>{' '}
                {trial.countries.join(', ')}
              </Text>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      {refs ? (
        <Box
          p="xs"
          px="sm"
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        >
          <Group gap="md" wrap="wrap">
            <Text size="xs" fw={600} c="dimmed">
              {t('forYourDoctorHeading')}:
            </Text>
            {refs.pmid ? (
              <Text size="xs" c="dimmed">
                PMID: {refs.pmid}
              </Text>
            ) : null}
            {refs.doi ? (
              <Text size="xs" c="dimmed">
                DOI: {refs.doi}
              </Text>
            ) : null}
            {refs.nctId ? (
              <Text size="xs" c="dimmed">
                ClinicalTrials.gov: {refs.nctId}
              </Text>
            ) : null}
          </Group>
        </Box>
      ) : null}

      {detail.abstractOrBody ? (
        <Stack gap={4}>
          <Title order={3}>{t('abstractHeading')}</Title>
          {detail.abstractIsFallback ? (
            <Text size="xs" c="dimmed" fs="italic">
              {tMaterials('fallbackNote')}
            </Text>
          ) : null}
          <Text style={{ whiteSpace: 'pre-wrap' }}>{detail.abstractOrBody}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
