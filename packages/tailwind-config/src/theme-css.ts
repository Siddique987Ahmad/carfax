import { colors, fontFamily } from './tokens.ts';

/** Builds the Tailwind 4 theme from the tokens, so theme.css never drifts from the preset. */
export function toThemeCss(): string {
  const lines = [
    '/* Generated from src/tokens.ts by `pnpm --filter @carfax/tailwind-config generate`. Do not edit. */',
    '/* Tailwind 4 apps: @import "tailwindcss"; then @import "@carfax/tailwind-config/theme.css"; */',
    '@theme {',
  ];
  for (const [name, shades] of Object.entries(colors)) {
    for (const [shade, value] of Object.entries(shades)) {
      lines.push(`  --color-${name}-${shade}: ${value};`);
    }
  }
  for (const [name, stack] of Object.entries(fontFamily)) {
    lines.push(`  --font-${name}: ${stack.join(', ')};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}
