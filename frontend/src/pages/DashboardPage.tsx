import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <section className="surface-card">
      <div className="section-header">
        <div>
          <div className="status-chip">Painel</div>
          <h2 className="section-title">Base autenticada pronta</h2>
          <p className="section-copy">
            O login, o armazenamento do token e a protecao das rotas ja estao
            conectados. Agora a interface pode evoluir para salas e reservas.
          </p>
        </div>
        <Link className="primary-button primary-button--inline" to="/rooms">
          Ver salas
        </Link>
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
  )
}
