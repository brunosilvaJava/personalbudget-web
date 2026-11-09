import { Navigate, useLocation } from 'react-router'

/** /contas was the old name of Recorrentes (Phase 0): old links and home screen shortcuts still work. */
export function LegacyRecurringRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to={`${pathname.replace(/^\/contas/, '/recorrentes')}${search}`} replace />
}
