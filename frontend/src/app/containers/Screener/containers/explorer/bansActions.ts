import { theme } from './shared';

export type BansCategory = 'register' | 'list' | 'extend' | 'transfer' | 'delist' | 'buy' | 'deploy' | 'other';

export interface CategoryMeta {
  key: BansCategory;
  label: string;
  color: string;
  /** Swimlane order, top→bottom. */
  laneOrder: number;
}

// Lanes shown in the swimlane, in order. 'deploy' (Create) and 'other' are
// stored/listed but not given a lane.
export const CATEGORIES: CategoryMeta[] = [
  {
    key: 'register',
    label: 'Register',
    color: theme.color.accent,
    laneOrder: 1,
  },
  {
    key: 'list',
    label: 'List',
    color: theme.color.purple,
    laneOrder: 2,
  },
  {
    key: 'extend',
    label: 'Extend',
    color: theme.color.info,
    laneOrder: 3,
  },
  {
    key: 'transfer',
    label: 'Transfer',
    color: theme.color.muted,
    laneOrder: 4,
  },
  {
    key: 'delist',
    label: 'Delist',
    color: theme.color.danger,
    laneOrder: 5,
  },
  {
    key: 'buy',
    label: 'Buy',
    color: theme.color.warn,
    laneOrder: 6,
  },
];

// Pill tone for each category, matching its lane colour above (register accent,
// list purple, extend info, transfer muted, delist danger, buy warn). Categories
// with no lane read as neutral.
export type BansTone = 'accent' | 'info' | 'warn' | 'purple' | 'danger' | 'neutral';
export const CATEGORY_TONE: Record<BansCategory, BansTone> = {
  register: 'accent',
  list: 'purple',
  extend: 'info',
  transfer: 'neutral',
  delist: 'danger',
  buy: 'warn',
  deploy: 'neutral',
  other: 'neutral',
};

/** Map an explorer BANS method string to a category (single source of truth). */
export function methodCategory(method: string): BansCategory {
  switch (method.trim().toLowerCase()) {
    case 'register':
      return 'register';
    case 'set price':
      return 'list';
    case 'extend period':
      return 'extend';
    case 'set owner':
      return 'transfer';
    case 'remove price':
      return 'delist';
    case 'buy':
      return 'buy';
    case 'create':
      return 'deploy';
    default:
      return 'other';
  }
}
