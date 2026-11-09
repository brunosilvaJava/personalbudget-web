import { CircleAlert } from 'lucide-react'

/** An error that has no field: a 409, a 404, a network failure. Shown above the buttons. */
export function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  )
}
