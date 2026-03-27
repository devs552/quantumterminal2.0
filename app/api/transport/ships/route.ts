import { NextResponse } from "next/server";
import WebSocket from "ws"; // Next.js bundles `ws` — no install needed in v14+

// ── Config ────────────────────────────────────────────────────────────────────
// 12s gives enough time to receive both PositionReport AND ShipStaticData
// for most vessels, which means ship types (cargo/tanker/etc.) populate correctly.
// The client polls every 60s so the extra 5s wait is imperceptible.
const COLLECT_MS   = 12_000;
const MAX_SHIPS    = 300;
// After MAX_SHIPS positions are collected we still stay open this extra time
// so ShipStaticData messages can fill in the type/name/destination fields.
const STATIC_WAIT_MS = 4_000;

// World's major shipping lanes (North Atlantic, North Sea, Med, Indian Ocean,
// South China Sea, Gulf of Mexico, English Channel, West Africa)
const BOUNDING_BOXES = [
  [[-10, -80], [60,  25]],   // North Atlantic + Europe west coast + Med
  [[  0,  20], [30,  90]],   // Red Sea, Persian Gulf, Indian Ocean north
  [[-40,  20], [10,  80]],   // Indian Ocean south + Africa east
  [[ -5,  90], [35, 135]],   // South China Sea + East Asia
  [[ 20, 120], [50, 150]],   // Japan / Korea / North Pacific
  [[ 15, -100],[35, -75]],   // Gulf of Mexico
  [[-60, -80], [ 0, -30]],   // South Atlantic
];

// ── AIS message shape (aisstream.io PositionReport) ───────────────────────────
interface AISPositionReport {
  Latitude:            number;
  Longitude:           number;
  Sog:                 number;   // Speed over ground (knots)
  Cog:                 number;   // Course over ground (degrees)
  TrueHeading:         number;   // 0–359, or 511 = not available
  NavigationalStatus:  number;
}

interface AISShipStaticData {
  Name:        string;
  Callsign:    string;
  ImoNumber:   number;
  TypeOfShipAndCargoType: number;
  Dimension?:  { A: number; B: number; C: number; D: number };
  Draught?:    number;
  Destination: string;
}

interface AISStreamMessage {
  MessageType: string;
  MetaData: {
    MMSI:        number;
    MMSI_String: string;
    ShipName:    string;
    latitude:    number;
    longitude:   number;
    time_utc:    string;
  };
  Message: {
    PositionReport?:      AISPositionReport;
    ShipStaticData?:      AISShipStaticData;
    StandardClassBPositionReport?: AISPositionReport;
  };
}

// ── Vessel accumulator ────────────────────────────────────────────────────────
interface VesselSnapshot {
  mmsi:        string;
  name:        string;
  lat:         number;
  lng:         number;
  speed:       number;
  heading:     number;
  course:      number;
  status:      number;
  type:        number;
  flag:        string;
  destination: string;
  length:      number;
  width:       number;
  draught:     number;
  imo:         string;
}

/** Derive flag from MMSI mid (first 3 digits of MMSI).
 *  Partial list of common MIDs — expand as needed. */
