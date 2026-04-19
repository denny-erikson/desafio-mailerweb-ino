import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { useAuth } from '../features/auth/useAuth'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card--centered">
          <div className="status-chip">Verificando sessao...</div>
          <h1>Carregando acesso</h1>
          <p className="auth-copy">
            Estamos restaurando sua sessao antes de abrir o painel.
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
