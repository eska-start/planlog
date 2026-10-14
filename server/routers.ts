import { z } from "zod";
import { nanoid } from "nanoid";
import { eachDayOfInterval, parseISO, format } from "date-fns";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM, type Message } from "./_core/llm";
import { ENV } from "./_core/env";
import {
  extractTextWithFreeOcr,
  parseAccommodationFromText,
  parseFlightFromText,
  parseRentalFromText,
} from "./_core/freeOcr";
import {
  getTripsByUser, getTripById, createTrip, updateTrip, deleteTrip,
  getFlightsByTrip, createFlight, updateFlight, deleteFlight,
  getRentalsByTrip, createRental, updateRental, deleteRental,
  getAccommodationsByTrip, createAccommodation, updateAccommodation, deleteAccommodation,
  getMemosByTrip, createMemo, updateMemo, deleteMemo,
  getItineraryByDate, getItineraryByTrip, createItineraryItem, updateItineraryItem, deleteItineraryItem,
  reorderItineraryItems, deleteItineraryItemsBySource,
  getDiaryEntriesByTrip, getDiaryEntryByDate, upsertDiaryEntry, deleteDiaryEntry,
  createTripShare, getTripShareByToken, getTripSharesByTrip, deleteTripShare,
  getTripMembers, addTripMember, removeTripMember,
} from "./db";

// ─── Helper: 숙박 → 일정 자동 생성 ──────────────────────────────────────────
async function syncAccommodationToItinerary(
  tripId: number,
  userId: number,
  accommodationId: number,
  name: string,
  address: string | undefined | null,
  checkIn: string | undefined | null,
  checkOut: string | undefined | null,
) {
  if (!checkIn || !checkOut) return;
  try {
    await deleteItineraryItemsBySource(tripId, accommodationId);
    const days = eachDayOfInterval({ start: parseISO(checkIn), end: parseISO(checkOut) });
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const dateStr = format(d, "yyyy-MM-dd");
      let label = "";
      if (i === 0) label = `🏨 체크인 — ${name}`;
      else if (i === days.length - 1) label = `🏨 체크아웃 — ${name}`;
      else label = `🏨 숙박 — ${name}`;
      await createItineraryItem({
        tripId,
        userId,
        date: dateStr,
        placeName: label,
        address: address ?? undefined,
        category: "accommodation",
        sourceType: "accommodation",
        sourceId: accommodationId,
        order: 0,
        visited: false,
      });
    }
  } catch (e) {
    console.error("[syncAccommodation] error:", e);
  }
}

// ─── Trips Router ─────────────────────────────────────────────────────────────
const tripsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getTripsByUser(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getTripById(input.id, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      destination: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
      coverColor: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createTrip({ ...input, userId: ctx.user.id })),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      destination: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      coverColor: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateTrip(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteTrip(input.id, ctx.user.id)),
});

