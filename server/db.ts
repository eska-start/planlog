import fs from "fs";
import path from "path";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, User, users,
  trips, Trip, InsertTrip,
  flights, Flight, InsertFlight,
  rentals, Rental, InsertRental,
  accommodations, Accommodation, InsertAccommodation,
  memos, Memo, InsertMemo,
  itineraryItems, ItineraryItem, InsertItineraryItem,
  diaryEntries, DiaryEntry, InsertDiaryEntry,
  tripShares, TripShare, InsertTripShare,
  tripMembers, TripMember, InsertTripMember,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (e) { console.warn("[Database] Failed to connect:", e); _db = null; }
  }
  return _db;
}

// ─── Local JSON Persistent Store Fallback (when DATABASE_URL is not set) ─────
type LocalStore = {
  seq: number;
  users: User[];
  trips: Trip[];
  tripShares: TripShare[];
  tripMembers: TripMember[];
  flights: Flight[];
  rentals: Rental[];
  accommodations: Accommodation[];
  memos: Memo[];
  itineraryItems: ItineraryItem[];
  diaryEntries: DiaryEntry[];
};

const LOCAL_DB_PATH = path.resolve(process.env.VERCEL ? "/tmp" : process.cwd(), ".local-storage", "local-db.json");
let _localStore: LocalStore | null = null;

function loadLocalStore(): LocalStore {
  if (_localStore) return _localStore;
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf-8"));
      const reviveDates = <T extends Record<string, any>>(arr: T[] = [], dateKeys: string[]): T[] =>
        arr.map(item => {
          const copy: Record<string, any> = { ...item };
          for (const k of dateKeys) {
            if (copy[k]) copy[k] = new Date(copy[k]);
          }
          return copy as T;
        });
      _localStore = {
        seq: raw.seq ?? 100,
        users: reviveDates(raw.users, ["createdAt", "updatedAt", "lastSignedIn"]),
        trips: reviveDates(raw.trips, ["createdAt", "updatedAt"]),
        tripShares: reviveDates(raw.tripShares, ["expiresAt", "createdAt"]),
        tripMembers: reviveDates(raw.tripMembers, ["joinedAt"]),
        flights: reviveDates(raw.flights, ["createdAt", "updatedAt"]),
        rentals: reviveDates(raw.rentals, ["createdAt", "updatedAt"]),
        accommodations: reviveDates(raw.accommodations, ["createdAt", "updatedAt"]),
        memos: reviveDates(raw.memos, ["createdAt", "updatedAt"]),
        itineraryItems: reviveDates(raw.itineraryItems, ["createdAt", "updatedAt"]),
        diaryEntries: reviveDates(raw.diaryEntries, ["createdAt", "updatedAt"]),
      };
      return _localStore;
    }
  } catch (e) {
    console.warn("[LocalDB] Failed to load local store, initializing empty:", e);
  }
  _localStore = {
    seq: 1,
    users: [],
    trips: [],
    tripShares: [],
    tripMembers: [],
    flights: [],
    rentals: [],
    accommodations: [],
    memos: [],
    itineraryItems: [],
    diaryEntries: [],
  };
  return _localStore;
}

function saveLocalStore() {
  if (!_localStore) return;
  try {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(_localStore, null, 2), "utf-8");
  } catch (e) {
    console.warn("[LocalDB] Failed to persist local store:", e);
  }
}

function nextId(store: LocalStore): number {
  store.seq += 1;
  return store.seq;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    const existing = store.users.find(u => u.openId === user.openId);
    if (existing) {
      if (user.name !== undefined) existing.name = user.name ?? null;
      if (user.email !== undefined) existing.email = user.email ?? null;
      if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
      existing.lastSignedIn = user.lastSignedIn ?? now;
      existing.updatedAt = now;
      if (user.openId === ENV.ownerOpenId) existing.role = "admin";
    } else {
      store.users.push({
        id: nextId(store),
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user"),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      });
    }
    saveLocalStore();
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const f of textFields) {
    const v = user[f];
    if (v !== undefined) { values[f] = v ?? null; updateSet[f] = v ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    return loadLocalStore().users.find(u => u.openId === openId);
  }
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    return loadLocalStore().users.find(u => u.id === id);
  }
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
}

// ─── Trips ────────────────────────────────────────────────────────────────────
export async function getTripsByUser(userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const ownTrips = store.trips.filter(t => t.userId === userId);
    const sharedTripIds = store.tripMembers
      .filter(m => m.userId === userId)
      .map(m => m.tripId)
      .filter(id => !ownTrips.some(t => t.id === id));
    const sharedTrips = store.trips.filter(t => sharedTripIds.includes(t.id));
    return [...ownTrips, ...sharedTrips].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  const ownTrips = await db.select().from(trips).where(eq(trips.userId, userId));
  const memberRows = await db.select().from(tripMembers).where(eq(tripMembers.userId, userId));
  const sharedTripIds = memberRows.map(m => m.tripId).filter(id => !ownTrips.find(t => t.id === id));
  let sharedTrips: typeof ownTrips = [];
  if (sharedTripIds.length > 0) {
    sharedTrips = await db.select().from(trips).where(inArray(trips.id, sharedTripIds));
  }
  const all = [...ownTrips, ...sharedTrips];
  all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return all;
}

export async function getTripById(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const trip = store.trips.find(t => t.id === id);
    if (!trip) return undefined;
    if (trip.userId === userId) return trip;
    const mem = store.tripMembers.find(m => m.tripId === id && m.userId === userId);
    return mem ? trip : undefined;
  }
  const r = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!r[0]) return undefined;
  if (r[0].userId === userId) return r[0];
  const mem = await db.select().from(tripMembers)
    .where(and(eq(tripMembers.tripId, id), eq(tripMembers.userId, userId))).limit(1);
  if (mem[0]) return r[0];
  return undefined;
}

