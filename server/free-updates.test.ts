import { describe, expect, it } from "vitest";
import {
  parseAccommodationFromText,
  parseFlightFromText,
  parseRentalFromText,
} from "./_core/freeOcr";
import { sanitizeGuestRedirect } from "./_core/redirect";

describe("sanitizeGuestRedirect", () => {
  it("allows app-internal paths", () => {
    expect(sanitizeGuestRedirect("/trips/1?tab=map")).toBe("/trips/1?tab=map");
  });

  it("blocks external redirects", () => {
    expect(sanitizeGuestRedirect("https://evil.example/phish")).toBe("/");
    expect(sanitizeGuestRedirect("//evil.example")).toBe("/");
    expect(sanitizeGuestRedirect("javascript:alert(1)")).toBe("/");
  });
});

describe("free OCR parsers (English & Korean multi-language support)", () => {
  it("parses English flight hints", () => {
    const text = `
AIRLINE: Korean Air
Flight No: KE123
ICN -> NRT
Departure Time: 2026-05-10T09:20
Arrival Time: 2026-05-10T11:30
PNR: ABC12D
Seat: 12A`;

    const parsed = parseFlightFromText(text);
    expect(parsed.airline).toBe("Korean Air");
    expect(parsed.flightNumber).toContain("KE123");
    expect(parsed.departureAirport).toBe("ICN");
    expect(parsed.arrivalAirport).toBe("NRT");
    expect(parsed.bookingRef).toBe("ABC12D");
    expect(parsed.seatNumber).toBe("12A");
    expect(parsed.type).toBe("departure");
  });

  it("parses Korean e-ticket text and infers airline & IATA codes automatically", () => {
    const text = `
[e-티켓 확인증]
편명: 7C 1102
출발: 인천국제공항
도착: 나리타
출발일시: 2026년 5월 10일 09:20
도착일시: 2026년 5월 10일 11:40
예약번호: JJA98K
좌석번호: 18C`;

    const parsed = parseFlightFromText(text);
    expect(parsed.airline).toBe("제주항공");
    expect(parsed.flightNumber).toBe("7C1102");
    expect(parsed.departureAirport).toBe("ICN");
    expect(parsed.arrivalAirport).toBe("NRT");
    expect(parsed.departureTime).toBe("2026-05-10T09:20");
    expect(parsed.arrivalTime).toBe("2026-05-10T11:40");
    expect(parsed.bookingRef).toBe("JJA98K");
    expect(parsed.seatNumber).toBe("18C");
  });

  it("parses English & Korean rental hints", () => {
    const text = `
Rental Company: Hertz
Vehicle: Toyota Camry
Pick-up Location: NRT T1
Drop-off Location: Shinjuku
Booking No: RNT12345
Total: 150000 KRW`;

    const parsed = parseRentalFromText(text);
    expect(parsed.company).toBe("Hertz");
    expect(parsed.carModel).toBe("Toyota Camry");
    expect(parsed.pickupLocation).toBe("NRT T1");
    expect(parsed.dropoffLocation).toBe("Shinjuku");
    expect(parsed.bookingRef).toBe("RNT12345");
    expect(parsed.currency?.toUpperCase()).toBe("KRW");

    const krText = `
도요타 렌터카 예약 확인서
차종: 프리우스 하이브리드
픽업 장소: 후쿠오카 공항점
반납 장소: 하카타역 지점
픽업 일시: 2026.06.01 10:00
반납 일시: 2026.06.03 18:00
예약번호: TYR-998877
결제금액: ¥18,500`;
    const krParsed = parseRentalFromText(krText);
    expect(krParsed.company).toBe("도요타 렌터카");
    expect(krParsed.carModel).toBe("프리우스 하이브리드");
    expect(krParsed.pickupTime).toBe("2026-06-01T10:00");
    expect(krParsed.dropoffTime).toBe("2026-06-03T18:00");
    expect(krParsed.price).toBe("18500");
    expect(krParsed.currency).toBe("JPY");
  });

  it("parses English & Korean accommodation hints", () => {
    const text = `
Hotel: Shinjuku Grand Hotel
Address: 1-2-3 Shinjuku, Tokyo
Check-in Date: 2026-05-10
Check-out Date: 2026-05-12
Confirmation No: HTL12345
Amount: 200 USD`;

    const parsed = parseAccommodationFromText(text);
    expect(parsed.name).toBe("Shinjuku Grand Hotel");
    expect(parsed.address).toContain("Shinjuku");
    expect(parsed.checkIn).toContain("2026-05-10");
    expect(parsed.checkOut).toContain("2026-05-12");
    expect(parsed.bookingRef).toBe("HTL12345");
    expect(parsed.currency?.toUpperCase()).toBe("USD");

    const krHotel = `
숙소명: 도톤보리 리버사이드 호텔
주소: 오사카 주오구 도톤보리 1-2
체크인: 2026년 5월 10일
체크아웃: 2026년 5월 13일
예약번호: AGD881234
결제 금액: ₩320,000`;
    const krParsed = parseAccommodationFromText(krHotel);
    expect(krParsed.name).toBe("도톤보리 리버사이드 호텔");
    expect(krParsed.checkIn).toBe("2026-05-10");
    expect(krParsed.checkOut).toBe("2026-05-13");
    expect(krParsed.bookingRef).toBe("AGD881234");
    expect(krParsed.price).toBe("320000");
    expect(krParsed.currency).toBe("KRW");
  });
});
