import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { useAuth } from '../features/auth/useAuth'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-6">
        <section className="w-full max-w-md rounded-panel border border-app-border bg-white/90 p-6 text-center shadow-soft">
          <span className="inline-flex rounded-full bg-app-muted px-3 py-1 text-xs font-medium text-app-strong">
            Verificando sessão...
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-app-strong">
            Carregando acesso
          </h1>
          <p className="mt-2 text-sm leading-6 text-app-text">
            Estamos restaurando sua sessão antes de abrir o painel.
          </p>
        </section>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
