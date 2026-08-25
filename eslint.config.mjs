import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

/** Root flat config for non-Next packages (shared, worker). Web uses apps/web/eslint.config.mjs */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.specify/**',
      '**/payload-types.ts',
      '**/importMap.js',
      'apps/web/**',
    ],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);
