'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';

const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
  headings: { fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}
