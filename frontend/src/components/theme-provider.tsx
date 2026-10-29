import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

// index.html sets the theme before React loads, so the provider's inline script is marked inert.
const INERT_SCRIPT = { type: 'application/json' };

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      scriptProps={INERT_SCRIPT}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
