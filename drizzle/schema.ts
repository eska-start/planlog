import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── 여행 프로젝트 ─────────────────────────────────────────────────────────────
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }).notNull(),
  coverColor: varchar("coverColor", { length: 32 }).default("#6366f1"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

// ─── 여행 공유 ────────────────────────────────────────────────────────────────
export const tripShares = mysqlTable("trip_shares", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull().unique(),
  createdBy: int("createdBy").notNull(), // owner userId
  expiresAt: timestamp("expiresAt"),     // null = 만료 없음
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TripShare = typeof tripShares.$inferSelect;
export type InsertTripShare = typeof tripShares.$inferInsert;

// ─── 공유 멤버 ────────────────────────────────────────────────────────────────
export const tripMembers = mysqlTable("trip_members", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "editor"]).default("editor").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type TripMember = typeof tripMembers.$inferSelect;
export type InsertTripMember = typeof tripMembers.$inferInsert;

// ─── 항공편 ───────────────────────────────────────────────────────────────────
export const flights = mysqlTable("flights", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["departure", "return", "transit"]).default("departure").notNull(),
  airline: varchar("airline", { length: 100 }),
  flightNumber: varchar("flightNumber", { length: 20 }),
  departureAirport: varchar("departureAirport", { length: 100 }),
  arrivalAirport: varchar("arrivalAirport", { length: 100 }),
  departureTime: varchar("departureTime", { length: 20 }),
  arrivalTime: varchar("arrivalTime", { length: 20 }),
  bookingRef: varchar("bookingRef", { length: 50 }),
  seatNumber: varchar("seatNumber", { length: 20 }),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Flight = typeof flights.$inferSelect;
export type InsertFlight = typeof flights.$inferInsert;

// ─── 렌트카 ───────────────────────────────────────────────────────────────────
export const rentals = mysqlTable("rentals", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  company: varchar("company", { length: 100 }),
  carModel: varchar("carModel", { length: 100 }),
  pickupLocation: varchar("pickupLocation", { length: 255 }),
  dropoffLocation: varchar("dropoffLocation", { length: 255 }),
  pickupTime: varchar("pickupTime", { length: 20 }),
  dropoffTime: varchar("dropoffTime", { length: 20 }),
  bookingRef: varchar("bookingRef", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("KRW"),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rental = typeof rentals.$inferSelect;
export type InsertRental = typeof rentals.$inferInsert;

// ─── 숙박 ─────────────────────────────────────────────────────────────────────
export const accommodations = mysqlTable("accommodations", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  checkIn: varchar("checkIn", { length: 10 }),
  checkOut: varchar("checkOut", { length: 10 }),
  bookingRef: varchar("bookingRef", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("KRW"),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Accommodation = typeof accommodations.$inferSelect;
export type InsertAccommodation = typeof accommodations.$inferInsert;

// ─── 자유 메모 ────────────────────────────────────────────────────────────────
export const memos = mysqlTable("memos", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  pinned: boolean("pinned").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Memo = typeof memos.$inferSelect;
export type InsertMemo = typeof memos.$inferInsert;

// ─── 하루별 방문 장소 (동선) ──────────────────────────────────────────────────
export const itineraryItems = mysqlTable("itinerary_items", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  order: int("order").default(0),
  placeName: varchar("placeName", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  visitTime: varchar("visitTime", { length: 10 }),
  duration: int("duration"),
  visited: boolean("visited").default(false),
  memo: text("memo"),
  category: varchar("category", { length: 50 }).default("place"),
  // 숙박 자동 연동: accommodation 타입이면 accommodationId 참조
  sourceType: varchar("sourceType", { length: 20 }).default("manual"), // "manual" | "accommodation"
  sourceId: int("sourceId"),   // accommodationId (sourceType=accommodation 시)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type InsertItineraryItem = typeof itineraryItems.$inferInsert;

// ─── 하루별 여행 일기 ─────────────────────────────────────────────────────────
export const diaryEntries = mysqlTable("diary_entries", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  mood: mysqlEnum("mood", ["amazing", "happy", "neutral", "tired", "sad"]).default("happy"),
  weather: mysqlEnum("weather", ["sunny", "cloudy", "rainy", "snowy", "windy"]).default("sunny"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type InsertDiaryEntry = typeof diaryEntries.$inferInsert;
