/**
 * Generated by orval v6.17.0 🍺
 * Do not edit manually.
 * BitcartCC
 * BitcartCC Merchants API
 * OpenAPI spec version: 0.7.4.1
 */
import type { TokenMetadata } from './tokenMetadata';

export interface Token {
  metadata?: TokenMetadata;
  created?: string;
  app_id?: string;
  redirect_url?: string;
  permissions?: string[];
  user_id: string;
  id: string;
}