import { Outlet } from 'react-router'

import { BottomNav } from './BottomNav'
import { LaunchButton } from './LaunchButton'
import { OfflineBanner } from './OfflineBanner'
import { Sidebar } from './Sidebar'

/**
 * Phone: content, the bottom bar and a floating "Lançar" button.
 * Desktop (lg, 1024px and up): a sidebar with the same items, content beside it.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <LaunchButton className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:hidden" />
      <BottomNav />
    </div>
  )
}