export async function createTrip(data: InsertTrip) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    store.trips.push({
      id: nextId(store),
      userId: data.userId,
      name: data.name,
      destination: data.destination,
      startDate: data.startDate,
      endDate: data.endDate,
      coverColor: data.coverColor ?? "#6366f1",
      description: data.description ?? null,
      createdAt: now,
      updatedAt: now,
    });
    saveLocalStore();
    return;
  }
  await db.insert(trips).values(data);
}

export async function updateTrip(id: number, userId: number, data: Partial<InsertTrip>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const trip = await getTripById(id, userId);
    if (!trip) throw new Error("Trip not found or no access");
    Object.assign(trip, data, { updatedAt: new Date() });
    saveLocalStore();
    return;
  }
  const trip = await getTripById(id, userId);
  if (!trip) throw new Error("Trip not found or no access");
  await db.update(trips).set(data).where(eq(trips.id, id));
}

export async function deleteTrip(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    store.trips = store.trips.filter(t => !(t.id === id && t.userId === userId));
    saveLocalStore();
    return;
  }
  await db.delete(trips).where(and(eq(trips.id, id), eq(trips.userId, userId)));
}

// ─── Trip Shares & Members ────────────────────────────────────────────────────
export async function createTripShare(data: InsertTripShare) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    store.tripShares.push({
      id: nextId(store),
      tripId: data.tripId,
      inviteToken: data.inviteToken,
      createdBy: data.createdBy,
      expiresAt: data.expiresAt ?? null,
      createdAt: new Date(),
    });
    saveLocalStore();
    return;
  }
  await db.insert(tripShares).values(data);
}

export async function getTripShareByToken(token: string) {
  const db = await getDb();
  if (!db) {
    return loadLocalStore().tripShares.find(s => s.inviteToken === token);
  }
  const r = await db.select().from(tripShares).where(eq(tripShares.inviteToken, token)).limit(1);
  return r[0];
}

export async function getTripSharesByTrip(tripId: number) {
  const db = await getDb();
  if (!db) {
    return loadLocalStore().tripShares.filter(s => s.tripId === tripId);
  }
  return db.select().from(tripShares).where(eq(tripShares.tripId, tripId));
}

export async function deleteTripShare(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    store.tripShares = store.tripShares.filter(s => !(s.id === id && s.createdBy === userId));
    saveLocalStore();
    return;
  }
  await db.delete(tripShares).where(and(eq(tripShares.id, id), eq(tripShares.createdBy, userId)));
}

export async function getTripMembers(tripId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const members = store.tripMembers.filter(m => m.tripId === tripId);
    return Promise.all(members.map(async m => {
      const u = await getUserById(m.userId);
      return { ...m, userName: u?.name ?? "알 수 없음", userEmail: u?.email ?? "" };
    }));
  }
  const members = await db.select().from(tripMembers).where(eq(tripMembers.tripId, tripId));
  const enriched = await Promise.all(members.map(async m => {
    const u = await getUserById(m.userId);
    return { ...m, userName: u?.name ?? "알 수 없음", userEmail: u?.email ?? "" };
  }));
  return enriched;
}

