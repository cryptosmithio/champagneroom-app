/**
 * Generated by orval v6.17.0 🍺
 * Do not edit manually.
 * BitcartCC
 * BitcartCC Merchants API
 * OpenAPI spec version: 0.7.4.1
 */
import type { CreateStoreMetadata } from './createStoreMetadata';
import type { CreateStoreTemplates } from './createStoreTemplates';
import type { StoreCheckoutSettings } from './storeCheckoutSettings';
import type { StorePluginSettings } from './storePluginSettings';
import type { StoreThemeSettings } from './storeThemeSettings';

export interface CreateStore {
  metadata?: CreateStoreMetadata;
  created?: string;
  name: string;
  default_currency?: string;
  email?: string;
  checkout_settings?: StoreCheckoutSettings;
  theme_settings?: StoreThemeSettings;
  email_host?: string;
  email_port?: number;
  email_user?: string;
  email_password?: string;
  email_use_ssl?: boolean;
  wallets: string[];
  notifications?: string[];
  templates?: CreateStoreTemplates;
  plugin_settings?: StorePluginSettings;
}