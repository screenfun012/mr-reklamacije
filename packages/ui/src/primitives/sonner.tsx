import * as React from 'react'
import { Toaster as SonnerToaster, type ToasterProps, toast } from 'sonner'

/**
 * Thin wrapper around Sonner's Toaster.
 *
 * Frontends mount this once in their root layout. Theme handling
 * is consumer's responsibility (e.g., pass theme="dark" or wire
 * to next-themes in the consumer app).
 *
 * @mr/ui stays framework-agnostic — no next-themes dep.
 */
const Toaster = (props: ToasterProps): React.JSX.Element => {
  return <SonnerToaster className="toaster group" {...props} />
}

export { Toaster, toast, type ToasterProps }