export async function addTripMember(data: InsertTripMember) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    if (store.tripMembers.some(m => m.tripId === data.tripId && m.userId === data.userId)) return;
    store.tripMembers.push({
      id: nextId(store),
      tripId: data.tripId,
      userId: data.userId,
      role: data.role ?? "editor",
      joinedAt: new Date(),
    });
    saveLocalStore();
    return;
  }
  const existing = await db.select().from(tripMembers)
    .where(and(eq(tripMembers.tripId, data.tripId), eq(tripMembers.userId, data.userId))).limit(1);
  if (existing[0]) return;
  await db.insert(tripMembers).values(data);
}

export async function removeTripMember(tripId: number, userId: number, requesterId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const trip = store.trips.find(t => t.id === tripId);
    if (!trip) throw new Error("Trip not found");
    if (trip.userId !== requesterId && userId !== requesterId) throw new Error("No permission");
    store.tripMembers = store.tripMembers.filter(m => !(m.tripId === tripId && m.userId === userId));
    saveLocalStore();
    return;
  }
  const trip = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip[0]) throw new Error("Trip not found");
  if (trip[0].userId !== requesterId && userId !== requesterId) throw new Error("No permission");
  await db.delete(tripMembers).where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
}

// ─── Flights ──────────────────────────────────────────────────────────────────
export async function getFlightsByTrip(tripId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().flights
      .filter(f => f.tripId === tripId)
      .sort((a, b) => (a.departureTime ?? "").localeCompare(b.departureTime ?? ""));
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(flights).where(eq(flights.tripId, tripId)).orderBy(asc(flights.departureTime));
}

export async function createFlight(data: InsertFlight) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    store.flights.push({
      id: nextId(store),
      tripId: data.tripId,
      userId: data.userId,
      type: data.type ?? "departure",
      airline: data.airline ?? null,
      flightNumber: data.flightNumber ?? null,
      departureAirport: data.departureAirport ?? null,
      arrivalAirport: data.arrivalAirport ?? null,
      departureTime: data.departureTime ?? null,
      arrivalTime: data.arrivalTime ?? null,
      bookingRef: data.bookingRef ?? null,
      seatNumber: data.seatNumber ?? null,
      memo: data.memo ?? null,
      createdAt: now,
      updatedAt: now,
    });
    saveLocalStore();
    return;
  }
  await db.insert(flights).values(data);
}

export async function updateFlight(id: number, userId: number, data: Partial<InsertFlight>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.flights.find(f => f.id === id);
    if (!row) throw new Error("Not found");
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    Object.assign(row, data, { updatedAt: new Date() });
    saveLocalStore();
    return;
  }
  const row = await db.select().from(flights).where(eq(flights.id, id)).limit(1);
  if (!row[0]) throw new Error("Not found");
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.update(flights).set(data).where(eq(flights.id, id));
}

export async function deleteFlight(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.flights.find(f => f.id === id);
    if (!row) return;
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    store.flights = store.flights.filter(f => f.id !== id);
    saveLocalStore();
    return;
  }
  const row = await db.select().from(flights).where(eq(flights.id, id)).limit(1);
  if (!row[0]) return;
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.delete(flights).where(eq(flights.id, id));
}

// ─── Rentals ──────────────────────────────────────────────────────────────────
export async function getRentalsByTrip(tripId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().rentals
      .filter(r => r.tripId === tripId)
      .sort((a, b) => (a.pickupTime ?? "").localeCompare(b.pickupTime ?? ""));
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(rentals).where(eq(rentals.tripId, tripId)).orderBy(asc(rentals.pickupTime));
}

export async function createRental(data: InsertRental) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    store.rentals.push({
      id: nextId(store),
      tripId: data.tripId,
      userId: data.userId,
      company: data.company ?? null,
      carModel: data.carModel ?? null,
      pickupLocation: data.pickupLocation ?? null,
      dropoffLocation: data.dropoffLocation ?? null,
      pickupTime: data.pickupTime ?? null,
      dropoffTime: data.dropoffTime ?? null,
      bookingRef: data.bookingRef ?? null,
      price: data.price ?? null,
      currency: data.currency ?? "KRW",
      memo: data.memo ?? null,
      createdAt: now,
      updatedAt: now,
    });
    saveLocalStore();
    return;
  }
  await db.insert(rentals).values(data);
}

export async function updateRental(id: number, userId: number, data: Partial<InsertRental>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.rentals.find(r => r.id === id);
    if (!row) throw new Error("Not found");
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    Object.assign(row, data, { updatedAt: new Date() });
    saveLocalStore();
    return;
  }
  const row = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
  if (!row[0]) throw new Error("Not found");
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.update(rentals).set(data).where(eq(rentals.id, id));
}