// ─── Flights Router ───────────────────────────────────────────────────────────
const flightsRouter = router({
  list: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(({ ctx, input }) => getFlightsByTrip(input.tripId, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      type: z.enum(["departure", "return", "transit"]).optional(),
      airline: z.string().optional(),
      flightNumber: z.string().optional(),
      departureAirport: z.string().optional(),
      arrivalAirport: z.string().optional(),
      departureTime: z.string().optional(),
      arrivalTime: z.string().optional(),
      bookingRef: z.string().optional(),
      seatNumber: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createFlight({ ...input, userId: ctx.user.id })),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      type: z.enum(["departure", "return", "transit"]).optional(),
      airline: z.string().optional(),
      flightNumber: z.string().optional(),
      departureAirport: z.string().optional(),
      arrivalAirport: z.string().optional(),
      departureTime: z.string().optional(),
      arrivalTime: z.string().optional(),
      bookingRef: z.string().optional(),
      seatNumber: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateFlight(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteFlight(input.id, ctx.user.id)),

  // ── OCR / 텍스트: 사진 또는 추출 텍스트로 항공편 정보 추출 ──
  extractFromImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().optional(),
      rawText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // 1. 클라이언트 온디바이스 OCR 또는 직접 입력된 예약 텍스트가 있으면 외부 API 없이 즉시 파싱
      if (input.rawText && input.rawText.trim().length > 0 && !ENV.forgeApiKey) {
        return parseFlightFromText(input.rawText);
      }

      if (!ENV.forgeApiKey) {
        const text = input.rawText?.trim()
          ? input.rawText
          : input.imageUrl
            ? await extractTextWithFreeOcr(input.imageUrl)
            : "";
        return parseFlightFromText(text);
      }

      try {
        const res = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: `You are a travel document parser. Extract flight information from the image or text and return JSON only.
Return this exact JSON schema (use null for missing fields):
{
  "airline": string | null,
  "flightNumber": string | null,
  "departureAirport": string | null,
  "arrivalAirport": string | null,
  "departureTime": string | null,
  "arrivalTime": string | null,
  "bookingRef": string | null,
  "seatNumber": string | null,
  "type": "departure" | "return" | "transit" | null
}
For times, use ISO 8601 format (YYYY-MM-DDTHH:mm) if date is visible, otherwise HH:mm only.`,
            } as Message,
            {
              role: "user" as const,
              content: input.imageUrl
                ? [
                    { type: "text" as const, text: "항공권 또는 e-ticket 이미지에서 정보를 추출해주세요." },
                    { type: "image_url" as const, image_url: { url: input.imageUrl, detail: "high" as const } },
                  ]
                : [{ type: "text" as const, text: input.rawText ?? "" }],
            } as Message,
          ],
          response_format: { type: "json_object" },
        });
        const raw = res.choices?.[0]?.message?.content;
        const content = typeof raw === "string" ? raw : "{}";
        return JSON.parse(content);
      } catch {
        const fallbackText = input.rawText?.trim()
          ? input.rawText
          : input.imageUrl
            ? await extractTextWithFreeOcr(input.imageUrl).catch(() => "")
            : "";
        return parseFlightFromText(fallbackText);
      }
    }),
});

// ─── Rentals Router ───────────────────────────────────────────────────────────
const rentalsRouter = router({
  list: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(({ ctx, input }) => getRentalsByTrip(input.tripId, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      company: z.string().optional(),
      carModel: z.string().optional(),
      pickupLocation: z.string().optional(),
      dropoffLocation: z.string().optional(),
      pickupTime: z.string().optional(),
      dropoffTime: z.string().optional(),
      bookingRef: z.string().optional(),
      price: z.string().optional(),
      currency: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createRental({ ...input, userId: ctx.user.id })),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      company: z.string().optional(),
      carModel: z.string().optional(),
      pickupLocation: z.string().optional(),
      dropoffLocation: z.string().optional(),
      pickupTime: z.string().optional(),
      dropoffTime: z.string().optional(),
      bookingRef: z.string().optional(),
      price: z.string().optional(),
      currency: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateRental(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteRental(input.id, ctx.user.id)),

  // ── OCR / 텍스트: 사진 또는 추출 텍스트로 렌트카 정보 추출 ──
  extractFromImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().optional(),
      rawText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.rawText && input.rawText.trim().length > 0 && !ENV.forgeApiKey) {
        return parseRentalFromText(input.rawText);
      }

      if (!ENV.forgeApiKey) {
        const text = input.rawText?.trim()
          ? input.rawText
          : input.imageUrl
            ? await extractTextWithFreeOcr(input.imageUrl)
            : "";
        return parseRentalFromText(text);
      }

      try {
        const res = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: `You are a travel document parser. Extract car rental information from the image and return JSON only.
Return this exact JSON schema (use null for missing fields):
{
  "company": string | null,
  "carModel": string | null,
  "pickupLocation": string | null,
  "dropoffLocation": string | null,
  "pickupTime": string | null,
  "dropoffTime": string | null,
  "bookingRef": string | null,
  "price": string | null,
  "currency": string | null
}
For times, use ISO 8601 format (YYYY-MM-DDTHH:mm) if date is visible.`,
            } as Message,
            {
              role: "user" as const,
              content: input.imageUrl
                ? [
                    { type: "text" as const, text: "렌트카 예약 확인서 이미지에서 정보를 추출해주세요." },
                    { type: "image_url" as const, image_url: { url: input.imageUrl, detail: "high" as const } },
                  ]
                : [{ type: "text" as const, text: input.rawText ?? "" }],
            } as Message,
          ],
          response_format: { type: "json_object" },
        });
        const raw = res.choices?.[0]?.message?.content;
        const content = typeof raw === "string" ? raw : "{}";
        return JSON.parse(content);
      } catch {
        const fallbackText = input.rawText?.trim()
          ? input.rawText
          : input.imageUrl
            ? await extractTextWithFreeOcr(input.imageUrl).catch(() => "")
            : "";
        return parseRentalFromText(fallbackText);
      }
    }),
});

