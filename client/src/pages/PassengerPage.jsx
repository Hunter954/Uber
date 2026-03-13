import { useMemo, useState } from 'react';
import { api, geocodeAddress } from '../lib/api';
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
  const [searching, setSearching] = useState('');

  const onlineCount = useMemo(() => drivers.length, [drivers]);
  const previewRide = useMemo(() => ({
    origin_lat: form.originLat,
    origin_lng: form.originLng,
    destination_lat: form.destinationLat,
    destination_lng: form.destinationLng,
    status: currentRide?.status || 'requested',
    driver_id: currentRide?.driver_id || null,
    lat: currentRide?.lat || null,
    lng: currentRide?.lng || null,
  }), [form, currentRide]);

  function updateField(name, value) {
    setForm((old) => ({ ...old, [name]: value }));
    if (estimate) setEstimate(null);
  }

  async function getEstimate() {
    setError('');
    try {
      const data = await api('/api/rides/estimate', { method: 'POST', body: JSON.stringify(form) });
      setEstimate(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function searchAddress(type) {
    const labelKey = type === 'origin' ? 'originLabel' : 'destinationLabel';
    const latKey = type === 'origin' ? 'originLat' : 'destinationLat';
    const lngKey = type === 'origin' ? 'originLng' : 'destinationLng';
    setSearching(type);
    setError('');

    try {
      const data = await geocodeAddress(form[labelKey], { lat: mapCenter.lat, lng: mapCenter.lng });
      setForm((old) => ({
        ...old,
        [labelKey]: data.label,
        [latKey]: data.lat,
        [lngKey]: data.lng,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching('');
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Seu navegador não suporta geolocalização.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((old) => ({
          ...old,
          originLat: position.coords.latitude,
          originLng: position.coords.longitude,
          originLabel: 'Minha localização atual',
        }));
      },
      () => setError('Não consegui ler sua localização agora.')
    );
  }

  function swapRoute() {
    setForm((old) => ({
      ...old,
      originLabel: old.destinationLabel,
      destinationLabel: old.originLabel,
      originLat: old.destinationLat,
      originLng: old.destinationLng,
      destinationLat: old.originLat,
      destinationLng: old.originLng,
    }));
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
        <MapView center={mapCenter} user={user} drivers={drivers} currentRide={currentRide} previewRide={!currentRide ? previewRide : null} />
      </section>

      <section className="stack">
        <div className="card">
          <h3>Chamar corrida</h3>
          <form className="form-stack" onSubmit={requestRide}>
            <div className="search-row">
              <input value={form.originLabel} onChange={(e) => updateField('originLabel', e.target.value)} placeholder="Origem" />
              <button type="button" className="secondary compact-btn" onClick={() => searchAddress('origin')} disabled={searching === 'origin'}>
                {searching === 'origin' ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <div className="search-actions">
              <button type="button" className="secondary compact-btn" onClick={useMyLocation}>Usar minha localização</button>
              <button type="button" className="secondary compact-btn" onClick={swapRoute}>Trocar rota</button>
            </div>
            <div className="search-row">
              <input value={form.destinationLabel} onChange={(e) => updateField('destinationLabel', e.target.value)} placeholder="Destino" />
              <button type="button" className="secondary compact-btn" onClick={() => searchAddress('destination')} disabled={searching === 'destination'}>
                {searching === 'destination' ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <div className="grid-2 coords-grid">
              <input value={form.originLat} onChange={(e) => updateField('originLat', Number(e.target.value))} placeholder="Origem lat" />
              <input value={form.originLng} onChange={(e) => updateField('originLng', Number(e.target.value))} placeholder="Origem lng" />
            </div>
            <div className="grid-2 coords-grid">
              <input value={form.destinationLat} onChange={(e) => updateField('destinationLat', Number(e.target.value))} placeholder="Destino lat" />
              <input value={form.destinationLng} onChange={(e) => updateField('destinationLng', Number(e.target.value))} placeholder="Destino lng" />
            </div>
            <select value={form.paymentMethod} onChange={(e) => updateField('paymentMethod', e.target.value)}>
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
            </select>
            <input value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Observações" />
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
              {currentRide.driver_name && currentRide.lat && currentRide.lng ? (
                <div className="info-box">Motorista em tempo real: {Number(currentRide.lat).toFixed(5)}, {Number(currentRide.lng).toFixed(5)}</div>
              ) : null}
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
