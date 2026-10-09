import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  {ignores:['dist/**','node_modules/**','.data/**','artifacts/**','playwright-report/**','test-results/**','docs/**']},
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_',caughtErrors:'none'}]}},
  {files:['scripts/*.mjs','*.config.mjs'],languageOptions:{globals:{console:'readonly',process:'readonly',Buffer:'readonly',URL:'readonly',fetch:'readonly',AbortSignal:'readonly'}}}
);
