import { useAuth } from '../features/auth/useAuth'

export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <div className="status-chip">Sessao autenticada</div>
            <h1>Painel inicial</h1>
            <p className="auth-copy">
              A base de autenticacao do frontend esta pronta. O proximo passo e
              ligar as telas de salas e reservas.
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={logout}>
            Sair
          </button>
        </div>

        <dl className="details-grid">
          <div>
            <dt>Usuario</dt>
            <dd>{user?.full_name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{user?.is_active ? 'Ativo' : 'Inativo'}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
