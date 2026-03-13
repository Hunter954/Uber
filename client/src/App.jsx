import { useEffect, useMemo, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import Layout from './components/Layout';
import PassengerPage from './pages/PassengerPage';
import DriverPage from './pages/DriverPage';
import AdminPage from './pages/AdminPage';
import { api } from './lib/api';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('uberzinho_token'));
  const [user, setUser] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: -25.5163, lng: -54.5854, city: 'Foz do Iguaçu' });
  const [drivers, setDrivers] = useState([]);
  const [currentRide, setCurrentRide] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [bootLoading, setBootLoading] = useState(true);

  const currentRideId = useMemo(() => currentRide?.id || null, [currentRide?.id]);

  const socketRef = useSocket(token, {
    bootstrap: (payload) => {
      if (payload?.mapCenter) setMapCenter(payload.mapCenter);
      if (payload?.drivers) setDrivers(payload.drivers);
    },
    'drivers:updated': (payload) => setDrivers(payload),
    'ride:updated': (payload) => {
      setCurrentRide((old) => (old?.id === payload.id ? payload : old));
      refreshHistory();
      if (!currentRideId || payload.id === currentRideId) refreshCurrentRide();
      if (user?.role === 'admin') refreshAdmin();
    },
    'ride:created': () => {
      if (user?.role === 'driver') refreshHistory();
    },
  });

  async function refreshBootstrap() {
    const data = await api('/api/bootstrap');
    setMapCenter(data.mapCenter);
    setDrivers(data.drivers || []);
  }

  async function refreshMe() {
    const data = await api('/api/me');
    setUser(data);
    return data;
  }

  async function refreshCurrentRide() {
    const data = await api('/api/rides/current');
    setCurrentRide(data);
    return data;
  }

  async function refreshHistory() {
    const data = await api('/api/rides/history');
    setHistory(data);
    return data;
  }

  async function refreshAdmin() {
    const [statsData, usersData] = await Promise.all([
      api('/api/admin/stats'),
      api('/api/admin/users'),
    ]);
    setStats(statsData);
    setUsers(usersData);
  }

  useEffect(() => {
    refreshBootstrap().finally(() => setBootLoading(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([refreshMe(), refreshCurrentRide(), refreshHistory()])
      .then(async ([me]) => {
        if (me?.role === 'admin') await refreshAdmin();
      })
      .catch(() => logout());
  }, [token]);


  useEffect(() => {
    if (!currentRideId || !socketRef.current) return;
    socketRef.current.emit('ride:watch', { rideId: currentRideId });
  }, [currentRideId, socketRef.current]);

  async function login(credentials) {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    localStorage.setItem('uberzinho_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(payload) {
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    localStorage.setItem('uberzinho_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('uberzinho_token');
    setToken(null);
    setUser(null);
    setCurrentRide(null);
    setHistory([]);
    setStats(null);
    setUsers([]);
  }

  if (bootLoading) return <div className="center-screen">Carregando app...</div>;
  if (!token || !user) return <AuthScreen onLogin={login} onRegister={register} />;

  return (
    <Layout user={user} onLogout={logout}>
      {user.role === 'passenger' && (
        <PassengerPage
          user={user}
          mapCenter={mapCenter}
          drivers={drivers}
          currentRide={currentRide}
          history={history}
          refreshCurrentRide={refreshCurrentRide}
          refreshHistory={refreshHistory}
        />
      )}

      {user.role === 'driver' && (
        <DriverPage
          user={user}
          mapCenter={mapCenter}
          drivers={drivers}
          currentRide={currentRide}
          history={history}
          refreshMe={refreshMe}
          refreshCurrentRide={refreshCurrentRide}
          refreshHistory={refreshHistory}
          socketRef={socketRef}
        />
      )}

      {user.role === 'admin' && <AdminPage stats={stats} users={users} history={history} />}
    </Layout>
  );
}
