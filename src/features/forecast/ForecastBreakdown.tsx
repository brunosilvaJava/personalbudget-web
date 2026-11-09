import { Link } from 'react-router'

import type { CashForecastResponse } from '@/api/contracts'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

type Sign = '+' | '−' | '='

interface Line {
  key: string
  sign: Sign
  label: string
  value: number
  /** a result line (bold, with a rule above) */
  total?: boolean
  hint?: string
  to?: string
}

/** The lines of the account, top to bottom, exactly as the back adds them up. */
function linesOf(forecast: CashForecastResponse): Line[] {
  const until = formatDate(forecast.until)
  const lines: Line[] = [
    { key: 'cash', sign: '=', label: 'Saldo nas contas hoje', value: forecast.cash_balance },
    {
      key: 'income',
      sign: '+',
      label: `Receitas a receber até ${until}`,
      value: forecast.expected_income,
    },
  ]
  if (forecast.include_late_income) {
    lines.push({
      key: 'late',
      sign: '+',
      label: 'Receitas atrasadas (contadas como recebidas)',
      value: forecast.late_income,
    })
  }
  lines.push(
    {
      key: 'obligations',
      sign: '−',
      label: `Despesas a pagar até ${until}`,
      value: forecast.obligations,
      hint: 'Inclui as que já venceram.',
    },
    {
      key: 'invoices',
      sign: '−',
      label: `Parcelas de cartão até ${until}`,
      value: forecast.card_invoices,
    },
    {
      key: 'projected',
      sign: '=',
      label: `Caixa projetado em ${until}`,
      value: forecast.projected_cash,
      total: true,
    },
    {
      key: 'reserve',
      sign: '−',
      label: 'Reserva dos envelopes',
      value: forecast.envelope_reserve,
      hint: forecast.envelope_cycle_code
        ? 'O que ainda está livre nos envelopes do ciclo atual.'
        : 'Sem ciclo atual, não há envelopes a reservar.',
      to: forecast.envelope_cycle_code
        ? `/ciclos/${forecast.envelope_cycle_code}/envelopes`
        : undefined,
    },
    {
      key: 'beyond',
      sign: '−',
      label: `Cartão que vence depois de ${until}`,
      value: forecast.card_beyond_horizon,
      hint: 'Parcelas já assumidas, fora do horizonte.',
    },
    {
      key: 'free',
      sign: '=',
      label: 'Livre depois das reservas',
      value: forecast.free_after_reserves,
      total: true,
    },
  )
  return lines
}

/** "Como chegamos nesse número": each component of the forecast, added and subtracted. */
export function ForecastBreakdown({ forecast }: { forecast: CashForecastResponse }) {
  const lines = linesOf(forecast)
  const lateLeftOut = !forecast.include_late_income && forecast.late_income > 0

  return (
    <section aria-labelledby="breakdown-title" className="flex flex-col gap-3">
      <h2 id="breakdown-title" className="font-medium">
        Como chegamos nesse número
      </h2>
      <table className="w-full text-sm">
        <caption className="sr-only">
          Conta da previsão de caixa, de hoje até {formatDate(forecast.until)}
        </caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key} className={cn(line.total && 'border-t font-semibold')}>
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <span className={cn(line.total && 'font-semibold')}>
                  <span aria-hidden className="mr-2 inline-block w-3 text-muted-foreground">
                    {line.sign}
                  </span>
                  {line.to ? (
                    <Link to={line.to} className="text-primary underline-offset-4 hover:underline">
                      {line.label}
                    </Link>
                  ) : (
                    line.label
                  )}
                </span>
                {line.hint && (
                  <span className="block pl-5 text-xs font-normal text-muted-foreground">
                    {line.hint}
                  </span>
                )}
              </th>
              <td
                className={cn(
                  'py-2 text-right align-top whitespace-nowrap tabular-nums',
                  line.total && line.value < 0 && 'text-expense',
                )}
              >
                {formatMoney(line.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lateLeftOut && (
        <p className="text-sm text-muted-foreground">
          Há {formatMoney(forecast.late_income)} de receitas atrasadas que não estão na conta,
          porque ainda não se sabe se vão entrar. Ligue “Contar receitas atrasadas” para somá-las.
        </p>
      )}
    </section>
  )
}
