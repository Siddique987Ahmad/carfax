import { colors, fontFamily } from './tokens.ts';

/**
 * Tailwind 3 preset, for the garage app through NativeWind (stable NativeWind supports Tailwind 3 only):
 *   presets: [require('nativewind/preset'), require('@carfax/tailwind-config').default]
 * Tailwind 4 apps (web, admin) import theme.css instead.
 */
const preset = {
  theme: {
    extend: {
      colors,
      fontFamily,
    },
  },
};

export default preset;
