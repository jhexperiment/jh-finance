export const QUEUE_NAMES = {
  PRICE_SYNC: 'price-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
