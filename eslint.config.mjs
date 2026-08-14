import nuriaConfig from '@nuria-tech/eslint-config'

export default [
  { ignores: ['**/dist/**', '**/.aws-sam/**', '**/coverage/**'] },
  ...nuriaConfig,
]
