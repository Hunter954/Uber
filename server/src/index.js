require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { migrate, query, transaction } = require('./db');
const { signToken, authRequired, roleRequired, socketAuth } = require('./auth');
const { estimateRide, haversineKm } = require('./utils');
const { seedDemo } = require('./seed');
const { setLiveSocket, removeLiveSocket } = require('./realtime');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL?.split(',') || '*',
    methods: ['GET', 'POST', 'PATCH'],
  },
});

app.use(cors());
app.use(express.json());

const mapCenter = {
  lat: Number(process.env.MAP_DEFAULT_LAT || -25.5163),
  lng: Number(process.env.MAP_DEFAULT_LNG || -54.5854),
  city: process.env.MAP_DEFAULT_CITY || 'Foz do Iguaçu',
};

async function getUserProfile(userId) {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.created_at,
            d.id AS driver_id, d.vehicle_brand, d.vehicle_model, d.vehicle_color, d.plate,
            d.category, d.online, d.approved, d.rating, d.lat, d.lng, d.last_seen_at
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getOnlineDrivers() {
  const result = await query(
    `SELECT d.id, d.user_id, u.name, u.phone, d.vehicle_brand, d.vehicle_model, d.vehicle_color,
            d.plate, d.category, d.online, d.approved, d.rating, d.lat, d.lng, d.last_seen_at
       FROM drivers d
       JOIN users u ON u.id = d.user_id
      WHERE d.online = true AND d.approved = true AND d.lat IS NOT NULL AND d.lng IS NOT NULL
      ORDER BY d.updated_at DESC`
  );
  return result.rows;
}

async function getRideById(rideId) {
  const result = await query(
    `SELECT r.*, p.name AS passenger_name, p.phone AS passenger_phone,
            u.name AS driver_name, u.phone AS driver_phone,
            d.vehicle_brand, d.vehicle_model, d.vehicle_color, d.plate, d.category, d.user_id AS driver_user_id, d.lat, d.lng
       FROM rides r
       JOIN users p ON p.id = r.passenger_id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN users u ON u.id = d.user_id
      WHERE r.id = $1`,
    [rideId]
  );
  return result.rows[0] || null;
}

async function serializeRide(rideId) {
  const ride = await getRideById(rideId);
  return ride;
}

async function broadcastRide(rideId) {
  const ride = await serializeRide(rideId);
  if (!ride) return;
  io.emit('ride:updated', ride);
}

async function broadcastDrivers() {
  io.emit('drivers:updated', await getOnlineDrivers());
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, name: process.env.APP_NAME || 'Uberzinho V2', mapCenter });
});