export async function deleteRental(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.rentals.find(r => r.id === id);
    if (!row) return;
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    store.rentals = store.rentals.filter(r => r.id !== id);
    saveLocalStore();
    return;
  }
  const row = await db.select().from(rentals).where(eq(rentals.id, id)).limit(1);
  if (!row[0]) return;
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.delete(rentals).where(eq(rentals.id, id));
}

// ─── Accommodations ───────────────────────────────────────────────────────────
export async function getAccommodationsByTrip(tripId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().accommodations
      .filter(a => a.tripId === tripId)
      .sort((a, b) => (a.checkIn ?? "").localeCompare(b.checkIn ?? ""));
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(accommodations).where(eq(accommodations.tripId, tripId)).orderBy(asc(accommodations.checkIn));
}

export async function createAccommodation(data: InsertAccommodation) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    const id = nextId(store);
    store.accommodations.push({
      id,
      tripId: data.tripId,
      userId: data.userId,
      name: data.name,
      address: data.address ?? null,
      checkIn: data.checkIn ?? null,
      checkOut: data.checkOut ?? null,
      bookingRef: data.bookingRef ?? null,
      price: data.price ?? null,
      currency: data.currency ?? "KRW",
      memo: data.memo ?? null,
      createdAt: now,
      updatedAt: now,
    });
    saveLocalStore();
    return id;
  }
  const r = await db.insert(accommodations).values(data);
  const insertId = (r[0] as any).insertId as number;
  return insertId;
}

export async function updateAccommodation(id: number, userId: number, data: Partial<InsertAccommodation>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.accommodations.find(a => a.id === id);
    if (!row) throw new Error("Not found");
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    Object.assign(row, data, { updatedAt: new Date() });
    saveLocalStore();
    return;
  }
  const row = await db.select().from(accommodations).where(eq(accommodations.id, id)).limit(1);
  if (!row[0]) throw new Error("Not found");
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.update(accommodations).set(data).where(eq(accommodations.id, id));
}

export async function deleteAccommodation(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.accommodations.find(a => a.id === id);
    if (!row) return;
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    store.accommodations = store.accommodations.filter(a => a.id !== id);
    saveLocalStore();
    return;
  }
  const row = await db.select().from(accommodations).where(eq(accommodations.id, id)).limit(1);
  if (!row[0]) return;
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.delete(accommodations).where(eq(accommodations.id, id));
}

// ─── Memos ────────────────────────────────────────────────────────────────────
export async function getMemosByTrip(tripId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().memos
      .filter(m => m.tripId === tripId)
      .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(memos).where(eq(memos.tripId, tripId)).orderBy(desc(memos.pinned), desc(memos.updatedAt));
}

export async function createMemo(data: InsertMemo) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    store.memos.push({
      id: nextId(store),
      tripId: data.tripId,
      userId: data.userId,
      title: data.title ?? null,
      content: data.content ?? null,
      pinned: data.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    });
    saveLocalStore();
    return;
  }
  await db.insert(memos).values(data);
}

export async function updateMemo(id: number, userId: number, data: Partial<InsertMemo>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.memos.find(m => m.id === id);
    if (!row) throw new Error("Not found");
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    Object.assign(row, data, { updatedAt: new Date() });
    saveLocalStore();
    return;
  }
  const row = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
  if (!row[0]) throw new Error("Not found");
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.update(memos).set(data).where(eq(memos.id, id));
}

export async function deleteMemo(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.memos.find(m => m.id === id);
    if (!row) return;
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    store.memos = store.memos.filter(m => m.id !== id);
    saveLocalStore();
    return;
  }
  const row = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
  if (!row[0]) return;
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.delete(memos).where(eq(memos.id, id));
}

// ─── Itinerary Items ──────────────────────────────────────────────────────────
export async function getItineraryByDate(tripId: number, userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().itineraryItems
      .filter(i => i.tripId === tripId && i.date === date)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.visitTime ?? "").localeCompare(b.visitTime ?? ""));
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(itineraryItems)
    .where(and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.date, date)))
    .orderBy(asc(itineraryItems.order), asc(itineraryItems.visitTime));
}

export async function getItineraryByTrip(tripId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().itineraryItems
      .filter(i => i.tripId === tripId)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.order ?? 0) - (b.order ?? 0));
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(itineraryItems)
    .where(eq(itineraryItems.tripId, tripId))
    .orderBy(asc(itineraryItems.date), asc(itineraryItems.order));
}

export async function createItineraryItem(data: InsertItineraryItem) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    store.itineraryItems.push({
      id: nextId(store),
      tripId: data.tripId,
      userId: data.userId,
      date: data.date,
      order: data.order ?? 0,
      placeName: data.placeName,
      address: data.address ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      visitTime: data.visitTime ?? null,
      duration: data.duration ?? null,
      visited: data.visited ?? false,
      memo: data.memo ?? null,
      category: data.category ?? "place",
      sourceType: data.sourceType ?? "manual",
      sourceId: data.sourceId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    saveLocalStore();
    return;
  }
  await db.insert(itineraryItems).values(data);
}

