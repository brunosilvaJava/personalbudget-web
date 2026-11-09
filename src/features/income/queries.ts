import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getHolidayYear,
  listHolidayYears,
  previewHolidayYear,
  saveHolidayYear,
} from '@/api/holidayCalendar'
import {
  createIncomeSchedule,
  getIncomeSchedule,
  listIncomeOccurrences,
  listIncomeSchedules,
  materializeIncomeOccurrence,
  setIncomeScheduleActive,
  updateIncomeSchedule,
} from '@/api/incomeSchedules'
import type {
  HolidayYearRequest,
  IncomeScheduleRequest,
  IncomeScheduleStatus,
  IncomeScheduleUpdateRequest,
  UUID,
  YearMonth,
} from '@/api/contracts'
import { invalidateFinancial, invalidateIncome, queryKeys } from '@/lib/query-keys'

const ALL: readonly IncomeScheduleStatus[] = ['ACTIVE', 'INACTIVE']

/** The schedules of one situation: ACTIVE or INACTIVE (a plain array, not paged). */
export function useIncomeSchedules(status: IncomeScheduleStatus) {
  return useQuery({
    queryKey: queryKeys.incomeSchedules([status]),
    queryFn: ({ signal }) => listIncomeSchedules({ status: [status] }, signal),
  })
}

/** Every schedule, ACTIVE and INACTIVE: pickers that need names of both. */
export function useAllIncomeSchedules() {
  return useQuery({
    queryKey: queryKeys.incomeSchedules(ALL),
    queryFn: ({ signal }) => listIncomeSchedules({ status: [...ALL] }, signal),
  })
}

export function useIncomeSchedule(code: UUID) {
  return useQuery({
    queryKey: queryKeys.incomeSchedule(code),
    queryFn: ({ signal }) => getIncomeSchedule(code, signal),
  })
}

export function useIncomeOccurrences(code: UUID, from: YearMonth, to: YearMonth) {
  return useQuery({
    queryKey: queryKeys.incomeOccurrences(code, from, to),
    queryFn: ({ signal }) => listIncomeOccurrences(code, { from, to }, signal),
  })
}

/** The occurrences depend on the calendar, on the other schedules and on the cycles: invalidate widely. */
function useIncomeMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateIncome(queryClient) })
}

export const useCreateIncomeSchedule = () =>
  useIncomeMutation((body: IncomeScheduleRequest) => createIncomeSchedule(body))
export const useUpdateIncomeSchedule = () =>
  useIncomeMutation(({ code, body }: { code: UUID; body: IncomeScheduleUpdateRequest }) =>
    updateIncomeSchedule(code, body),
  )
export const useSetIncomeScheduleActive = () =>
  useIncomeMutation(({ code, active }: { code: UUID; active: boolean }) =>
    setIncomeScheduleActive(code, active),
  )

/** Posts a CREDIT movement: the whole financial group changes. */
export function useMaterializeOccurrence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, month }: { code: UUID; month: YearMonth }) =>
      materializeIncomeOccurrence(code, month),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

// ───────────────────────── Holiday calendar ─────────────────────────

export function useHolidayYears() {
  return useQuery({
    queryKey: queryKeys.holidayYears,
    queryFn: ({ signal }) => listHolidayYears(signal),
  })
}

export function useHolidayYear(year: number) {
  return useQuery({
    queryKey: queryKeys.holidayYear(year),
    queryFn: ({ signal }) => getHolidayYear(year, signal),
  })
}

/** A POST that writes nothing: the screen shows what saving the list would change. */
export function usePreviewHolidayYear() {
  return useMutation({
    mutationFn: ({ year, body }: { year: number; body: HolidayYearRequest }) =>
      previewHolidayYear(year, body),
  })
}

export function useSaveHolidayYear() {
  return useIncomeMutation(({ year, body }: { year: number; body: HolidayYearRequest }) =>
    saveHolidayYear(year, body),
  )
}
