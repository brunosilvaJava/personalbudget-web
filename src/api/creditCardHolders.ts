import {
  endpoints,
  type CreditCardHolderRequest,
  type CreditCardHolderResponse,
  type CreditCardHolderUpdateRequest,
  type CreditCardPlasticRequest,
  type CreditCardPlasticResponse,
  type CreditCardPlasticUpdateRequest,
  type UUID,
} from './contracts'
import { request } from './http'

const cards = endpoints.creditCard

/** The TITULAR first, then the ADICIONAIS. */
export function listHolders(
  cardCode: UUID,
  signal?: AbortSignal,
): Promise<CreditCardHolderResponse[]> {
  return request(`${cards}/${cardCode}/holder`, { signal })
}

export function createHolder(
  cardCode: UUID,
  body: CreditCardHolderRequest,
): Promise<CreditCardHolderResponse> {
  return request(`${cards}/${cardCode}/holder`, { method: 'POST', body })
}

export function updateHolder(
  cardCode: UUID,
  holderCode: UUID,
  body: CreditCardHolderUpdateRequest,
): Promise<CreditCardHolderResponse> {
  return request(`${cards}/${cardCode}/holder/${holderCode}`, { method: 'PATCH', body })
}

/** 409 for the TITULAR. */
export function setHolderActive(
  cardCode: UUID,
  holderCode: UUID,
  active: boolean,
): Promise<CreditCardHolderResponse> {
  return request(
    `${cards}/${cardCode}/holder/${holderCode}/${active ? 'activate' : 'inactivate'}`,
    { method: 'PATCH' },
  )
}

export function listPlastics(
  cardCode: UUID,
  signal?: AbortSignal,
): Promise<CreditCardPlasticResponse[]> {
  return request(`${cards}/${cardCode}/plastic`, { signal })
}

export function createPlastic(
  cardCode: UUID,
  body: CreditCardPlasticRequest,
): Promise<CreditCardPlasticResponse> {
  return request(`${cards}/${cardCode}/plastic`, { method: 'POST', body })
}

export function updatePlastic(
  cardCode: UUID,
  plasticCode: UUID,
  body: CreditCardPlasticUpdateRequest,
): Promise<CreditCardPlasticResponse> {
  return request(`${cards}/${cardCode}/plastic/${plasticCode}`, { method: 'PATCH', body })
}
