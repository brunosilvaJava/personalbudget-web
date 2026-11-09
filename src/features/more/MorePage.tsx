import { ChevronRight, Monitor, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router'

import { MORE_ITEMS } from '@/components/layout/nav-items'
import { PageHeader } from '@/components/layout/PageHeader'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ApiStatus } from '@/features/system/ApiStatus'
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme'

/** The other screens (on the phone) and the settings of this device. */
export function MorePage() {
  const theme = useThemePreference()

  return (
    <>
      <PageHeader title="Mais" />
      <div className="flex flex-col gap-6">
        <nav aria-label="Outras telas" className="lg:hidden">
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex min-h-14 items-center gap-3 px-4 transition-colors hover:bg-accent/60"
                >
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1 font-medium">{label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="theme-title" className="flex flex-col gap-2">
          <h2 id="theme-title" className="font-medium">
            Aparência
          </h2>
          <ToggleGroup
            type="single"
            aria-labelledby="theme-title"
            value={theme}
            onValueChange={(value) => value && setThemePreference(value as ThemePreference)}
          >
            <ToggleGroupItem value="system">
              <Monitor className="size-4" aria-hidden />
              Sistema
            </ToggleGroupItem>
            <ToggleGroupItem value="light">
              <Sun className="size-4" aria-hidden />
              Claro
            </ToggleGroupItem>
            <ToggleGroupItem value="dark">
              <Moon className="size-4" aria-hidden />
              Escuro
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-sm text-muted-foreground">Vale só para este aparelho.</p>
        </section>

        <section aria-labelledby="api-title" className="flex flex-col gap-2">
          <h2 id="api-title" className="font-medium">
            Conexão
          </h2>
          <ApiStatus />
          <p className="text-sm text-muted-foreground">
            As categorias são ajustadas pela API (Swagger em /swagger-ui.html); o app só as usa.
          </p>
        </section>
      </div>
    </>
  )
}
