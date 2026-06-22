import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  fontFamily,

  // Sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  28,

  // Weights
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,

  // Line heights
  lineHeightTight:  1.2,
  lineHeightNormal: 1.45,
  lineHeightLoose:  1.7,
} as const;

export const TextStyles = {
  displayLarge: {
    fontSize:   Typography.xxl,
    fontWeight: Typography.bold,
    lineHeight: Typography.xxl * Typography.lineHeightTight,
  },
  displaySmall: {
    fontSize:   Typography.xl,
    fontWeight: Typography.bold,
    lineHeight: Typography.xl * Typography.lineHeightTight,
  },
  heading: {
    fontSize:   Typography.lg,
    fontWeight: Typography.semibold,
    lineHeight: Typography.lg * Typography.lineHeightNormal,
  },
  subheading: {
    fontSize:   Typography.md,
    fontWeight: Typography.semibold,
    lineHeight: Typography.md * Typography.lineHeightNormal,
  },
  body: {
    fontSize:   Typography.base,
    fontWeight: Typography.regular,
    lineHeight: Typography.base * Typography.lineHeightNormal,
  },
  bodyMedium: {
    fontSize:   Typography.base,
    fontWeight: Typography.medium,
    lineHeight: Typography.base * Typography.lineHeightNormal,
  },
  caption: {
    fontSize:   Typography.sm,
    fontWeight: Typography.regular,
    lineHeight: Typography.sm * Typography.lineHeightNormal,
  },
  captionMedium: {
    fontSize:   Typography.sm,
    fontWeight: Typography.medium,
    lineHeight: Typography.sm * Typography.lineHeightNormal,
  },
  label: {
    fontSize:   Typography.xs,
    fontWeight: Typography.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;
