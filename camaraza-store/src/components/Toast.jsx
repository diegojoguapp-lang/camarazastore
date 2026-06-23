import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const show = useCallback((message) => {
    setToast(message)
    window.clearTimeout(show._t)
    show._t = window.setTimeout(() => setToast(null), 2200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          <div className="pointer-events-auto rounded-full bg-tinta px-5 py-2.5 text-sm font-medium text-crema shadow-cardHover">
            {toast}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
