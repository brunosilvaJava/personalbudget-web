import { useLocation, useNavigate, useSearchParams, type To } from 'react-router'

/**
 * "Lançar" opens the quick entry sheet over the CURRENT screen: it adds ?lancar=1 to the URL (a
 * new history entry, so the phone's back button closes it) and the sheet follows that param.
 * /movimentacoes?lancar=1 also works as a link from outside.
 */
export const LAUNCH_PARAM = 'lancar'

interface LaunchState {
  launch?: boolean
}

export function useLaunchLink(): { to: To; state: LaunchState } {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set(LAUNCH_PARAM, '1')
  return { to: { pathname: location.pathname, search: `?${params}` }, state: { launch: true } }
}

/** Whether the sheet is open, and how to close it (back when we opened it, else drop the param). */
export function useLaunchSheetState(): [open: boolean, close: () => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const open = searchParams.get(LAUNCH_PARAM) === '1'
  const close = () => {
    if ((location.state as LaunchState | null)?.launch) {
      void navigate(-1)
    } else {
      const next = new URLSearchParams(searchParams)
      next.delete(LAUNCH_PARAM)
      setSearchParams(next, { replace: true })
    }
  }
  return [open, close]
}
