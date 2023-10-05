/**
 * Generated by orval v6.17.0 🍺
 * Do not edit manually.
 * BitcartCC
 * BitcartCC Merchants API
 * OpenAPI spec version: 0.7.4.1
 */
import type { RefundMetadata } from './refundMetadata';

export interface Refund {
  metadata?: RefundMetadata;
  created?: string;
  amount: number;
  currency: string;
  wallet_id: string;
  invoice_id: string;
  id: string;
  destination?: string;
  user_id: string;
  wallet_currency?: string;
  invoice_id?: string;
  payout_status?: string;
  payout_id?: string;
  tx_hash?: string;
}