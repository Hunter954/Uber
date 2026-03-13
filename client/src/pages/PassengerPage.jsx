import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import MapView from '../components/MapView';

export default function PassengerPage({ user, mapCenter, drivers, currentRide, history, refreshCurrentRide, refreshHistory }) {
  const [form, setForm] = useState({
    originLabel: `${mapCenter.city} Centro`,
    destinationLabel: 'Rodoviária',
    originLat: mapCenter.lat,
    originLng: mapCenter.lng,
    destinationLat: mapCenter.lat + 0.018,
    destinationLng: mapCenter.lng + 0.015,
    paymentMethod: 'cash',
    notes: '',
  });
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onlineCount = useMemo(() => drivers.length, [drivers]);

  async function getEstimate() {
    setError('');
    try {
      const data = await api('/api/rides/estimate', { method: 'POST', body: JSON.stringify(form) });
      setEstimate(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function requestRide(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/api/rides', { method: 'POST', body: JSON.stringify(form) });
      await refreshCurrentRide();
      await refreshHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRide() {
    if (!currentRide) return;
    await api(`/api/rides/${currentRide.id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ cancelledReason: 'Cancelada pelo passageiro no app' }),
    });
    await refreshCurrentRide();
    await refreshHistory();
  }

  return (
    <div className="screen-grid">
      <section className="map-card">
        <div className="map-chip">● {onlineCount} motoristas online</div>
        <MapView center={mapCenter} user={user} drivers={drivers} currentRide={currentRide} />
      </section>

      <section className="stack">
        <div className="card">
          <h3>Chamar corrida</h3>
          <form className="form-stack" onSubmit={requestRide}>
            <input value={form.originLabel} onChange={(e) => setForm({ ...form, originLabel: e.target.value })} placeholder="Origem" />
            <input value={form.destinationLabel} onChange={(e) => setForm({ ...form, destinationLabel: e.target.value })} placeholder="Destino" />
            <div className="grid-2">
              <input value={form.originLat} onChange={(e) => setForm({ ...form, originLat: Number(e.target.value) })} placeholder="Origem lat" />
              <input value={form.originLng} onChange={(e) => setForm({ ...form, originLng: Number(e.target.value) })} placeholder="Origem lng" />
            </div>
            <div className="grid-2">
              <input value={form.destinationLat} onChange={(e) => setForm({ ...form, destinationLat: Number(e.target.value) })} placeholder="Destino lat" />
              <input value={form.destinationLng} onChange={(e) => setForm({ ...form, destinationLng: Number(e.target.value) })} placeholder="Destino lng" />
            </div>
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
            </select>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações" />
            <div className="grid-2">
              <button type="button" className="secondary" onClick={getEstimate}>Ver estimativa</button>
              <button type="submit" disabled={loading || !!currentRide}>{loading ? 'Enviando...' : 'Solicitar'}</button>
            </div>
          </form>
          {estimate ? <p className="muted">{estimate.estimatedDistanceKm} km • {estimate.estimatedDurationMin} min • R$ {estimate.estimatedFare}</p> : null}
          {error ? <div className="error-box">{error}</div> : null}
        </div>

        <div className="card">
          <h3>Corrida atual</h3>
          {currentRide ? (
            <div className="detail-stack">
              <span className={`status-badge ${currentRide.status}`}>{currentRide.status}</span>
              <div><strong>Origem:</strong> {currentRide.origin_label}</div>
              <div><strong>Destino:</strong> {currentRide.destination_label}</div>
              <div><strong>Estimativa:</strong> R$ {currentRide.estimated_fare}</div>
              <div><strong>Pagamento:</strong> {currentRide.payment_method}</div>
              {currentRide.driver_name ? <div><strong>Motorista:</strong> {currentRide.driver_name}</div> : <div className="muted">Aguardando motorista aceitar.</div>}
              {!['completed', 'cancelled'].includes(currentRide.status) ? (
                <button className="danger" onClick={cancelRide}>Cancelar corrida</button>
              ) : null}
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
            {!history.length ? <p className="muted">Sem corridas ainda.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