app.get('/api/bootstrap', async (_req, res) => {
  res.json({ mapCenter, drivers: await getOnlineDrivers() });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone, role, driver } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Preencha nome, email, senha e perfil.' });
  }
  if (!['passenger', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }

  const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (exists.rowCount) return res.status(409).json({ error: 'E-mail já cadastrado.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await transaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), passwordHash, role, phone || null]
    );

    const createdUser = userResult.rows[0];
    if (role === 'driver') {
      await client.query(
        `INSERT INTO drivers (user_id, vehicle_brand, vehicle_model, vehicle_color, plate, category, approved)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [
          createdUser.id,
          driver?.vehicleBrand || null,
          driver?.vehicleModel || null,
          driver?.vehicleColor || null,
          driver?.plate || null,
          driver?.category || 'economy',
        ]
      );
    }
    return createdUser;
  });

  const fullProfile = await getUserProfile(user.id);
  res.status(201).json({ token: signToken(user), user: fullProfile });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const result = await query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const fullProfile = await getUserProfile(user.id);
  res.json({ token: signToken(user), user: fullProfile });
});

app.get('/api/me', authRequired, async (req, res) => {
  const user = await getUserProfile(req.auth.sub);
  res.json(user);
});

app.get('/api/drivers/online', authRequired, async (_req, res) => {
  res.json(await getOnlineDrivers());
});

app.patch('/api/driver/status', authRequired, roleRequired('driver'), async (req, res) => {
  const { online } = req.body || {};
  const user = await getUserProfile(req.auth.sub);
  await query(
    `UPDATE drivers
        SET online = $1, updated_at = NOW(), last_seen_at = NOW()
      WHERE user_id = $2`,
    [Boolean(online), user.id]
  );
  await broadcastDrivers();
  res.json(await getUserProfile(user.id));
});

app.patch('/api/driver/location', authRequired, roleRequired('driver'), async (req, res) => {
  const { lat, lng } = req.body || {};
  await query(
    `UPDATE drivers
        SET lat = $1, lng = $2, online = true, last_seen_at = NOW(), updated_at = NOW()
      WHERE user_id = $3`,
    [Number(lat), Number(lng), req.auth.sub]
  );
  await broadcastDrivers();
  res.json({ ok: true });
});

app.get('/api/rides/current', authRequired, async (req, res) => {
  const user = await getUserProfile(req.auth.sub);
  let sql;
  let params;

  if (user.role === 'passenger') {
    sql = `SELECT id FROM rides WHERE passenger_id = $1 AND status IN ('requested', 'accepted', 'arrived', 'in_progress') ORDER BY created_at DESC LIMIT 1`;
    params = [user.id];
  } else if (user.role === 'driver') {
    sql = `SELECT r.id FROM rides r JOIN drivers d ON d.id = r.driver_id WHERE d.user_id = $1 AND r.status IN ('accepted', 'arrived', 'in_progress') ORDER BY r.created_at DESC LIMIT 1`;
    params = [user.id];
  } else {
    return res.json(null);
  }

  const result = await query(sql, params);
  if (!result.rowCount) return res.json(null);
  res.json(await serializeRide(result.rows[0].id));
});

app.get('/api/rides/history', authRequired, async (req, res) => {
  const user = await getUserProfile(req.auth.sub);
  let result;

  if (user.role === 'passenger') {
    result = await query(`SELECT id FROM rides WHERE passenger_id = $1 ORDER BY created_at DESC LIMIT 30`, [user.id]);
  } else if (user.role === 'driver') {
    result = await query(
      `SELECT r.id
         FROM rides r
         JOIN drivers d ON d.id = r.driver_id
        WHERE d.user_id = $1
        ORDER BY r.created_at DESC
        LIMIT 30`,
      [user.id]
    );
  } else {
    result = await query(`SELECT id FROM rides ORDER BY created_at DESC LIMIT 30`);
  }

  const rides = await Promise.all(result.rows.map((row) => serializeRide(row.id)));
  res.json(rides);
});

app.post('/api/rides/estimate', authRequired, roleRequired('passenger'), async (req, res) => {
  const { originLat, originLng, destinationLat, destinationLng } = req.body || {};
  res.json(estimateRide({ originLat, originLng, destinationLat, destinationLng }));
});

app.post('/api/rides', authRequired, roleRequired('passenger'), async (req, res) => {
  const {
    originLabel,
    destinationLabel,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    paymentMethod,
    notes,
  } = req.body || {};

  if (!originLabel || !destinationLabel) {
    return res.status(400).json({ error: 'Informe origem e destino.' });
  }

  const activeRide = await query(
    `SELECT id FROM rides WHERE passenger_id = $1 AND status IN ('requested', 'accepted', 'arrived', 'in_progress') LIMIT 1`,
    [req.auth.sub]
  );
  if (activeRide.rowCount) {
    return res.status(409).json({ error: 'Você já possui uma corrida ativa.' });
  }

  const estimate = estimateRide({ originLat, originLng, destinationLat, destinationLng });
  const rideResult = await query(
    `INSERT INTO rides (
      passenger_id, status, origin_label, destination_label, origin_lat, origin_lng,
      destination_lat, destination_lng, estimated_distance_km, estimated_duration_min,
      estimated_fare, payment_method, notes
    ) VALUES ($1, 'requested', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      req.auth.sub,
      originLabel,
      destinationLabel,
      Number(originLat),
      Number(originLng),
      Number(destinationLat),
      Number(destinationLng),
      estimate.estimatedDistanceKm,
      estimate.estimatedDurationMin,
      estimate.estimatedFare,
      paymentMethod || 'cash',
      notes || null,
    ]
  );

  const ride = await serializeRide(rideResult.rows[0].id);
  io.emit('ride:created', ride);
  await broadcastRide(ride.id);
  res.status(201).json(ride);
});

app.get('/api/rides/open', authRequired, roleRequired('driver', 'admin'), async (req, res) => {
  const user = await getUserProfile(req.auth.sub);
  let driverLat = mapCenter.lat;
  let driverLng = mapCenter.lng;
  if (user.driver_id && user.lat && user.lng) {
    driverLat = Number(user.lat);
    driverLng = Number(user.lng);
  }

  const result = await query(
    `SELECT r.id
       FROM rides r
      WHERE r.status = 'requested'
      ORDER BY r.created_at DESC
      LIMIT 20`
  );

  const rides = await Promise.all(result.rows.map((row) => serializeRide(row.id)));
  const enriched = rides.map((ride) => ({
    ...ride,
    distance_to_pickup_km: Number(haversineKm(driverLat, driverLng, ride.origin_lat, ride.origin_lng).toFixed(2)),
  }));
  res.json(enriched.sort((a, b) => a.distance_to_pickup_km - b.distance_to_pickup_km));
});

app.patch('/api/rides/:id/accept', authRequired, roleRequired('driver'), async (req, res) => {
  const user = await getUserProfile(req.auth.sub);
  if (!user.driver_id) return res.status(400).json({ error: 'Motorista inválido.' });

  const active = await query(
    `SELECT r.id
       FROM rides r
      WHERE r.driver_id = $1 AND r.status IN ('accepted', 'arrived', 'in_progress')
      LIMIT 1`,
    [user.driver_id]
  );
  if (active.rowCount) return res.status(409).json({ error: 'Finalize a corrida atual antes de aceitar outra.' });

  const result = await query(
    `UPDATE rides
        SET driver_id = $1, status = 'accepted', accepted_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND status = 'requested'
      RETURNING id`,
    [user.driver_id, req.params.id]
  );

  if (!result.rowCount) return res.status(409).json({ error: 'Corrida já foi aceita ou não existe.' });
  await broadcastRide(req.params.id);
  res.json(await serializeRide(req.params.id));
});

app.patch('/api/rides/:id/status', authRequired, roleRequired('driver', 'admin'), async (req, res) => {
  const { status, finalFare, cancelledReason } = req.body || {};
  if (!['arrived', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  const ride = await getRideById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });

  const user = await getUserProfile(req.auth.sub);
  if (user.role === 'driver' && String(ride.driver_user_id) !== String(user.id)) {
    return res.status(403).json({ error: 'Você não pode alterar esta corrida.' });
  }

  await query(
    `UPDATE rides
        SET status = $1,
            started_at = CASE WHEN $1 = 'in_progress' THEN COALESCE(started_at, NOW()) ELSE started_at END,
            completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
            cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END,
            final_fare = COALESCE($2, final_fare),
            cancelled_reason = COALESCE($3, cancelled_reason),
            updated_at = NOW()
      WHERE id = $4`,
    [status, finalFare || null, cancelledReason || null, req.params.id]
  );

  await broadcastRide(req.params.id);
  res.json(await serializeRide(req.params.id));
});

app.patch('/api/rides/:id/cancel', authRequired, async (req, res) => {
  const ride = await getRideById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Corrida não encontrada.' });
  if (String(ride.passenger_id) !== String(req.auth.sub) && req.auth.role !== 'admin') {
    return res.status(403).json({ error: 'Sem permissão para cancelar.' });
  }
  if (['completed', 'cancelled'].includes(ride.status)) {
    return res.status(409).json({ error: 'Corrida já encerrada.' });
  }

  await query(
    `UPDATE rides SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = $1, updated_at = NOW() WHERE id = $2`,
    [req.body?.cancelledReason || 'Cancelada pelo passageiro', req.params.id]
  );
  await broadcastRide(req.params.id);
  res.json(await serializeRide(req.params.id));
});

app.get('/api/admin/stats', authRequired, roleRequired('admin'), async (_req, res) => {
  const [users, drivers, rides, revenue] = await Promise.all([
    query(`SELECT role, COUNT(*)::int AS total FROM users GROUP BY role`),
    query(`SELECT COUNT(*)::int AS total_online FROM drivers WHERE online = true`),
    query(`SELECT status, COUNT(*)::int AS total FROM rides GROUP BY status`),
    query(`SELECT COALESCE(SUM(COALESCE(final_fare, estimated_fare)), 0)::numeric(10,2) AS total FROM rides WHERE status = 'completed'`),
  ]);
  res.json({
    users: users.rows,
    drivers: drivers.rows[0],
    rides: rides.rows,
    revenue: revenue.rows[0],
  });
});

app.get('/api/admin/users', authRequired, roleRequired('admin'), async (_req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.created_at,
            d.online, d.vehicle_brand, d.vehicle_model, d.plate, d.category, d.approved
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
      ORDER BY u.created_at DESC`
  );
  res.json(result.rows);
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

io.use(socketAuth);
io.on('connection', async (socket) => {
  setLiveSocket(socket.user.sub, socket.id);
  socket.emit('bootstrap', { mapCenter, drivers: await getOnlineDrivers() });

  socket.on('driver:location', async ({ lat, lng }) => {
    if (socket.user.role !== 'driver') return;
    await query(
      `UPDATE drivers
          SET lat = $1, lng = $2, online = true, last_seen_at = NOW(), updated_at = NOW()
        WHERE user_id = $3`,
      [Number(lat), Number(lng), socket.user.sub]
    );
    await broadcastDrivers();
  });

  socket.on('driver:online', async ({ online }) => {
    if (socket.user.role !== 'driver') return;
    await query(`UPDATE drivers SET online = $1, updated_at = NOW(), last_seen_at = NOW() WHERE user_id = $2`, [Boolean(online), socket.user.sub]);
    await broadcastDrivers();
  });

  socket.on('ride:watch', async ({ rideId }) => {
    const ride = await serializeRide(rideId);
    if (ride) socket.emit('ride:updated', ride);
  });

  socket.on('disconnect', async () => {
    removeLiveSocket(socket.id);
  });
});

async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não configurada.');
  }

  await migrate();
  await seedDemo();

  const PORT = Number(process.env.PORT) || 8080;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Uberzinho V2 rodando em http://0.0.0.0:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
