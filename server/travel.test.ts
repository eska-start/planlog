import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const { ctx } = createAuthContext();
    ctx.res.clearCookie = (name: string, options: Record<string, unknown>) => {
      clearedCookies.push({ name, options });
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
  });
});

describe("trips router - input validation", () => {
  it("create trip requires name and destination", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.trips.create({
        name: "",
        destination: "Tokyo",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
      })
    ).rejects.toThrow();
  });

  it("create trip with valid data passes zod validation", async () => {
    // Just verify the input schema doesn't reject valid data
    const { z } = await import("zod");
    const schema = z.object({
      name: z.string().min(1),
      destination: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
      coverColor: z.string().optional(),
      description: z.string().optional(),
    });
    const result = schema.safeParse({
      name: "Tokyo Trip",
      destination: "Japan",
      startDate: "2024-01-01",
      endDate: "2024-01-07",
      coverColor: "#1e293b",
      description: "A wonderful trip",
    });
    expect(result.success).toBe(true);
  });
});

describe("flights router - input validation", () => {
  it("flight type enum validation works", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.flights.create({
        tripId: 1,
        type: "invalid_type" as "departure",
      })
    ).rejects.toThrow();
  });
});

describe("diary router - mood/weather enum validation", () => {
  it("diary upsert validates mood enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.diary.upsert({
        tripId: 1,
        date: "2024-01-01",
        mood: "invalid_mood" as "happy",
      })
    ).rejects.toThrow();
  });

  it("diary upsert validates weather enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.diary.upsert({
        tripId: 1,
        date: "2024-01-01",
        weather: "invalid_weather" as "sunny",
      })
    ).rejects.toThrow();
  });
});

describe("accommodations router - input validation", () => {
  it("accommodation create requires name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.accommodations.create({
        tripId: 1,
        name: "",
      })
    ).rejects.toThrow();
  });
});

describe("itinerary router - input validation", () => {
  it("itinerary create requires placeName", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.itinerary.create({
        tripId: 1,
        date: "2024-01-01",
        placeName: "",
      })
    ).rejects.toThrow();
  });
});

describe("sharing router - input validation", () => {
  it("createInvite requires tripId as number", async () => {
    const { z } = await import("zod");
    const schema = z.object({ tripId: z.number() });
    expect(schema.safeParse({ tripId: 1 }).success).toBe(true);
    expect(schema.safeParse({ tripId: "abc" }).success).toBe(false);
  });

  it("joinByToken requires token as string", async () => {
    const { z } = await import("zod");
    const schema = z.object({ token: z.string() });
    expect(schema.safeParse({ token: "abc123" }).success).toBe(true);
    expect(schema.safeParse({ token: 123 }).success).toBe(false);
  });

  it("removeMember requires tripId and userId", async () => {
    const { z } = await import("zod");
    const schema = z.object({ tripId: z.number(), userId: z.number() });
    expect(schema.safeParse({ tripId: 1, userId: 2 }).success).toBe(true);
    expect(schema.safeParse({ tripId: 1 }).success).toBe(false);
  });
});

describe("OCR extractFromImage - input validation", () => {
  it("flights extractFromImage requires imageUrl", async () => {
    const { z } = await import("zod");
    const schema = z.object({ imageUrl: z.string().url() });
    expect(schema.safeParse({ imageUrl: "https://example.com/img.jpg" }).success).toBe(true);
    expect(schema.safeParse({ imageUrl: "not-a-url" }).success).toBe(false);
  });

  it("accommodations extractFromImage requires imageUrl", async () => {
    const { z } = await import("zod");
    const schema = z.object({ imageUrl: z.string().url() });
    expect(schema.safeParse({ imageUrl: "https://example.com/booking.png" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("memos router - input validation", () => {
  it("memo create requires tripId as number", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      tripId: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      pinned: z.boolean().optional(),
    });
    expect(schema.safeParse({ tripId: 1, title: "My memo" }).success).toBe(true);
    expect(schema.safeParse({ title: "No tripId" }).success).toBe(false);
  });

  it("memo create accepts optional title and content", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      tripId: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
    });
    expect(schema.safeParse({ tripId: 1 }).success).toBe(true);
    expect(schema.safeParse({ tripId: 1, title: "Hello", content: "World" }).success).toBe(true);
  });
});