function mmsiToFlag(mmsi: string): string {
  const mid = parseInt(mmsi.substring(0, 3), 10);
  const MID_MAP: Record<number, string> = {
    201: "AL", 203: "AT", 205: "BE", 209: "CY", 211: "DE", 212: "CY",
    213: "GE", 214: "MD", 215: "MT", 218: "DE", 219: "DK", 220: "DK",
    224: "ES", 225: "ES", 226: "FR", 227: "FR", 228: "FR", 229: "MT",
    230: "FI", 231: "FO", 232: "GB", 233: "GB", 234: "GB", 235: "GB",
    236: "GI", 237: "GR", 238: "HR", 239: "GR", 240: "GR", 241: "GR",
    242: "MA", 243: "HU", 244: "NL", 245: "NL", 246: "NL", 247: "IT",
    248: "MT", 249: "MT", 250: "IE", 251: "IS", 252: "LI", 253: "LU",
    254: "MC", 255: "PT", 256: "MT", 257: "NO", 258: "NO", 259: "NO",
    261: "PL", 262: "ME", 263: "PT", 264: "RO", 265: "SE", 266: "SE",
    267: "SK", 268: "SM", 269: "CH", 270: "CZ", 271: "TR", 272: "UA",
    273: "RU", 274: "MK", 275: "LV", 276: "EE", 277: "LT", 278: "SI",
    279: "RS", 303: "US", 305: "AG", 308: "BS", 309: "BS", 310: "BM",
    311: "BS", 316: "CA", 319: "KY", 338: "US", 339: "SV", 341: "TC",
    351: "PA", 352: "PA", 353: "PA", 354: "PA", 355: "PA", 356: "PA",
    357: "PA", 370: "PA", 371: "PA", 372: "PA", 373: "PA", 374: "PA",
    375: "SV", 376: "VC", 377: "TT", 378: "VC", 379: "SV", 401: "IN",
    403: "PK", 405: "BD", 408: "CN", 412: "CN", 413: "CN", 414: "CN",
    416: "TW", 417: "LK", 419: "IN", 422: "IR", 423: "AZ", 425: "IQ",
    426: "IL", 428: "JP", 431: "JP", 432: "JP", 434: "SA", 436: "KW",
    440: "KR", 441: "KR", 443: "PS", 450: "TH", 451: "VN", 452: "VN",
    453: "HK", 455: "MY", 457: "PH", 461: "SG", 463: "SG", 466: "SG",
    470: "AE", 477: "HK", 478: "LK", 503: "AU", 506: "NZ", 510: "BN",
    511: "KI", 512: "NZ", 514: "TL", 523: "FJ", 525: "ID", 529: "MY",
    531: "PN", 533: "MY", 536: "PW", 538: "MH", 540: "FM", 542: "CK",
    544: "SB", 553: "TK", 555: "WS", 557: "VU", 559: "TO", 561: "PG",
    563: "SG", 564: "SG", 565: "SG", 566: "SG", 567: "SG", 601: "ZA",
    603: "AO", 605: "DZ", 607: "TF", 608: "CI", 609: "BI", 610: "BJ",
    611: "BW", 612: "CF", 613: "CM", 615: "CG", 616: "CG", 617: "RE",
    618: "ER", 619: "EG", 620: "ET", 621: "SZ", 622: "GA", 624: "GH",
    625: "GM", 626: "GN", 627: "GW", 628: "EQ", 629: "KE", 630: "SS",
    631: "LS", 632: "LR", 633: "LY", 634: "MG", 635: "MW", 636: "LR",
    637: "MR", 638: "MU", 642: "MA", 644: "MZ", 645: "NA", 647: "NE",
    648: "NG", 649: "NI", 650: "EG", 654: "RW", 655: "SD", 656: "SN",
    657: "SC", 659: "SL", 660: "SO", 661: "SS", 664: "TN", 665: "TZ",
    666: "UG", 667: "CD", 668: "ZM", 669: "ZW",
  };
  return MID_MAP[mid] ?? "??";
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const apiKey = process.env.AISSTREAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        ships: [],
        error:
          "AISSTREAM_API_KEY not set. Get a free key at https://aisstream.io and add it to .env.local",
      },
      { status: 500 }
    );
  }

  try {
    const ships = await collectAISData(apiKey);
    return NextResponse.json({
      success:       true,
      count:         ships.length,
      total_vessels: ships.length,
      ships,
      source:        "aisstream.io · live AIS WebSocket",
    });
  } catch (err: any) {
    console.error("[ships] aisstream error:", err.message);
    return NextResponse.json(
      { success: false, ships: [], error: err.message },
      { status: 500 }
    );
  }
}

