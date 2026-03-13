function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (n) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateRide({ originLat, originLng, destinationLat, destinationLng }) {
  const distanceKm = haversineKm(originLat, originLng, destinationLat, destinationLng);
  const durationMin = Math.max(4, Math.round(distanceKm * 2.8));
  const fare = 6 + distanceKm * 2.7 + durationMin * 0.22;
  return {
    estimatedDistanceKm: Number(distanceKm.toFixed(2)),
    estimatedDurationMin: durationMin,
    estimatedFare: Number(fare.toFixed(2)),
  };
}

module.exports = { haversineKm, estimateRide };
