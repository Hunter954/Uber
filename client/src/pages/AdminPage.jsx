export default function AdminPage({ stats, users, history }) {
  const userTotals = Object.fromEntries((stats?.users || []).map((item) => [item.role, item.total]));
  const rideTotals = Object.fromEntries((stats?.rides || []).map((item) => [item.status, item.total]));

  return (
    <div className="stack admin-stack">
      <div className="grid-2">
        <div className="card metric-card"><small>Passageiros</small><strong>{userTotals.passenger || 0}</strong></div>
        <div className="card metric-card"><small>Motoristas</small><strong>{userTotals.driver || 0}</strong></div>
        <div className="card metric-card"><small>Online agora</small><strong>{stats?.drivers?.total_online || 0}</strong></div>
        <div className="card metric-card"><small>Receita</small><strong>R$ {stats?.revenue?.total || 0}</strong></div>
      </div>

      <div className="card">
        <h3>Status das corridas</h3>
        <div className="grid-2">
          {['requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'].map((status) => (
            <div key={status} className="card-inset"><strong>{status}</strong><p>{rideTotals[status] || 0}</p></div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Usuários</h3>
        <div className="list-stack">
          {users.map((user) => (
            <div key={user.id} className="list-item">
              <div>
                <strong>{user.name}</strong>
                <p>{user.email} • {user.role}</p>
              </div>
              <span className={`status-badge ${user.online ? 'online' : 'offline'}`}>{user.online ? 'online' : user.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Últimas corridas</h3>
        <div className="list-stack">
          {history.map((ride) => (
            <div key={ride.id} className="list-item">
              <div>
                <strong>{ride.origin_label} → {ride.destination_label}</strong>
                <p>{ride.status} • {ride.passenger_name} • {ride.driver_name || 'Sem motorista'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