export async function updateItineraryItem(id: number, userId: number, data: Partial<InsertItineraryItem>) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.itineraryItems.find(i => i.id === id);
    if (!row) throw new Error("Not found");
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    Object.assign(row, data, { updatedAt: new Date() });
    saveLocalStore();
    return;
  }
  const row = await db.select().from(itineraryItems).where(eq(itineraryItems.id, id)).limit(1);
  if (!row[0]) throw new Error("Not found");
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.update(itineraryItems).set(data).where(eq(itineraryItems.id, id));
}

export async function deleteItineraryItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const row = store.itineraryItems.find(i => i.id === id);
    if (!row) return;
    const trip = await getTripById(row.tripId, userId);
    if (!trip) throw new Error("No access");
    store.itineraryItems = store.itineraryItems.filter(i => i.id !== id);
    saveLocalStore();
    return;
  }
  const row = await db.select().from(itineraryItems).where(eq(itineraryItems.id, id)).limit(1);
  if (!row[0]) return;
  const trip = await getTripById(row[0].tripId, userId);
  if (!trip) throw new Error("No access");
  await db.delete(itineraryItems).where(eq(itineraryItems.id, id));
}

export async function reorderItineraryItems(tripId: number, userId: number, orderedIds: number[]) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const trip = await getTripById(tripId, userId);
    if (!trip) throw new Error("No access");
    orderedIds.forEach((id, index) => {
      const item = store.itineraryItems.find(i => i.id === id && i.tripId === tripId);
      if (item) item.order = index;
    });
    saveLocalStore();
    return;
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) throw new Error("No access");
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(itineraryItems)
        .set({ order: index })
        .where(and(eq(itineraryItems.id, id), eq(itineraryItems.tripId, tripId)))
    )
  );
}

export async function deleteItineraryItemsBySource(tripId: number, sourceId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    store.itineraryItems = store.itineraryItems.filter(i => !(i.tripId === tripId && i.sourceId === sourceId));
    saveLocalStore();
    return;
  }
  await db.delete(itineraryItems)
    .where(and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.sourceId, sourceId)));
}

// ─── Diary Entries ────────────────────────────────────────────────────────────
export async function getDiaryEntriesByTrip(tripId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return [];
    return loadLocalStore().diaryEntries
      .filter(d => d.tripId === tripId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return [];
  return db.select().from(diaryEntries)
    .where(eq(diaryEntries.tripId, tripId))
    .orderBy(asc(diaryEntries.date));
}

export async function getDiaryEntryByDate(tripId: number, userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    const trip = await getTripById(tripId, userId);
    if (!trip) return undefined;
    return loadLocalStore().diaryEntries.find(d => d.tripId === tripId && d.date === date);
  }
  const trip = await getTripById(tripId, userId);
  if (!trip) return undefined;
  const r = await db.select().from(diaryEntries)
    .where(and(eq(diaryEntries.tripId, tripId), eq(diaryEntries.date, date)))
    .limit(1);
  return r[0];
}

export async function upsertDiaryEntry(data: InsertDiaryEntry) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    const now = new Date();
    const existing = store.diaryEntries.find(d => d.tripId === data.tripId && d.date === data.date);
    if (existing) {
      if (data.title !== undefined) existing.title = data.title ?? null;
      if (data.content !== undefined) existing.content = data.content ?? null;
      if (data.mood !== undefined) existing.mood = data.mood ?? "happy";
      if (data.weather !== undefined) existing.weather = data.weather ?? "sunny";
      existing.updatedAt = now;
    } else {
      store.diaryEntries.push({
        id: nextId(store),
        tripId: data.tripId,
        userId: data.userId,
        date: data.date,
        title: data.title ?? null,
        content: data.content ?? null,
        mood: data.mood ?? "happy",
        weather: data.weather ?? "sunny",
        createdAt: now,
        updatedAt: now,
      });
    }
    saveLocalStore();
    return;
  }
  await db.insert(diaryEntries).values(data).onDuplicateKeyUpdate({
    set: { title: data.title, content: data.content, mood: data.mood, weather: data.weather },
  });
}

export async function deleteDiaryEntry(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const store = loadLocalStore();
    store.diaryEntries = store.diaryEntries.filter(d => !(d.id === id && d.userId === userId));
    saveLocalStore();
    return;
  }
  await db.delete(diaryEntries).where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId)));
}
