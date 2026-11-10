import { describe, expect, it } from 'vitest'

import { parseCsv } from './csv'
import {
  pairRefundedFees,
  parseBrazilianMoney,
  parseDotMoney,
  parseStatement,
  shiftBack,
  StatementParseError,
} from './parsers'

// Synthetic statements shaped like the real ones (the repositories are public).
const NUBANK = [
  'date,title,amount',
  '2026-11-09,Posto Exemplo,"50,00"',
  '2026-11-06,Pagamento recebido,"- 4.664,49"',
  '2026-10-30,Loja Um - Parcela 2/3,"150,00"',
  '2026-10-30,Loja Dois - NuPay - Parcela 10/10,"59,99"',
  '2026-10-29,"Mercado, Centro","1.234,56"',
].join('\n')

const C6_HEADER =
  'Data de Compra,Nome no Cartão,Final do Cartão,Categoria,Descrição,Parcela,Valor (em US$),Cotação (em R$),Valor (em R$),'
const C6 = [
  C6_HEADER,
  '12/09/2026,TITULAR TESTE,3578,Supermercados,MERCADO ALFA,Única,0,0,160.00,',
  '13/09/2026,TITULAR TESTE,3578,Automotivo,PECAS BETA,1/3,0,0,52.00,',
  '17/09/2026,TITULAR TESTE,6240,Serviços,GITHUB, INC.           SA,Única,10.00,5.42,54.22',
  '18/09/2026,OUTRA PESSOA,3202,Serviços,APP GAMA,Única,0,0,5.50,',
  '07/10/2026,TITULAR TESTE,3578,Tarifas,Anuidade Diferenciada,12/12,0,0,98.00,',
  '07/10/2026,TITULAR TESTE,3578,-,Estorno Tarifa,Única,0,0,-98.00,',
  '20/09/2026,TITULAR TESTE,3578,-,Inclusao de Pagamento    ,Única,0,0,-8394.06,',
].join('\r\n')

describe('parseCsv', () => {
  it('should handle quotes, escaped quotes, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,"b,1","c ""q"""\r\nx,,z\r\n')).toEqual([
      ['a', 'b,1', 'c "q"'],
      ['x', '', 'z'],
    ])
  })

  it('should drop blank lines', () => {
    expect(parseCsv('a,b\n\n,\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('money', () => {
  it('should read Brazilian and dotted values', () => {
    expect(parseBrazilianMoney('50,00')).toBe(50)
    expect(parseBrazilianMoney('1.234,56')).toBe(1234.56)
    expect(parseBrazilianMoney('- 4.664,49')).toBe(-4664.49)
    expect(parseBrazilianMoney('abc')).toBeNull()
    expect(parseDotMoney('160.00')).toBe(160)
    expect(parseDotMoney('-8394.06')).toBe(-8394.06)
    expect(parseDotMoney('1,5')).toBeNull()
  })
})

describe('Nubank statement', () => {
  const parsed = parseStatement(NUBANK)

  it('should be told from the header and read the purchases', () => {
    expect(parsed.bank).toBe('NUBANK')
    expect(parsed.lines.map((line) => [line.description, line.installmentAmount])).toEqual([
      ['Posto Exemplo', 50],
      ['Loja Um', 150],
      ['Loja Dois - NuPay', 59.99],
      ['Mercado, Centro', 1234.56],
    ])
  })

  it('should take the installment from the title suffix, out of the description', () => {
    const plan = parsed.lines.find((line) => line.description === 'Loja Um')
    expect(plan).toMatchObject({ installments: 3, firstInstallment: 2, purchaseDate: '2026-10-30' })
    expect(parsed.lines[0]).toMatchObject({ installments: 1, firstInstallment: 1 })
  })

  it('should skip the payment and keep the id of each row', () => {
    expect(parsed.skipped).toEqual([
      {
        id: 2,
        date: '2026-11-06',
        description: 'Pagamento recebido',
        amount: -4664.49,
        reason: 'PAYMENT',
      },
    ])
    expect(parsed.lines.map((line) => line.id)).toEqual([1, 3, 4, 5])
  })
})

describe('C6 statement', () => {
  const parsed = parseStatement(C6)

  it('should be told from the header and read date, value and installments', () => {
    expect(parsed.bank).toBe('C6')
    expect(parsed.lines[0]).toMatchObject({
      description: 'MERCADO ALFA',
      purchaseDate: '2026-09-12',
      installments: 1,
      firstInstallment: 1,
      installmentAmount: 160,
      lastDigits: '3578',
      holderName: 'TITULAR TESTE',
      international: false,
    })
    expect(parsed.lines[1]).toMatchObject({ installments: 3, firstInstallment: 1 })
  })

  it('should keep the comma of a description that is not quoted', () => {
    const github = parsed.lines.find((line) => line.description.startsWith('GITHUB'))
    expect(github).toMatchObject({
      description: 'GITHUB, INC. SA',
      installmentAmount: 54.22,
      lastDigits: '6240',
      international: true,
    })
  })

  it('should use the value in R$ and mark the international ones', () => {
    expect(
      parsed.lines.filter((line) => line.international).map((line) => line.installmentAmount),
    ).toEqual([54.22])
  })

  it('should skip the payment and the refund, apart', () => {
    expect(parsed.skipped.map((line) => [line.reason, line.description, line.amount])).toEqual([
      ['CREDIT', 'Estorno Tarifa', -98],
      ['PAYMENT', 'Inclusao de Pagamento', -8394.06],
    ])
  })

  it('should pair a fee with the refund of the same value', () => {
    const pairs = pairRefundedFees(parsed.lines, parsed.skipped)
    const fee = parsed.lines.find((line) => line.description === 'Anuidade Diferenciada')!
    expect([...pairs.keys()]).toEqual([fee.id])
    expect(pairs.get(fee.id)?.description).toBe('Estorno Tarifa')
  })

  it('should not pair an ordinary purchase of the same value', () => {
    const plain = parseStatement(
      [
        C6_HEADER,
        '07/10/2026,T,3578,Loja,MERCADO,Única,0,0,98.00,',
        '07/10/2026,T,3578,-,Estorno Tarifa,Única,0,0,-98.00,',
      ].join('\n'),
    )
    expect(pairRefundedFees(plain.lines, plain.skipped).size).toBe(0)
  })

  it('should report a row it cannot read instead of dropping it', () => {
    const broken = parseStatement(
      [C6_HEADER, '12/09/2026,T,3578,Loja,ALFA,Única,0,0,abc,', 'curta,linha'].join('\n'),
    )
    expect(broken.lines).toEqual([])
    expect(broken.skipped.map((line) => line.reason)).toEqual(['INVALID', 'INVALID'])
  })
})

describe('parseStatement', () => {
  it('should refuse a file that is not one of the two statements', () => {
    expect(() => parseStatement('a,b,c\n1,2,3')).toThrow(StatementParseError)
  })
})

describe('shiftBack', () => {
  it('should move a date back by months, clamping the day', () => {
    expect(shiftBack('2026-10-30', 1)).toBe('2026-09-30')
    expect(shiftBack('2026-03-31', 1)).toBe('2026-02-28')
    expect(shiftBack('2026-01-15', 2)).toBe('2025-11-15')
    expect(shiftBack('2026-10-30', 0)).toBe('2026-10-30')
  })
})
