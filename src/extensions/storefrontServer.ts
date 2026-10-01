import 'server-only'
import type { StorefrontConfig } from '@/utils/storefrontConfig'
import { isExtensionEnabled } from './availability'
import type { StorefrontServerProvider } from './storefrontServerTypes'
import { resolveStorefrontServerProvider } from './storefrontServerCore'
import { STOREFRONT_SERVER_LOADERS } from '@/plugins/storefront-server.generated'

/** Resolve at most one enabled provider for this workspace; failures are explicit. */
export async function getStorefrontServerProvider(config: StorefrontConfig | null): Promise<StorefrontServerProvider | null> {
  const requested = process.env.ENABLED_PLUGINS ?? process.env.NEXT_PUBLIC_ENABLED_PLUGINS
  const enabled = requested?.split(',').map(id => id.trim()).filter(Boolean)
  return resolveStorefrontServerProvider(STOREFRONT_SERVER_LOADERS, config, enabled, id => isExtensionEnabled(id, config?.extensions))
}
