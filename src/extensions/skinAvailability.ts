import { isExtensionEnabled, type ExtensionAvailability } from './availability'

export type SkinScope = { extensionId: string; workspaceSlugs?: readonly string[] }
export type SkinWorkspace = { workspace_slug?: string; extensions?: ExtensionAvailability | null }

/** Skin selection follows both installation/deployment and workspace consent. */
export function isSkinEnabled(scope: SkinScope | undefined, config: SkinWorkspace | null | undefined): boolean {
  if (!scope) return false
  const deployed = process.env.ENABLED_PLUGINS ?? process.env.NEXT_PUBLIC_ENABLED_PLUGINS
  if (scope.extensionId !== 'builtin' && deployed !== undefined && !deployed.split(',').map(id => id.trim()).includes(scope.extensionId)) return false
  if (scope.extensionId !== 'builtin' && !isExtensionEnabled(scope.extensionId, config?.extensions)) return false
  return !scope.workspaceSlugs || (!!config?.workspace_slug && scope.workspaceSlugs.includes(config.workspace_slug))
}

export function getEffectiveTheme(theme: string | undefined, metadata: Record<string, SkinScope>, config: SkinWorkspace | null | undefined): string {
  return theme && isSkinEnabled(metadata[theme], config) ? theme : 'store'
}
