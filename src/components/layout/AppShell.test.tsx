import { screen, within } from '@testing-library/react'
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
    expect(links).toEqual(['Início', 'Caixa', 'Movimentações', 'Contas'])
    expect(screen.getAllByRole('link', { name: /Lançar/ })[0]).toHaveAttribute(
      'href',
      '/movimentacoes?lancar=1',
    )
    await screen.findByText('API conectada')
  })

  it('should tell when the API is not reachable', async () => {
    server.use(http.get('/api/actuator/health', () => new HttpResponse(null, { status: 502 })))
    renderApp('/')

    expect(await screen.findByText('API fora do ar')).toBeInTheDocument()
    expect(screen.getByText(/Confira se ela está rodando no PC/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  })

  it('should open the fixed bills tab when Contas is chosen', async () => {
    healthUp()
    const { router } = renderApp('/')

    const [bottomNav] = screen.getAllByRole('navigation', {
      name: 'Navegação principal',
    })
    await userEvent.click(within(bottomNav!).getByRole('link', { name: 'Contas' }))

    expect(router.state.location.pathname).toBe('/contas/fixas')
    expect(await screen.findByText('Contas fixas em construção')).toBeInTheDocument()
  })

  it('should show a not found page for an unknown path', () => {
    renderApp('/nao-existe')

    expect(screen.getByText('Página não encontrada')).toBeInTheDocument()
  })
})
