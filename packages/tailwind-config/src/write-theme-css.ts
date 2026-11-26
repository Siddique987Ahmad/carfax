import { writeFileSync } from 'node:fs';
import { toThemeCss } from './theme-css.ts';

const target = new URL('../theme.css', import.meta.url);
writeFileSync(target, toThemeCss());
console.log('wrote theme.css');
