import { useState } from 'react';

const demoAccounts = [
  { label: 'Admin demo', email: 'admin@uberzinho.local', password: '123456' },
  { label: 'Passageiro demo', email: 'passageiro@uberzinho.local', password: '123456' },
  { label: 'Motorista demo', email: 'motorista@uberzinho.local', password: '123456' },
];

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('passenger');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
    plate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin({ email: form.email, password: form.password });
      } else {
        await onRegister({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          role,
          driver: role === 'driver' ? {
            vehicleBrand: form.vehicleBrand,
            vehicleModel: form.vehicleModel,
            vehicleColor: form.vehicleColor,
            plate: form.plate,
          } : undefined,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-block">
          <span className="chip">MVP V2</span>
          <h1>Uberzinho</h1>
          <p>App mobile-first para cidade pequena, com mapa e corrida em tempo real.</p>
        </div>

        <div className="auth-segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Criar conta</button>
        </div>

        <form className="form-stack" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <input placeholder="Nome" value={form.name} onChange={(e) => update('name', e.target.value)} />
              <div className="auth-segmented compact">
                <button type="button" className={role === 'passenger' ? 'active' : ''} onClick={() => setRole('passenger')}>Passageiro</button>
                <button type="button" className={role === 'driver' ? 'active' : ''} onClick={() => setRole('driver')}>Motorista</button>
              </div>
            </>
          )}
          <input placeholder="E-mail" value={form.email} onChange={(e) => update('email', e.target.value)} />
          <input placeholder="Senha" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} />
          {mode === 'register' && (
            <>
              <input placeholder="Telefone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              {role === 'driver' && (
                <>
                  <input placeholder="Marca do veículo" value={form.vehicleBrand} onChange={(e) => update('vehicleBrand', e.target.value)} />
                  <input placeholder="Modelo do veículo" value={form.vehicleModel} onChange={(e) => update('vehicleModel', e.target.value)} />
                  <input placeholder="Cor do veículo" value={form.vehicleColor} onChange={(e) => update('vehicleColor', e.target.value)} />
                  <input placeholder="Placa" value={form.plate} onChange={(e) => update('plate', e.target.value)} />
                </>
              )}
            </>
          )}

          {error ? <div className="error-box">{error}</div> : null}
          <button type="submit" disabled={loading}>{loading ? 'Carregando...' : mode === 'login' ? 'Entrar agora' : 'Criar conta'}</button>
        </form>

        <div className="demo-box">
          <strong>Contas demo</strong>
          {demoAccounts.map((account) => (
            <button
              key={account.label}
              className="ghost-action"
              onClick={() => {
                setMode('login');
                setForm((old) => ({ ...old, email: account.email, password: account.password }));
              }}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
