import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { server } from '@/test/server'
import {
  API_UNAVAILABLE_MESSAGE,
  ApiError,
  NETWORK_ERROR_MESSAGE,
  request,
  TIMEOUT_ERROR_MESSAGE,
} from './http'

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the request to fail')
}

describe('request', () => {
  it('should prefix /api and return the parsed body', async () => {
    server.use(http.get('/api/dashboard', () => HttpResponse.json({ current_balance: 10 })))

    await expect(request('/dashboard')).resolves.toEqual({
      current_balance: 10,
    })
  })

  it('should send the body as JSON', async () => {
    let received: unknown
    let contentType: string | null = null
    server.use(
      http.post('/api/financial_movement', async ({ request: req }) => {
        received = await req.json()
        contentType = req.headers.get('content-type')
        return HttpResponse.json({ code: 'abc' }, { status: 201 })
      }),
    )

    await request('/financial_movement', {
      method: 'POST',
      body: { amount: 12.5 },
    })

    expect(received).toEqual({ amount: 12.5 })
    expect(contentType).toBe('application/json')
  })

  it('should return undefined when the response has no body', async () => {
    server.use(
      http.delete('/api/fixed_bill/1', () => new HttpResponse(null, { status: 204 })),
      http.post('/api/installment_bill', () => new HttpResponse(null, { status: 201 })),
    )

    await expect(request('/fixed_bill/1', { method: 'DELETE' })).resolves.toBeUndefined()
    await expect(
      request('/installment_bill', { method: 'POST', body: {} }),
    ).resolves.toBeUndefined()
  })

  it('should reject a malformed JSON response', async () => {
    server.use(http.get('/api/dashboard', () => HttpResponse.text('not json')))

    const error = (await catchError(request('/dashboard'))) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(200)
    expect(error.message).toBe('A API retornou uma resposta inválida.')
  })

  it('should expose the field validations of a 400', async () => {
    server.use(
      http.post('/api/financial_movement', () =>
        HttpResponse.json(
          {
            message: 'Campos inválidos',
            validations: { amount_paid: 'deve ser maior que 0.01' },
          },
          { status: 400 },
        ),
      ),
    )

    const error = await catchError(request('/financial_movement', { method: 'POST', body: {} }))

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).message).toBe('Campos inválidos')
    expect((error as ApiError).validations).toEqual({
      amount_paid: 'deve ser maior que 0.01',
    })
  })

  it('should flag a 404 as not found', async () => {
    server.use(
      http.get('/api/fixed_bill/x', () =>
        HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 }),
      ),
    )

    const error = (await catchError(request('/fixed_bill/x'))) as ApiError

    expect(error.isNotFound).toBe(true)
    expect(error.message).toBe('Registro não encontrado')
    expect(error.validations).toEqual({})
  })

  it('should explain that the API is down when the proxy answers 5xx without JSON', async () => {
    server.use(http.get('/api/dashboard', () => HttpResponse.text('bad gateway', { status: 502 })))

    const error = (await catchError(request('/dashboard'))) as ApiError

    expect(error.status).toBe(502)
    expect(error.message).toBe(API_UNAVAILABLE_MESSAGE)
  })

  it('should report a network failure with status 0', async () => {
    server.use(http.get('/api/dashboard', () => HttpResponse.error()))

    const error = (await catchError(request('/dashboard'))) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('should time out a request that takes too long', async () => {
    server.use(
      http.get('/api/dashboard', async () => {
        await delay(500)
        return HttpResponse.json({})
      }),
    )

    const error = (await catchError(request('/dashboard', { timeoutMs: 20 }))) as ApiError

    expect(error.isNetworkError).toBe(true)
    expect(error.message).toBe(TIMEOUT_ERROR_MESSAGE)
  })

  it('should time out while reading a response body', async () => {
    let requestSignal: AbortSignal | null | undefined
    const response = new Response()
    vi.spyOn(response, 'text').mockImplementation(
      () =>
        new Promise<string>((_resolve, reject) => {
          const rejectOnAbort = () => reject(new DOMException('Aborted', 'AbortError'))
          if (requestSignal?.aborted) rejectOnAbort()
          else requestSignal?.addEventListener('abort', rejectOnAbort, { once: true })
        }),
    )
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      requestSignal = init?.signal
      return Promise.resolve(response)
    })

    const error = (await catchError(request('/dashboard', { timeoutMs: 20 }))) as ApiError

    expect(error.isNetworkError).toBe(true)
    expect(error.message).toBe(TIMEOUT_ERROR_MESSAGE)
  })

  it('should let caller cancellation abort response-body reading', async () => {
    let requestSignal: AbortSignal | null | undefined
    const response = new Response()
    vi.spyOn(response, 'text').mockImplementation(
      () =>
        new Promise<string>((_resolve, reject) => {
          const rejectOnAbort = () => reject(new DOMException('Aborted', 'AbortError'))
          if (requestSignal?.aborted) rejectOnAbort()
          else requestSignal?.addEventListener('abort', rejectOnAbort, { once: true })
        }),
    )
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      requestSignal = init?.signal
      return Promise.resolve(response)
    })
    const controller = new AbortController()

    const pending = catchError(request('/dashboard', { signal: controller.signal }))
    controller.abort()
    const error = await pending

    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as Error).name).toBe('AbortError')
  })

  it('should report a network failure while reading the response body', async () => {
    const response = new Response()
    vi.spyOn(response, 'text').mockRejectedValue(new TypeError('connection lost'))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    const error = (await catchError(request('/dashboard'))) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('should let a cancellation by the caller propagate as an abort, not an ApiError', async () => {
    server.use(
      http.get('/api/dashboard', async () => {
        await delay(500)
        return HttpResponse.json({})
      }),
    )
    const controller = new AbortController()

    const pending = catchError(request('/dashboard', { signal: controller.signal }))
    controller.abort()
    const error = await pending

    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as Error).name).toBe('AbortError')
  })
})
