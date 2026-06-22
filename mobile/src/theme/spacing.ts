export const Spacing = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export const Radius = {
  xs:  4,
  sm:  6,
  md:  8,
  lg:  12,
  xl:  16,
  full: 9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const Layout = {
  screenPadding:    Spacing.base,
  cardPadding:      Spacing.base,
  fabSize:          56,
  headerHeight:     56,
  tabBarHeight:     60,
  inputHeight:      48,
  buttonHeight:     52,
  borderWidth:      1,
  iconSize:         {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
} as const;
