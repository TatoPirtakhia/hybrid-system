import * as SQLite from 'expo-sqlite';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
export const getDatabase = (): Promise<SQLite.SQLiteDatabase> => database ??= openDatabase();
const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync('prius-companion.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS known_adapters (id TEXT PRIMARY KEY, transport TEXT NOT NULL, name TEXT NOT NULL, configuration_json TEXT, last_connected_at TEXT);
    CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, name TEXT, started_at TEXT NOT NULL, ended_at TEXT, duration_seconds REAL, distance_km REAL, fuel_litres_estimated REAL, average_litres_per_100km REAL, max_speed REAL, average_speed REAL, adapter_disconnect_count INTEGER, sample_count INTEGER, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS trip_samples (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL, sampled_at TEXT NOT NULL, samples_json TEXT NOT NULL, FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS diagnostic_scans (id TEXT PRIMARY KEY, scanned_at TEXT NOT NULL, raw_response TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS diagnostic_codes (scan_id TEXT NOT NULL, ecu TEXT, code TEXT NOT NULL, description TEXT);
    CREATE TABLE IF NOT EXISTS vehicle_actions (id TEXT PRIMARY KEY, action_id TEXT NOT NULL, attempted_at TEXT NOT NULL, status TEXT NOT NULL, detail TEXT);
    CREATE TABLE IF NOT EXISTS connection_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, recorded_at TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL);
  `);
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(trips)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('engine_running_km')) await db.withTransactionAsync(async () => {
    await db.execAsync('ALTER TABLE trips ADD COLUMN engine_running_km REAL NOT NULL DEFAULT 0; ALTER TABLE trips ADD COLUMN engine_off_km REAL NOT NULL DEFAULT 0; ALTER TABLE trips ADD COLUMN unknown_propulsion_km REAL NOT NULL DEFAULT 0; UPDATE trips SET unknown_propulsion_km = COALESCE(distance_km, 0);');
    await db.runAsync('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (2, ?)', new Date().toISOString());
  });
  return db;
};

export const deleteAllLocalData = async (): Promise<void> => {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM trip_samples; DELETE FROM trips; DELETE FROM diagnostic_codes; DELETE FROM diagnostic_scans; DELETE FROM vehicle_actions; DELETE FROM connection_logs; DELETE FROM known_adapters;');
};

export interface StoredTrip { id: string; name: string | null; startedAt: string; endedAt: string | null; durationSeconds: number; distanceKm: number; fuelLitresEstimated: number; averageLitresPer100Km: number | null; sampleCount: number; engineRunningKm: number; engineOffKm: number; unknownPropulsionKm: number }

export const upsertTrip = async (trip: { id: string; startedAt: number; endedAt?: number; durationSeconds: number; distanceKm: number; fuelLitresEstimated: number; averageLitresPer100Km: number | null; maxSpeed: number; averageSpeed: number; adapterDisconnectCount: number; sampleCount: number; engineRunningKm: number; engineOffKm: number; unknownPropulsionKm: number }): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO trips (id, started_at, ended_at, duration_seconds, distance_km, fuel_litres_estimated, average_litres_per_100km, max_speed, average_speed, adapter_disconnect_count, sample_count, created_at, engine_running_km, engine_off_km, unknown_propulsion_km)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET ended_at=excluded.ended_at, duration_seconds=excluded.duration_seconds, distance_km=excluded.distance_km, fuel_litres_estimated=excluded.fuel_litres_estimated, average_litres_per_100km=excluded.average_litres_per_100km, max_speed=excluded.max_speed, average_speed=excluded.average_speed, adapter_disconnect_count=excluded.adapter_disconnect_count, sample_count=excluded.sample_count, engine_running_km=excluded.engine_running_km, engine_off_km=excluded.engine_off_km, unknown_propulsion_km=excluded.unknown_propulsion_km`,
    trip.id, new Date(trip.startedAt).toISOString(), trip.endedAt ? new Date(trip.endedAt).toISOString() : null, trip.durationSeconds, trip.distanceKm, trip.fuelLitresEstimated, trip.averageLitresPer100Km, trip.maxSpeed, trip.averageSpeed, trip.adapterDisconnectCount, trip.sampleCount, new Date().toISOString(), trip.engineRunningKm, trip.engineOffKm, trip.unknownPropulsionKm);
};

export const appendTripSampleBatch = async (tripId: string, samples: unknown[]): Promise<void> => {
  if (!samples.length) return;
  const db = await getDatabase();
  await db.runAsync('INSERT INTO trip_samples (trip_id, sampled_at, samples_json) VALUES (?, ?, ?)', tripId, new Date().toISOString(), JSON.stringify(samples));
};

export const listTrips = async (): Promise<StoredTrip[]> => {
  const db = await getDatabase();
  return db.getAllAsync<StoredTrip>(`SELECT id, name, started_at AS startedAt, ended_at AS endedAt, duration_seconds AS durationSeconds, distance_km AS distanceKm, fuel_litres_estimated AS fuelLitresEstimated, average_litres_per_100km AS averageLitresPer100Km, sample_count AS sampleCount, engine_running_km AS engineRunningKm, engine_off_km AS engineOffKm, unknown_propulsion_km AS unknownPropulsionKm FROM trips ORDER BY started_at DESC`);
};

export const saveDiagnosticScan = async (raw: string, codes: string[]): Promise<void> => {
  const db = await getDatabase(); const id = `scan-${Date.now()}`;
  await db.withTransactionAsync(async () => { await db.runAsync('INSERT INTO diagnostic_scans (id, scanned_at, raw_response) VALUES (?, ?, ?)', id, new Date().toISOString(), raw); for (const code of codes) await db.runAsync('INSERT INTO diagnostic_codes (scan_id, ecu, code) VALUES (?, ?, ?)', id, 'POWERTRAIN', code); });
};

export const logVehicleAction = async (action: string, status: string, detail: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO vehicle_actions (id, action_id, attempted_at, status, detail) VALUES (?, ?, ?, ?, ?)', `action-${Date.now()}-${Math.random().toString(36).slice(2)}`, action, new Date().toISOString(), status, detail);
};
