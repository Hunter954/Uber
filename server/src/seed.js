const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function ensureUser({ name, email, password, role, phone, driver }) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount) return;

  const passwordHash = await bcrypt.hash(password, 10);
  const userResult = await query(
    `INSERT INTO users (name, email, password_hash, role, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [name, email, passwordHash, role, phone || null]
  );

  const userId = userResult.rows[0].id;
  if (role === 'driver') {
    await query(
      `INSERT INTO drivers (user_id, vehicle_brand, vehicle_model, vehicle_color, plate, category, online, approved, lat, lng, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, $8, NOW())`,
      [
        userId,
        driver.vehicleBrand,
        driver.vehicleModel,
        driver.vehicleColor,
        driver.plate,
        driver.category || 'economy',
        Number(process.env.MAP_DEFAULT_LAT || -25.5163) + 0.01,
        Number(process.env.MAP_DEFAULT_LNG || -54.5854) + 0.01,
      ]
    );
  }
}

async function seedDemo() {
  if (String(process.env.DEMO_SEED).toLowerCase() !== 'true') return;

  await ensureUser({ name: 'Admin Uberzinho', email: 'admin@uberzinho.local', password: '123456', role: 'admin' });
  await ensureUser({ name: 'Passageiro Demo', email: 'passageiro@uberzinho.local', password: '123456', role: 'passenger', phone: '(45) 99999-0001' });
  await ensureUser({
    name: 'Motorista Demo',
    email: 'motorista@uberzinho.local',
    password: '123456',
    role: 'driver',
    phone: '(45) 99999-0002',
    driver: {
      vehicleBrand: 'Chevrolet',
      vehicleModel: 'Onix',
      vehicleColor: 'Prata',
      plate: 'ABC1D23',
      category: 'economy',
    },
  });
}

module.exports = { seedDemo };
