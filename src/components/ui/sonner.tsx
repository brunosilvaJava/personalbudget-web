import { useEffect, useState } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// shadcn/ui Sonner, written by hand. The shadcn file reads the theme from next-themes; here the
// theme is the `dark` class on <html> (src/app/theme.ts), so it watches that class instead.
function readHtmlTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function useHtmlTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState(readHtmlTheme)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readHtmlTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

function Toaster(props: ToasterProps) {
  const theme = useHtmlTheme()
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
