import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import preset from './preset.ts';
import { toThemeCss } from './theme-css.ts';
import { colors } from './tokens.ts';

describe('theme', () => {
  it('theme.css matches the tokens (run `generate` after editing tokens.ts)', () => {
    const file = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
    expect(file).toBe(toThemeCss());
  });

  it('the Tailwind 3 preset uses the same tokens', () => {
    expect(preset.theme.extend.colors).toBe(colors);
  });

  it('600 and 700 shades are dark enough for white text (4.5:1)', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const tooLight = Object.entries(colors).flatMap(([name, shades]) =>
      Object.entries(shades)
        .filter(([shade]) => shade === '600' || shade === '700')
        .filter(([, hex]) => 1.05 / (luminance(hex) + 0.05) < 4.5)
        .map(([shade]) => `${name}-${shade}`),
    );
    expect(tooLight).toEqual([]);
  });
});
