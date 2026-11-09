import * as React from 'react'
import { ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'

// A small take on shadcn/ui's chart (written by hand): the container sets one CSS variable per
// series (--color-<key>) from the config, so the Recharts elements use var(--color-<key>) and
// follow the light and dark themes. Tooltips are built by each chart with the app's formatters.
export type ChartConfig = Record<string, { label: string; color: string }>

function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<typeof ResponsiveContainer>['children']
}) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, { color }]) => [`--color-${key}`, color]),
  ) as React.CSSProperties
  return (
    <div
      data-slot="chart"
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden",
        className,
      )}
      style={style}
      {...props}
    >
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  )
}

function ChartLegend({ config }: { config: ChartConfig }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      {Object.entries(config).map(([key, { label }]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: `var(--color-${key})` }}
            aria-hidden
          />
          {label}
        </li>
      ))}
    </ul>
  )
}

export { ChartContainer, ChartLegend }
