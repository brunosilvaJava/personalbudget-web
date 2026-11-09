import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function healthUp() {
  server.use(http.get('/api/actuator/health', () => HttpResponse.json({ status: 'UP' })))
}

describe('AppShell', () => {
  it('should show the four sections and the Lançar button', async () => {
    healthUp()
    renderApp('/')

    const [bottomNav] = screen.getAllByRole('navigation', {
      name: 'Navegação principal',
    })
    const links = within(bottomNav!)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(links).toEqual(['Início', 'Movimentações', 'Carteira', 'Mais'])
    // "Lançar" opens the quick entry over the current screen.
    expect(screen.getAllByRole('link', { name: /Lançar/ })[0]).toHaveAttribute('href', '/?lancar=1')
    await screen.findByText('API conectada')
  })

  it('should tell when the API is not reachable', async () => {
    server.use(http.get('/api/actuator/health', () => new HttpResponse(null, { status: 502 })))
    renderApp('/')

    expect(await screen.findByText('API fora do ar')).toBeInTheDocument()
    expect(screen.getByText(/Confira se ela está rodando no PC/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })

  it('should reach Recorrentes through Mais and keep the old /contas links working', async () => {
    healthUp()
    const { router } = renderApp('/')

    const [bottomNav] = screen.getAllByRole('navigation', {
      name: 'Navegação principal',
    })
    await userEvent.click(within(bottomNav!).getByRole('link', { name: 'Mais' }))
    const more = await screen.findByRole('navigation', { name: 'Outras telas' })
    await userEvent.click(within(more).getByRole('link', { name: 'Recorrentes' }))

    expect(router.state.location.pathname).toBe('/recorrentes/fixas')
    expect(await screen.findByText('Contas fixas em construção')).toBeInTheDocument()

    await router.navigate('/contas/parceladas')
    await waitFor(() => expect(router.state.location.pathname).toBe('/recorrentes/parceladas'))
  })

  it('should keep the theme chosen in Mais on this device', async () => {
    healthUp()
    renderApp('/mais')

    await userEvent.click(await screen.findByRole('radio', { name: 'Escuro' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('personalbudget.theme')).toBe('dark')

    await userEvent.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('personalbudget.theme')).toBeNull()
  })

  it('should show a not found page for an unknown path', () => {
    renderApp('/nao-existe')

    expect(screen.getByText('Página não encontrada')).toBeInTheDocument()
  })
})
