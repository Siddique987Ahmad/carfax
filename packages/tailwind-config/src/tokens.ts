/**
 * The one source of the Carfax look, shared by the public site, the admin panel and the garage app.
 * Edit here, then run `pnpm --filter @carfax/tailwind-config generate` to update theme.css.
 *
 * Brand colours are placeholders until the brand is chosen. Every 600 and 700 shade is dark enough
 * for white text (WCAG AA, 4.5:1), because buttons and badges use them that way.
 */
export const colors = {
  brand: {
    50: '#eef5ff',
    100: '#d9e8ff',
    200: '#bcd7ff',
    300: '#8ebdff',
    400: '#5998fd',
    500: '#3372f6',
    600: '#1d54db',
    700: '#1a44b0',
    800: '#1b3b8b',
    900: '#1c356e',
    950: '#152243',
  },
  // Approved jobs, verified records
  success: { 50: '#ecfdf3', 100: '#d1fae0', 600: '#15803d', 700: '#166534' },
  // Flagged jobs, records under review
  warning: { 50: '#fffbeb', 100: '#fef3c7', 600: '#b45309', 700: '#92400e' },
  // Mileage rollback, rejected jobs, errors
  danger: { 50: '#fef2f2', 100: '#fee2e2', 600: '#dc2626', 700: '#b91c1c' },
} as const;

/**
 * Font stacks for the web. Names with spaces are quoted, as CSS needs.
 * The garage app loads fonts with expo-font and refers to them by their loaded names (garage-app/02),
 * so it overrides fontFamily in its own config.
 */
export const fontFamily = {
  sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
  // Urdu: Nastaliq first; Naskh is the fallback if Nastaliq is slow or clipped on low-end phones.
  urdu: ['"Noto Nastaliq Urdu"', '"Noto Naskh Arabic"', 'serif'],
} as const;
