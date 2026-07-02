import { ActivityType, ActivityTypeValue } from '../constants/dashboardEnums';

// Maps semantic ActivityType → Ionicons icon name.
// 'default' catches unknown types returned before the icon mapping was fully populated.
const ACTIVITY_ICON: Record<ActivityTypeValue | 'default', string> = {
  [ActivityType.SALES_ORDER]:        'cart-outline',
  [ActivityType.DELIVERY]:           'car-outline',
  [ActivityType.HARVEST_LOG]:        'leaf-outline',
  [ActivityType.SAWMILL_LOG]:        'construct-outline',
  [ActivityType.POLES_LOG]:          'podium-outline',
  [ActivityType.MATERIAL_REQUEST]:   'cube-outline',
  [ActivityType.CASUAL_LABOUR]:      'people-outline',
  [ActivityType.MACHINE_LOG]:        'settings-outline',
  [ActivityType.FUEL_LOG]:           'flame-outline',
  [ActivityType.STOCK_MOVEMENT_IN]:  'arrow-down-circle-outline',
  [ActivityType.STOCK_MOVEMENT_OUT]: 'arrow-up-circle-outline',
  [ActivityType.USER_LOGIN]:         'log-in-outline',
  [ActivityType.CHANGE_REQUEST]:     'git-pull-request-outline',
  [ActivityType.APPROVAL]:           'checkmark-circle-outline',
  default:                           'ellipse-outline',
};

// Maps semantic ActivityType → background tint colour (used behind the icon).
const ACTIVITY_COLOR: Record<ActivityTypeValue | 'default', string> = {
  [ActivityType.SALES_ORDER]:        '#dbeafe',
  [ActivityType.DELIVERY]:           '#d1fae5',
  [ActivityType.HARVEST_LOG]:        '#dcfce7',
  [ActivityType.SAWMILL_LOG]:        '#fef9c3',
  [ActivityType.POLES_LOG]:          '#ede9fe',
  [ActivityType.MATERIAL_REQUEST]:   '#ffedd5',
  [ActivityType.CASUAL_LABOUR]:      '#fee2e2',
  [ActivityType.MACHINE_LOG]:        '#e0f2fe',
  [ActivityType.FUEL_LOG]:           '#fce7f3',
  [ActivityType.STOCK_MOVEMENT_IN]:  '#d1fae5',
  [ActivityType.STOCK_MOVEMENT_OUT]: '#fee2e2',
  [ActivityType.USER_LOGIN]:         '#f3f4f6',
  [ActivityType.CHANGE_REQUEST]:     '#ede9fe',
  [ActivityType.APPROVAL]:           '#d1fae5',
  default:                           '#f3f4f6',
};

export function getActivityIcon(type: ActivityTypeValue | 'default'): string {
  return ACTIVITY_ICON[type] ?? ACTIVITY_ICON.default;
}

export function getActivityColor(type: ActivityTypeValue | 'default'): string {
  return ACTIVITY_COLOR[type] ?? ACTIVITY_COLOR.default;
}
