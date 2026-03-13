import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getRoutePath } from '../lib/api';

const driverIcon = new L.DivIcon({
  className: 'marker-wrap',
  html: '<div class="marker driver"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const passengerIcon = new L.DivIcon({
  className: 'marker-wrap',
  html: '<div class="marker passenger"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const pinIcon = new L.DivIcon({
  className: 'marker-wrap',
  html: '<div class="marker pin"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapViewport({ center, points }) {
  const map = useMap();

  useEffect(() => {
    const validPoints = (points || []).filter(
      (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );

    if (validPoints.length >= 2) {
      map.fitBounds(validPoints, { padding: [40, 40] });
      return;
    }

    if (center?.lat && center?.lng) {
      map.setView([center.lat, center.lng], map.getZoom() || 13);
    }
  }, [map, center?.lat, center?.lng, JSON.stringify(points)]);

  return null;
}

export default function MapView({ center, user, drivers = [], currentRide, previewRide }) {
  const activeRide = previewRide || currentRide || null;
  const origin = activeRide && Number.isFinite(Number(activeRide.origin_lat)) && Number.isFinite(Number(activeRide.origin_lng))
    ? [Number(activeRide.origin_lat), Number(activeRide.origin_lng)]
    : null;
  const destination = activeRide && Number.isFinite(Number(activeRide.destination_lat)) && Number.isFinite(Number(activeRide.destination_lng))
    ? [Number(activeRide.destination_lat), Number(activeRide.destination_lng)]
    : null;
  const driverPoint = activeRide?.driver_id && Number.isFinite(Number(activeRide.lat)) && Number.isFinite(Number(activeRide.lng))
    ? [Number(activeRide.lat), Number(activeRide.lng)]
    : null;
  const userPoint = user?.role === 'driver' && Number.isFinite(Number(user?.lat)) && Number.isFinite(Number(user?.lng))
    ? [Number(user.lat), Number(user.lng)]
    : null;

  const routePoints = useMemo(() => {
    if (!origin || !destination) return [];
    if (driverPoint && ['accepted', 'arrived'].includes(activeRide?.status)) {
      return [
        { lat: driverPoint[0], lng: driverPoint[1] },
        { lat: origin[0], lng: origin[1] },
        { lat: destination[0], lng: destination[1] },
      ];
    }

    if (driverPoint && activeRide?.status === 'in_progress') {
      return [
        { lat: driverPoint[0], lng: driverPoint[1] },
        { lat: destination[0], lng: destination[1] },
      ];
    }

    return [
      { lat: origin[0], lng: origin[1] },
      { lat: destination[0], lng: destination[1] },
    ];
  }, [origin?.join(','), destination?.join(','), driverPoint?.join(','), activeRide?.status]);

  const [routePath, setRoutePath] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      if (routePoints.length < 2) {
        setRoutePath([]);
        return;
      }

      try {
        const path = await getRoutePath(routePoints);
        if (!cancelled) setRoutePath(path.length ? path : routePoints.map((point) => [point.lat, point.lng]));
      } catch {
        if (!cancelled) setRoutePath(routePoints.map((point) => [point.lat, point.lng]));
      }
    }

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(routePoints)]);

  const viewportPoints = [origin, destination, driverPoint, userPoint]
    .filter(Boolean)
    .concat(routePath);

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />

      <MapViewport center={center} points={viewportPoints} />

      {drivers.map((driver) => (
        <Marker key={driver.id} position={[driver.lat, driver.lng]} icon={driverIcon}>
          <Popup>
            <strong>{driver.name}</strong>
            <div>{driver.vehicle_brand} {driver.vehicle_model}</div>
            <div>{driver.vehicle_color} • {driver.plate}</div>
          </Popup>
        </Marker>
      ))}

      {userPoint && (
        <Marker position={userPoint} icon={driverIcon}>
          <Popup>Você</Popup>
        </Marker>
      )}

      {driverPoint && (!userPoint || driverPoint.join(',') !== userPoint.join(',')) && (
        <Marker position={driverPoint} icon={driverIcon}>
          <Popup>Motorista</Popup>
        </Marker>
      )}

      {origin && <Marker position={origin} icon={passengerIcon}><Popup>Origem</Popup></Marker>}
      {destination && <Marker position={destination} icon={pinIcon}><Popup>Destino</Popup></Marker>}
      {routePath.length >= 2 && <Polyline positions={routePath} pathOptions={{ weight: 5 }} />}
    </MapContainer>
  );
}