// ─── Accommodations Router ────────────────────────────────────────────────────
const accommodationsRouter = router({
  list: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(({ ctx, input }) => getAccommodationsByTrip(input.tripId, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      name: z.string().min(1),
      address: z.string().optional(),
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      bookingRef: z.string().optional(),
      price: z.string().optional(),
      currency: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createAccommodation({ ...input, userId: ctx.user.id });
      if (id && input.checkIn && input.checkOut) {
        await syncAccommodationToItinerary(
          input.tripId, ctx.user.id, id,
          input.name, input.address, input.checkIn, input.checkOut,
        );
      }
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      tripId: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      bookingRef: z.string().optional(),
      price: z.string().optional(),
      currency: z.string().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, tripId, ...data } = input;
      await updateAccommodation(id, ctx.user.id, data);
      const accList = await getAccommodationsByTrip(tripId, ctx.user.id);
      const acc = accList.find(a => a.id === id);
      if (acc) {
        const name = data.name ?? acc.name;
        const address = data.address ?? acc.address;
        const checkIn = data.checkIn ?? acc.checkIn;
        const checkOut = data.checkOut ?? acc.checkOut;
        await syncAccommodationToItinerary(tripId, ctx.user.id, id, name, address, checkIn, checkOut);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), tripId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAccommodation(input.id, ctx.user.id);
      await deleteItineraryItemsBySource(input.tripId, input.id);
    }),

  // ── OCR / 텍스트: 사진 또는 추출 텍스트로 숙박 정보 추출 ──
  extractFromImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().optional(),
      rawText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.rawText && input.rawText.trim().length > 0 && !ENV.forgeApiKey) {
        return parseAccommodationFromText(input.rawText);
      }

      if (!ENV.forgeApiKey) {
        const text = input.rawText?.trim()
          ? input.rawText
          : input.imageUrl
            ? await extractTextWithFreeOcr(input.imageUrl)
            : "";
        return parseAccommodationFromText(text);
      }

      try {
        const res = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: `You are a travel document parser. Extract hotel/accommodation booking information from the image and return JSON only.
Return this exact JSON schema (use null for missing fields):
{
  "name": string | null,
  "address": string | null,
  "checkIn": string | null,
  "checkOut": string | null,
  "bookingRef": string | null,
  "price": string | null,
  "currency": string | null
}
For dates, use YYYY-MM-DD format.`,
            } as Message,
            {
              role: "user" as const,
              content: input.imageUrl
                ? [
                    { type: "text" as const, text: "호텔 또는 숙박 예약 확인서 이미지에서 정보를 추출해주세요." },
                    { type: "image_url" as const, image_url: { url: input.imageUrl, detail: "high" as const } },
                  ]
                : [{ type: "text" as const, text: input.rawText ?? "" }],
            } as Message,
          ],
          response_format: { type: "json_object" },
        });
        const raw = res.choices?.[0]?.message?.content;
        const content = typeof raw === "string" ? raw : "{}";
        return JSON.parse(content);
      } catch {
        const fallbackText = input.rawText?.trim()
          ? input.rawText
          : input.imageUrl
            ? await extractTextWithFreeOcr(input.imageUrl).catch(() => "")
            : "";
        return parseAccommodationFromText(fallbackText);
      }
    }),
});

