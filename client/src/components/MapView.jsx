import { MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet';
import L from 'leaflet';

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

export default function MapView({ center, user, drivers = [], currentRide }) {
  const origin = currentRide
    ? [Number(currentRide.origin_lat), Number(currentRide.origin_lng)]
    : null;
  const destination = currentRide
    ? [Number(currentRide.destination_lat), Number(currentRide.destination_lng)]
    : null;
  const driverPoint = currentRide?.driver_id && currentRide?.lat && currentRide?.lng
    ? [Number(currentRide.lat), Number(currentRide.lng)]
    : null;

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />

      {drivers.map((driver) => (
        <Marker key={driver.id} position={[driver.lat, driver.lng]} icon={driverIcon}>
          <Popup>
            <strong>{driver.name}</strong>
            <div>{driver.vehicle_brand} {driver.vehicle_model}</div>
            <div>{driver.vehicle_color} • {driver.plate}</div>
          </Popup>
        </Marker>
      ))}

      {user?.role === 'driver' && user?.lat && user?.lng && (
        <Marker position={[user.lat, user.lng]} icon={driverIcon}>
          <Popup>Você</Popup>
        </Marker>
      )}

      {origin && <Marker position={origin} icon={passengerIcon}><Popup>Origem</Popup></Marker>}
      {destination && <Marker position={destination} icon={pinIcon}><Popup>Destino</Popup></Marker>}
      {origin && destination && <Polyline positions={[origin, destination]} />}
    </MapContainer>
  );
}
