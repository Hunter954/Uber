import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import MapView from '../components/MapView';

export default function DriverPage({ user, mapCenter, drivers, currentRide, history, refreshMe, refreshCurrentRide, refreshHistory, socketRef }) {
  const [openRides, setOpenRides] = useState([]);
  const watchIdRef = useRef(null);

  async function refreshOpenRides() {
    const data = await api('/api/rides/open');
    setOpenRides(data);
  }

  useEffect(() => {
    refreshOpenRides();
    const interval = window.setInterval(() => {
      refreshOpenRides().catch(() => {});
    }, 8000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    const syncOpenRides = () => refreshOpenRides().catch(() => {});
    socket.on('ride:created', syncOpenRides);
    socket.on('ride:updated', syncOpenRides);
    socket.on('drivers:updated', syncOpenRides);

    return () => {
      socket.off('ride:created', syncOpenRides);
      socket.off('ride:updated', syncOpenRides);
      socket.off('drivers:updated', syncOpenRides);
    };
  }, [socketRef.current]);

  useEffect(() => {
    if (!user.online || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          await api('/api/driver/location', { method: 'PATCH', body: JSON.stringify({ lat, lng }) });
          socketRef.current?.emit('driver:location', { lat, lng });
          refreshMe();
        } catch {
          // noop
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [user.online]);

  async function toggleOnline() {
    await api('/api/driver/status', {
      method: 'PATCH',
      body: JSON.stringify({ online: !user.online }),
    });
    socketRef.current?.emit('driver:online', { online: !user.online });
    await refreshMe();
    await refreshOpenRides();
  }

  function sendMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      await api('/api/driver/location', { method: 'PATCH', body: JSON.stringify({ lat, lng }) });
      socketRef.current?.emit('driver:location', { lat, lng });
      refreshMe();
      refreshOpenRides();
    });
  }

  async function acceptRide(id) {
    await api(`/api/rides/${id}/accept`, { method: 'PATCH' });
    await refreshCurrentRide();
    await refreshHistory();
    await refreshOpenRides();
  }

  async function updateStatus(status) {
    if (!currentRide) return;
    await api(`/api/rides/${currentRide.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, finalFare: currentRide.estimated_fare }) });
    await refreshCurrentRide();
    await refreshHistory();
    await refreshOpenRides();
  }

  return (
    <div className="screen-grid">
      <section className="map-card">
        <div className="map-chip">● motorista em tempo real</div>
        <MapView center={mapCenter} user={user} drivers={drivers} currentRide={currentRide} />
      </section>

      <section className="stack">
        <div className="card">
          <h3>Painel do motorista</h3>
          <div className="driver-top-row">
            <span className={`status-badge ${user.online ? 'online' : 'offline'}`}>{user.online ? 'online' : 'offline'}</span>
            <button className="secondary" onClick={toggleOnline}>{user.online ? 'Ficar offline' : 'Ficar online'}</button>
          </div>
          <p className="muted">{user.vehicle_brand} {user.vehicle_model} • {user.vehicle_color} • {user.plate}</p>
          <button onClick={sendMyLocation}>Atualizar minha localização</button>
        </div>

        <div className="card">
          <h3>Corridas abertas</h3>
          <div className="list-stack">
            {openRides.map((ride) => (
              <div key={ride.id} className="list-item card-inset">
                <div>
                  <strong>{ride.origin_label} → {ride.destination_label}</strong>
                  <p>{ride.distance_to_pickup_km} km até embarque • R$ {ride.estimated_fare}</p>
                </div>
                <button onClick={() => acceptRide(ride.id)} disabled={!!currentRide}>Aceitar</button>
              </div>
            ))}
            {!openRides.length ? <p className="muted">Sem chamadas disponíveis.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Corrida atual</h3>
          {currentRide ? (
            <div className="detail-stack">
              <span className={`status-badge ${currentRide.status}`}>{currentRide.status}</span>
              <div><strong>Passageiro:</strong> {currentRide.passenger_name}</div>
              <div><strong>Origem:</strong> {currentRide.origin_label}</div>
              <div><strong>Destino:</strong> {currentRide.destination_label}</div>
              <div><strong>Valor:</strong> R$ {currentRide.estimated_fare}</div>
              <div className="grid-2">
                <button className="secondary" onClick={() => updateStatus('arrived')}>Cheguei</button>
                <button className="secondary" onClick={() => updateStatus('in_progress')}>Iniciar</button>
              </div>
              <button onClick={() => updateStatus('completed')}>Finalizar corrida</button>
            </div>
          ) : <p className="muted">Nenhuma corrida ativa.</p>}
        </div>

        <div className="card">
          <h3>Histórico</h3>
          <div className="list-stack">
            {history.map((ride) => (
              <div key={ride.id} className="list-item">
                <div>
                  <strong>{ride.origin_label} → {ride.destination_label}</strong>
                  <p>{ride.status} • R$ {ride.final_fare || ride.estimated_fare}</p>
                </div>
              </div>
            ))}
            {!history.length ? <p className="muted">Sem corridas finalizadas.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
