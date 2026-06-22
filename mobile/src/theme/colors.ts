export const Colors = {
  // Brand
  navy:       '#1a3c5e',
  green:      '#2d6a4f',
  orange:     '#b5500a',

  // Backgrounds
  bg:         '#f4f6f8',
  card:       '#ffffff',
  navyDark:   '#122a43',
  greenDark:  '#1e4a36',

  // Text
  textPrimary:   '#1a1a1a',
  textSecondary: '#555555',
  textMuted:     '#6c757d',
  textOnDark:    '#ffffff',
  textOnDarkMuted: 'rgba(255,255,255,0.7)',

  // Borders
  border:     '#d8dce2',
  borderLight:'#eaecef',

  // Semantic
  error:      '#b00020',
  errorBg:    '#fde8e8',
  warning:    '#856404',
  warningBg:  '#fff3cd',
  success:    '#155724',
  successBg:  '#d4edda',
  info:       '#0c5460',
  infoBg:     '#d1ecf1',

  // Status badges
  statusPending:    '#fff3cd',
  statusPendingText:'#856404',
  statusApproved:   '#d4edda',
  statusApprovedText:'#155724',
  statusRejected:   '#fde8e8',
  statusRejectedText:'#b00020',
  statusInTransit:  '#cce5ff',
  statusInTransitText:'#004085',
  statusCompleted:  '#d4edda',
  statusCompletedText:'#155724',
  statusDraft:      '#e2e3e5',
  statusDraftText:  '#383d41',

  // UI
  overlay:    'rgba(0,0,0,0.5)',
  transparent:'transparent',
  white:      '#ffffff',
  black:      '#000000',
  divider:    '#eaecef',

  // Tab bar
  tabActive:   '#ffffff',
  tabInactive: 'rgba(255,255,255,0.55)',
} as const;

export type ColorKey = keyof typeof Colors;
