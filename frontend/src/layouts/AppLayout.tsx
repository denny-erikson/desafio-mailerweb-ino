import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <div className="status-chip">Meeting Room Booking</div>
          <div>
            <p className="app-eyebrow">Workspace</p>
            <h1 className="app-title">Gestao de salas e reservas</h1>
          </div>
        </div>

        <div className="app-userbar">
          <div className="app-userinfo">
            <span className="app-userlabel">Sessao ativa</span>
            <strong>{user?.full_name}</strong>
            <small>{user?.email}</small>
          </div>
          <button className="ghost-button" type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <nav className="app-nav" aria-label="Navegacao principal">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--active' : 'nav-link'
          }
        >
          Visao geral
        </NavLink>
        <NavLink
          to="/rooms"
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--active' : 'nav-link'
          }
        >
          Salas
        </NavLink>
        <NavLink
          to="/bookings"
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link--active' : 'nav-link'
          }
        >
          Reservas
        </NavLink>
      </nav>

      <section className="page-content">
        <Outlet />
      </section>
    </main>
  )
}