// ── Core WS collector ─────────────────────────────────────────────────────────
function collectAISData(apiKey: string): Promise<VesselSnapshot[]> {
  return new Promise((resolve, reject) => {
    const vessels = new Map<string, VesselSnapshot>();
    let   settled = false;

    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

    // ── Helpers ───────────────────────────────────────────────────────────────
    function finish() {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (_) {}
      resolve(Array.from(vessels.values()));
    }

    function fail(err: Error) {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (_) {}
      reject(err);
    }

    // ── Timer: collect for COLLECT_MS then return snapshot ───────────────────
    const timer = setTimeout(finish, COLLECT_MS);

    // ── WS events ─────────────────────────────────────────────────────────────
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          Apikey:             apiKey,
          BoundingBoxes:      BOUNDING_BOXES,
          FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ShipStaticData"],
        })
      );
    });

    ws.on("message", (raw: Buffer | string) => {
      // Once we have enough positions, start a short extra window for static data
      // rather than cutting off immediately — this fills in ship types / names.
      if (vessels.size >= MAX_SHIPS && !settled) {
        clearTimeout(timer);
        setTimeout(finish, STATIC_WAIT_MS);
        // Don't return — keep processing static messages during the wait
      }

      let msg: AISStreamMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const meta = msg.MetaData;
      const mmsi = String(meta?.MMSI ?? "");
      if (!mmsi || !meta?.latitude || !meta?.longitude) return;

      // ── PositionReport (Class A & B) ────────────────────────────────────────
      const pos: AISPositionReport | undefined =
        msg.Message.PositionReport ??
        msg.Message.StandardClassBPositionReport;

      if (pos) {
        const existing = vessels.get(mmsi) ?? ({} as Partial<VesselSnapshot>);
        vessels.set(mmsi, {
          mmsi,
          name:        existing.name        ?? meta.ShipName?.trim() ?? "",
          lat:         meta.latitude,
          lng:         meta.longitude,
          speed:       Number((pos.Sog ?? 0).toFixed(1)),
          heading:     pos.TrueHeading < 360 ? pos.TrueHeading : pos.Cog ?? 0,
          course:      Number((pos.Cog ?? 0).toFixed(0)),
          status:      pos.NavigationalStatus ?? 0,
          type:        existing.type        ?? 0,
          flag:        existing.flag        ?? mmsiToFlag(mmsi),
          destination: existing.destination ?? "",
          length:      existing.length      ?? 0,
          width:       existing.width       ?? 0,
          draught:     existing.draught     ?? 0,
          imo:         existing.imo         ?? "",
        });
      }

      // ── ShipStaticData (name, type, destination, dimensions) ────────────────
      const stat: AISShipStaticData | undefined = msg.Message.ShipStaticData;
      if (stat) {
        const existing = vessels.get(mmsi) ?? ({} as Partial<VesselSnapshot>);
        vessels.set(mmsi, {
          mmsi,
          name:        stat.Name?.trim()        || existing.name    || meta.ShipName?.trim() || "",
          lat:         existing.lat              ?? meta.latitude,
          lng:         existing.lng              ?? meta.longitude,
          speed:       existing.speed            ?? 0,
          heading:     existing.heading          ?? 0,
          course:      existing.course           ?? 0,
          status:      existing.status           ?? 0,
          type:        stat.TypeOfShipAndCargoType ?? existing.type ?? 0,
          flag:        mmsiToFlag(mmsi),
          destination: stat.Destination?.trim()  || existing.destination || "",
          length:      (stat.Dimension?.A ?? 0) + (stat.Dimension?.B ?? 0),
          width:       (stat.Dimension?.C ?? 0) + (stat.Dimension?.D ?? 0),
          draught:     stat.Draught              ?? existing.draught ?? 0,
          imo:         stat.ImoNumber > 0 ? String(stat.ImoNumber) : (existing.imo ?? ""),
        });
      }
    });

    ws.on("error", (err: Error) => {
      clearTimeout(timer);
      fail(err);
    });

    ws.on("close", () => {
      clearTimeout(timer);
      finish();
    });
  });
}