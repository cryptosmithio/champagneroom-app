/**
 * Generated by orval v6.17.0 🍺
 * Do not edit manually.
 * BitcartCC
 * BitcartCC Merchants API
 * OpenAPI spec version: 0.7.4.1
 */
import type { NotificationMetadata } from './notificationMetadata';
import type { NotificationData } from './notificationData';

export interface Notification {
  metadata?: NotificationMetadata;
  created?: string;
  name: string;
  provider: string;
  data: NotificationData;
  id?: string;
  user_id: string;
}