'use client';

import type { ReactNode } from 'react';
import { Anchor, type AnchorProps } from '@mantine/core';
import { Link } from '@/i18n/routing';

type TextLinkProps = Omit<AnchorProps, 'component' | 'href'> & {
  href: string;
  children: ReactNode;
};

/** Mantine Anchor + next-intl Link. Must be a Client Component so `component={Link}` is not serialized across the RSC boundary. */
export function TextLink({ href, children, ...rest }: TextLinkProps) {
  return (
    <Anchor component={Link} href={href} {...rest}>
      {children}
    </Anchor>
  );
}