// ─── Memos Router ─────────────────────────────────────────────────────────────
const memosRouter = router({
  list: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(({ ctx, input }) => getMemosByTrip(input.tripId, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      pinned: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => createMemo({ ...input, userId: ctx.user.id })),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      pinned: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateMemo(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteMemo(input.id, ctx.user.id)),
});

// ─── Itinerary Router ─────────────────────────────────────────────────────────
const itineraryRouter = router({
  listByDate: protectedProcedure
    .input(z.object({ tripId: z.number(), date: z.string() }))
    .query(({ ctx, input }) => getItineraryByDate(input.tripId, ctx.user.id, input.date)),

  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(({ ctx, input }) => getItineraryByTrip(input.tripId, ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      date: z.string(),
      order: z.number().optional(),
      placeName: z.string().min(1),
      address: z.string().optional(),
      lat: z.string().optional(),
      lng: z.string().optional(),
      visitTime: z.string().optional(),
      duration: z.number().optional(),
      visited: z.boolean().optional(),
      memo: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createItineraryItem({ ...input, userId: ctx.user.id })),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      order: z.number().optional(),
      placeName: z.string().optional(),
      address: z.string().optional(),
      lat: z.string().optional(),
      lng: z.string().optional(),
      visitTime: z.string().optional(),
      duration: z.number().optional(),
      visited: z.boolean().optional(),
      memo: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateItineraryItem(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteItineraryItem(input.id, ctx.user.id)),

  reorder: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      orderedIds: z.array(z.number()),
    }))
    .mutation(({ ctx, input }) =>
      reorderItineraryItems(input.tripId, ctx.user.id, input.orderedIds)
    ),
});

// ─── Diary Router ─────────────────────────────────────────────────────────────
const diaryRouter = router({
  listByTrip: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(({ ctx, input }) => getDiaryEntriesByTrip(input.tripId, ctx.user.id)),

  getByDate: protectedProcedure
    .input(z.object({ tripId: z.number(), date: z.string() }))
    .query(({ ctx, input }) => getDiaryEntryByDate(input.tripId, ctx.user.id, input.date)),

  upsert: protectedProcedure
    .input(z.object({
      tripId: z.number(),
      date: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      mood: z.enum(["amazing", "happy", "neutral", "tired", "sad"]).optional(),
      weather: z.enum(["sunny", "cloudy", "rainy", "snowy", "windy"]).optional(),
    }))
    .mutation(({ ctx, input }) => upsertDiaryEntry({ ...input, userId: ctx.user.id })),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteDiaryEntry(input.id, ctx.user.id)),
});

// ─── Sharing Router ───────────────────────────────────────────────────────────
const sharingRouter = router({
  createInvite: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const trip = await getTripById(input.tripId, ctx.user.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      if (trip.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "오너만 초대 링크를 생성할 수 있습니다." });
      const token = nanoid(32);
      await createTripShare({ tripId: input.tripId, inviteToken: token, createdBy: ctx.user.id });
      return { token };
    }),

  listInvites: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(async ({ ctx, input }) => {
      const trip = await getTripById(input.tripId, ctx.user.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      return getTripSharesByTrip(input.tripId);
    }),

  deleteInvite: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteTripShare(input.id, ctx.user.id)),

  joinByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const share = await getTripShareByToken(input.token);
      if (!share) throw new TRPCError({ code: "NOT_FOUND", message: "유효하지 않은 초대 링크입니다." });
      if (share.expiresAt && share.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "만료된 초대 링크입니다." });
      }
      const trip = await getTripById(share.tripId, share.createdBy);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      if (trip.userId !== ctx.user.id) {
        await addTripMember({ tripId: share.tripId, userId: ctx.user.id, role: "editor" });
      }
      return { tripId: share.tripId, tripName: trip.name };
    }),

  listMembers: protectedProcedure
    .input(z.object({ tripId: z.number() }))
    .query(async ({ ctx, input }) => {
      const trip = await getTripById(input.tripId, ctx.user.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND" });
      const members = await getTripMembers(input.tripId);
      return { ownerId: trip.userId, members };
    }),

  removeMember: protectedProcedure
    .input(z.object({ tripId: z.number(), userId: z.number() }))
    .mutation(({ ctx, input }) => removeTripMember(input.tripId, input.userId, ctx.user.id)),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  trips: tripsRouter,
  flights: flightsRouter,
  rentals: rentalsRouter,
  accommodations: accommodationsRouter,
  memos: memosRouter,
  itinerary: itineraryRouter,
  diary: diaryRouter,
  sharing: sharingRouter,
});

export type AppRouter = typeof appRouter;
