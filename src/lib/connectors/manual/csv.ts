import { z } from "zod";

/**
 * CSV import for manual accounts. Expected header (case-insensitive,
 * order-free): date, followers, impressions, reach, engagements, likes,
 * comments, shares, saves, video_views. Only date is required per row.
 */

const rowSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  followers: z.coerce.number().int().nonnegative().optional(),
  impressions: z.coerce.number().int().nonnegative().optional(),
  reach: z.coerce.number().int().nonnegative().optional(),
  engagements: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  saves: z.coerce.number().int().nonnegative().optional(),
  video_views: z.coerce.number().int().nonnegative().optional(),
});

export type CsvStatsRow = z.infer<typeof rowSchema>;

export interface CsvParseResult {
  rows: CsvStatsRow[];
  errors: { line: number; message: string }[];
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  day: "date",
  followers: "followers",
  subscribers: "followers",
  impressions: "impressions",
  views: "impressions",
  reach: "reach",
  engagements: "engagements",
  engagement: "engagements",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  video_views: "video_views",
  videoviews: "video_views",
  "video views": "video_views",
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseStatsCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ line: 0, message: "CSV needs a header row and at least one data row." }],
    };
  }

  const header = splitCsvLine(lines[0]).map(
    (h) => HEADER_ALIASES[h.toLowerCase()] ?? null,
  );
  if (!header.includes("date")) {
    return {
      rows: [],
      errors: [{ line: 1, message: "CSV must include a 'date' column (YYYY-MM-DD)." }],
    };
  }

  const rows: CsvStatsRow[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    header.forEach((key, idx) => {
      if (key && cells[idx] !== undefined && cells[idx] !== "") {
        raw[key] = cells[idx];
      }
    });
    const parsed = rowSchema.safeParse(raw);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      errors.push({
        line: i + 1,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; "),
      });
    }
  }
  return { rows, errors };
}

export const CSV_TEMPLATE = `date,followers,impressions,reach,engagements,likes,comments,shares,saves,video_views
2026-07-01,2650,2100,1600,64,45,6,8,5,1900
2026-07-02,2662,2400,1800,71,50,7,9,5,2100
`;
