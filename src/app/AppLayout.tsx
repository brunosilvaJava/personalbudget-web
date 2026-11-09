import { AppShell } from '@/components/layout/AppShell'
import { QuickLaunchSheet } from '@/features/movements/QuickLaunchSheet'

/** The shell plus what opens over any screen: the quick launch ("Lançar", ?lancar=1). */
export function AppLayout() {
  return (
    <>
      <AppShell />
      <QuickLaunchSheet />
    </>
  )
}
