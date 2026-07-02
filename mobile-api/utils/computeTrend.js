'use strict';

const { TrendDirection } = require('../constants/dashboardEnums');

/**
 * Compute a percentage trend between two numeric values.
 *
 * Edge cases:
 *   previous === 0  → percent 0, direction unchanged (division undefined)
 *   current === previous → percent 0, direction unchanged
 *   current > previous  → direction up
 *   current < previous  → direction down
 *
 * @param {number} current   - Current period value
 * @param {number} previous  - Previous period value
 * @returns {{ percent: number, direction: string }}
 */
function computeTrend(current, previous) {
  if (previous === 0) {
    return { percent: 0, direction: TrendDirection.UNCHANGED };
  }
  const raw = ((current - previous) / previous) * 100;
  const percent = Math.round(Math.abs(raw) * 10) / 10;
  const direction = raw > 0 ? TrendDirection.UP
                  : raw < 0 ? TrendDirection.DOWN
                  :            TrendDirection.UNCHANGED;
  return { percent, direction };
}

module.exports = { computeTrend };
