export default function Layout({ user, onLogout, children }) {
  return (
    <div className="app-shell">
      <header className="app-header card">
        <div>
          <span className="muted smallcaps">{user.role}</span>
          <h2>{user.name}</h2>
          <p className="muted">{user.email}</p>
        </div>
        <button className="secondary small-btn" onClick={onLogout}>Sair</button>
      </header>
      {children}
    </div>
  );
}
