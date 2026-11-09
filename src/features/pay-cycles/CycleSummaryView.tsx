import { TriangleAlert } from 'lucide-react'

import type { PayCycleSummaryCategoryResponse, PayCycleSummaryResponse } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { formatMoney } from '@/lib/format'
import { describeSummaryPending } from './rules'

/**
 * The cycle report, by competence: what was paid (recognized) and what is expected (projected,
 * which already includes what was paid). The totals always show; the categories only when `full`.
 */
export function CycleSummaryView({
  summary,
  full = false,
}: {
  summary: PayCycleSummaryResponse
  full?: boolean
}) {
  const recognizedResult = summary.recognized_revenue - summary.recognized_expense
  const projectedResult = summary.projected_revenue - summary.projected_expense
  const revenues = summary.categories.filter((category) => category.operation_type === 'CREDIT')
  const expenses = summary.categories.filter((category) => category.operation_type === 'DEBIT')

  return (
    <div className="flex flex-col gap-4">
      {summary.projection_incomplete && (
        <div
          role="note"
          className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium">A projeção está incompleta</p>
            <p>
              Falta calcular parte do que está previsto, então os valores projetados ficam abaixo do
              real.
            </p>
            {summary.pending.length > 0 && (
              <ul className="list-disc pl-5">
                {summary.pending.map((item, index) => (
                  <li key={index}>{describeSummaryPending(item)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <caption className="sr-only">Totais do ciclo</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="pb-2 font-normal">
              <span className="sr-only">Tipo</span>
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Pago
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Projetado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y border-y">
          <tr>
            <th scope="row" className="py-2 text-left font-normal">
              Receitas
            </th>
            <td className="py-2 text-right text-income tabular-nums">
              {formatMoney(summary.recognized_revenue)}
            </td>
            <td className="py-2 text-right text-income tabular-nums">
              {formatMoney(summary.projected_revenue)}
            </td>
          </tr>
          <tr>
            <th scope="row" className="py-2 text-left font-normal">
              Despesas
            </th>
            <td className="py-2 text-right text-expense tabular-nums">
              {formatMoney(summary.recognized_expense)}
            </td>
            <td className="py-2 text-right text-expense tabular-nums">
              {formatMoney(summary.projected_expense)}
            </td>
          </tr>
          <tr className="font-medium">
            <th scope="row" className="py-2 text-left font-medium">
              Resultado
            </th>
            <td className="py-2 text-right">
              <Amount value={recognizedResult} />
            </td>
            <td className="py-2 text-right">
              <Amount value={projectedResult} />
            </td>
          </tr>
        </tbody>
      </table>

      {full && (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryList title="Receitas por categoria" categories={revenues} />
          <CategoryList title="Despesas por categoria" categories={expenses} />
        </div>
      )}
    </div>
  )
}

function CategoryList({
  title,
  categories,
}: {
  title: string
  categories: readonly PayCycleSummaryCategoryResponse[]
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="font-medium">{title}</h3>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada neste ciclo.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {categories.map((category) => (
            <li
              key={`${category.category_code ?? 'none'}-${category.operation_type}`}
              className="flex flex-col gap-0.5 px-4 py-3 text-sm"
            >
              <span className="font-medium">{category.category_name}</span>
              <span className="text-muted-foreground">
                Pago {formatMoney(category.recognized_amount)} · projetado{' '}
                {formatMoney(category.projected_amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
