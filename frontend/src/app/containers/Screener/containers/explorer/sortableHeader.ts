import type React from 'react';

export type SortDirection = 'asc' | 'desc';

/**
 * Props that make a clickable sortable `<th>` keyboard-operable without changing
 * how it looks: focusable, Enter / Space sorts, and aria-sort tells assistive
 * tech which column is sorted and how. Keeps the cell's columnheader role —
 * aria-sort is only valid there.
 *
 * `sorted` is the direction when this column is the sorted one, else null.
 */
export function sortableHeader(
  sorted: SortDirection | null,
  onSort: () => void,
): React.ThHTMLAttributes<HTMLTableCellElement> & { 'data-sortable': boolean } {
  return {
    'data-sortable': true,
    tabIndex: 0,
    'aria-sort': sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none',
    onClick: onSort,
    onKeyDown: (e: React.KeyboardEvent<HTMLTableCellElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSort();
      }
    },
  };
}
