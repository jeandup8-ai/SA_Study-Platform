import pg from 'pg'
import type { Itinerary, PlaceRecord } from '../../shared/types.js'
import { MIGRATIONS } from './migrations.js'
import type {
  OrderRow,
  OrderStatus,
  PlaceRow,
  Store,
  TripPatch,
  TripRow,
} from './types.js'

type Row = Record<string, unknown>
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v))

function toTrip(r: Row): TripRow {
  return {
    id: String(r.id),
    ownerHash: String(r.owner_hash),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    accommodation: (r.accommodation as TripRow['accommodation']) ?? null,
    preferences: (r.preferences as TripRow['preferences']) ?? null,
    itinerary: (r.itinerary as TripRow['itinerary']) ?? null,
    discovery: (r.discovery as TripRow['discovery']) ?? null,
    shareTokenHash: (r.share_token_hash as string | null) ?? null,
  }
}

function toOrder(r: Row): OrderRow {
  return {
    id: String(r.id),
    tripId: r.trip_id === null ? null : String(r.trip_id),
    provider: String(r.provider),
    providerOrderId: String(r.provider_order_id),
    amount: String(r.amount),
    currency: String(r.currency),
    status: r.status as OrderStatus,
    captureId: (r.capture_id as string | null) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }
}

const TRIP_COLUMNS = {
  accommodation: 'accommodation',
  preferences: 'preferences',
  itinerary: 'itinerary',
  discovery: 'discovery',
  shareTokenHash: 'share_token_hash',
} as const

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const
  readonly pool: pg.Pool

  constructor(connectionString: string, ssl: boolean) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: ssl ? { rejectUnauthorized: true } : undefined,
      max: 10,
      statement_timeout: 10_000,
      connectionTimeoutMillis: 5_000,
    })
  }

  async migrate(): Promise<string[]> {
    const client = await this.pool.connect()
    const applied: string[] = []
    try {
      await client.query('select pg_advisory_lock(472911)')
      await client.query(
        'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
      )
      const done = new Set(
        (await client.query('select name from schema_migrations')).rows.map(
          (r) => r.name as string,
        ),
      )
      for (const m of MIGRATIONS) {
        if (done.has(m.name)) continue
        await client.query('begin')
        try {
          await client.query(m.sql)
          await client.query('insert into schema_migrations (name) values ($1)', [m.name])
          await client.query('commit')
          applied.push(m.name)
        } catch (err) {
          await client.query('rollback')
          throw err
        }
      }
    } finally {
      await client.query('select pg_advisory_unlock(472911)').catch(() => {})
      client.release()
    }
    return applied
  }

  async createTrip(t: TripRow) {
    await this.pool.query(
      `insert into trips (id, owner_hash, created_at, updated_at, accommodation, preferences, itinerary, discovery, share_token_hash)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        t.id,
        t.ownerHash,
        t.createdAt,
        t.updatedAt,
        json(t.accommodation),
        json(t.preferences),
        json(t.itinerary),
        json(t.discovery),
        t.shareTokenHash,
      ],
    )
  }

  async getTrip(id: string) {
    const { rows } = await this.pool.query('select * from trips where id = $1', [id])
    return rows[0] ? toTrip(rows[0]) : null
  }

  async listTripsByOwner(ownerHash: string) {
    const { rows } = await this.pool.query(
      'select * from trips where owner_hash = $1 order by updated_at desc limit 50',
      [ownerHash],
    )
    return rows.map(toTrip)
  }

  async updateTrip(id: string, patch: TripPatch, now: string) {
    const sets: string[] = []
    const values: unknown[] = [id, now]
    for (const [key, column] of Object.entries(TRIP_COLUMNS)) {
      if (!(key in patch)) continue
      const v = patch[key as keyof TripPatch]
      values.push(key === 'shareTokenHash' ? v : json(v))
      sets.push(`${column} = $${values.length}`)
    }
    const { rows } = await this.pool.query(
      `update trips set updated_at = $2${sets.length ? ', ' + sets.join(', ') : ''} where id = $1 returning *`,
      values,
    )
    return rows[0] ? toTrip(rows[0]) : null
  }

  async deleteTrip(id: string) {
    await this.pool.query('delete from trips where id = $1', [id])
  }

  async findTripByShareHash(hash: string) {
    const { rows } = await this.pool.query(
      'select * from trips where share_token_hash = $1',
      [hash],
    )
    return rows[0] ? toTrip(rows[0]) : null
  }

  async getPlaces(tripId: string): Promise<PlaceRow[]> {
    const { rows } = await this.pool.query(
      'select record, selected, favourite from trip_places where trip_id = $1',
      [tripId],
    )
    return rows.map((r) => ({
      record: r.record as PlaceRecord,
      selected: r.selected as boolean,
      favourite: r.favourite as boolean,
    }))
  }

  async replacePlaces(tripId: string, records: PlaceRecord[]) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const ids = records.map((r) => r.id)
      await client.query(
        'delete from trip_places where trip_id = $1 and not (place_id = any($2::text[]))',
        [tripId, ids],
      )
      if (records.length > 0) {
        // One statement for the whole batch.
        await client.query(
          `insert into trip_places (trip_id, place_id, provider, provider_place_id, record, expires_at)
           select $1, * from unnest($2::text[], $3::text[], $4::text[], $5::jsonb[], $6::timestamptz[])
           on conflict (trip_id, place_id) do update set record = excluded.record, expires_at = excluded.expires_at`,
          [
            tripId,
            records.map((r) => r.id),
            records.map((r) => r.provider),
            records.map((r) => r.providerPlaceId),
            records.map((r) => JSON.stringify(r)),
            records.map((r) => r.expiresAt),
          ],
        )
      }
      await client.query('commit')
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async deletePlaces(tripId: string, placeIds: string[]) {
    if (placeIds.length === 0) return
    await this.pool.query(
      'delete from trip_places where trip_id = $1 and place_id = any($2::text[])',
      [tripId, placeIds],
    )
  }

  async setSelection(
    tripId: string,
    placeId: string,
    sel: { selected?: boolean; favourite?: boolean },
  ) {
    const { rowCount } = await this.pool.query(
      `update trip_places set selected = coalesce($3, selected), favourite = coalesce($4, favourite)
       where trip_id = $1 and place_id = $2`,
      [tripId, placeId, sel.selected ?? null, sel.favourite ?? null],
    )
    return (rowCount ?? 0) > 0
  }

  async createOrder(o: OrderRow) {
    await this.pool.query(
      `insert into orders (id, trip_id, provider, provider_order_id, amount, currency, status, capture_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        o.id,
        o.tripId,
        o.provider,
        o.providerOrderId,
        o.amount,
        o.currency,
        o.status,
        o.captureId,
        o.createdAt,
        o.updatedAt,
      ],
    )
  }

  async getOrderByProviderId(provider: string, providerOrderId: string) {
    const { rows } = await this.pool.query(
      'select * from orders where provider = $1 and provider_order_id = $2',
      [provider, providerOrderId],
    )
    return rows[0] ? toOrder(rows[0]) : null
  }

  async updateOrder(
    id: string,
    status: OrderStatus,
    captureId: string | null,
    now: string,
  ) {
    // Mirrors canMoveOrder in SQL, so duplicate or late callbacks can't undo a payment.
    await this.pool.query(
      `update orders set status = $2, capture_id = coalesce($3, capture_id), updated_at = $4
       where id = $1 and status <> 'refunded' and (status <> 'paid' or $2 = 'refunded')`,
      [id, status, captureId, now],
    )
    const { rows } = await this.pool.query('select * from orders where id = $1', [id])
    return rows[0] ? toOrder(rows[0]) : null
  }

  async hasPaidOrder(tripId: string) {
    const { rows } = await this.pool.query(
      `select 1 from orders where trip_id = $1 and status = 'paid' limit 1`,
      [tripId],
    )
    return rows.length > 0
  }

  async listOrdersForTrip(tripId: string) {
    const { rows } = await this.pool.query(
      'select * from orders where trip_id = $1 order by created_at',
      [tripId],
    )
    return rows.map(toOrder)
  }

  async saveItinerary(
    id: string,
    itinerary: Itinerary,
    expectedVersion: number,
    now: string,
  ) {
    // Compare-and-set on the stored version, so concurrent edits can't both win.
    const { rows } = await this.pool.query(
      `update trips set itinerary = $2, updated_at = $3
       where id = $1 and coalesce((itinerary->>'version')::int, 0) = $4
       returning *`,
      [id, JSON.stringify(itinerary), now, expectedVersion],
    )
    return rows[0] ? toTrip(rows[0]) : null
  }

  async close() {
    await this.pool.end()
  }
}

const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v))
