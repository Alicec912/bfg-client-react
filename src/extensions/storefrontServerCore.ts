import type { StorefrontConfig } from '@/utils/storefrontConfig'
import type { StorefrontServerProvider } from './storefrontServerTypes'

export async function resolveStorefrontServerProvider(
  loaders: Record<string, () => Promise<{ default: StorefrontServerProvider }>>,
  config: StorefrontConfig | null,
  enabledPluginIds: string[] | undefined,
  isAvailable: (id: string) => boolean,
): Promise<StorefrontServerProvider | null> {
  const matches: StorefrontServerProvider[] = []
  for (const [id, load] of Object.entries(loaders)) {
    if (enabledPluginIds !== undefined && !enabledPluginIds.includes(id)) continue
    if (!isAvailable(id)) continue
    const provider = (await load()).default
    if (provider.matches(config)) matches.push(provider)
  }
  if (matches.length > 1) throw new Error('Multiple storefront server providers matched this workspace.')
  return matches[0] || null
}
