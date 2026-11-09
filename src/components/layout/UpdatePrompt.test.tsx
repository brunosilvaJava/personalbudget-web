import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Toaster } from '@/components/ui/sonner'
import { UpdatePrompt } from './UpdatePrompt'

const sw = vi.hoisted(() => ({
  needRefresh: false,
  update: vi.fn<(reload?: boolean) => Promise<void>>(),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, vi.fn<() => void>()],
    offlineReady: [false, vi.fn<() => void>()],
    updateServiceWorker: sw.update,
  }),
}))

function renderPrompt() {
  return render(
    <>
      <UpdatePrompt />
      <Toaster />
    </>,
  )
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    sw.needRefresh = false
    sw.update.mockReset()
  })

  it('should say nothing while there is no new version', () => {
    renderPrompt()
    expect(screen.queryByText('Nova versão disponível')).not.toBeInTheDocument()
  })

  it('should offer to reload when a new version is waiting, and reload only when asked', async () => {
    sw.needRefresh = true
    renderPrompt()

    expect(await screen.findByText('Nova versão disponível')).toBeInTheDocument()
    expect(sw.update).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }))
    expect(sw.update).toHaveBeenCalledWith(true)
  })
})
