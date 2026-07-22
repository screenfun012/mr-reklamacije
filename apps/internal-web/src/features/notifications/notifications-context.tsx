import { createContext, useContext, useMemo, useState } from 'react'

interface NotificationsUiState {
  isPanelOpen: boolean
  setPanelOpen: (open: boolean) => void
}

const NotificationsUiContext = createContext<NotificationsUiState | null>(null)

/**
 * Shares one piece of state between the bell and the popup stack: whether the
 * panel is open. Popups stay silent while the panel is open — the user is
 * already looking at the list.
 */
export function NotificationsUiProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [isPanelOpen, setPanelOpen] = useState(false)
  const value = useMemo(() => ({ isPanelOpen, setPanelOpen }), [isPanelOpen])

  return <NotificationsUiContext.Provider value={value}>{children}</NotificationsUiContext.Provider>
}

export function useNotificationsUi(): NotificationsUiState {
  const context = useContext(NotificationsUiContext)
  if (context === null) {
    throw new Error('useNotificationsUi must be used inside NotificationsUiProvider')
  }
  return context
}
