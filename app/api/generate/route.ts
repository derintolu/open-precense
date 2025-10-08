import { NextResponse } from "next/server";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
type Role = "agent" | "loan" | "profile";

const FIRECRAWL_BASE = process.env.FIRECRAWL_BASE ?? "https://api.firecrawl.dev/v1";

/**
 * POST /api/generate
 * Body: { q: string; role: "agent" | "loan" | "profile" }
 * Returns: { page, q, role, scraped }
 */
export async function POST(req: Request) {
  try {
    const { q, role = "agent" } = (await req.json()) as { q?: string; role?: Role };
    if (!q) return NextResponse.json({ error: "Missing input 'q'." }, { status: 400 });

    // 1) scrape/search with Firecrawl
    const scraped = await firecrawl(q);

    // 2) generate via OpenAI as JSON
    const page = await generatePageJSON({ q, role, scraped });

    // sane defaults
    page.meta ??= { title: "Generated Page", description: "" };
    page.sections ??= [];
    page.html ??= "<main class='container'><h1>Generated Page</h1></main>";

    return NextResponse.json({ page, q, role, scraped });
  } catch (err: any) {
    console.error("generate error:", err);
    return NextResponse.json({ error: err?.message || "Generation failed." }, { status: 500 });
  }
}

/* -------------------- helpers -------------------- */

async function firecrawl(q: string): Promise<string> {
  const isUrl = /^https?:\/\//i.test(q.trim());
  const endpoint = isUrl ? "/scrape" : "/search";
  const body = isUrl ? { url: q } : { query: q, limit: 5 };

  const res = await fetch(FIRECRAWL_BASE + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.FIRECRAWL_API_KEY
        ? { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${endpoint} failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (Array.isArray(data?.results)) {
    return data.results
      .map((r: any) => `${r.title ?? ""}\n${r.content ?? ""}`)
      .join("\n\n---\n\n");
  }
  return data?.content ?? JSON.stringify(data);
}

async function generatePageJSON({
  q,
  role,
  scraped,
}: {
  q: string;
  role: "agent" | "loan" | "profile";
  scraped: string;
}) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Open-Precense Real Estate Remix",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt(role, q, scraped) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

/* -------------------- prompts -------------------- */

const systemPrompt = `
You are an expert real-estate landing page builder.
Return STRICT JSON shaped as:
{
  "meta": {"title": string, "description": string},
  "sections": [{"id": string, "title": string, "html": string}],
  "html": string
}
Rules:
- Friendly, trustworthy, scannable copy.
- Be factual to the source; never fabricate reviews/quotes.
- Use semantic HTML only (h1/h2/p/ul/li/section).
- No external CSS or scripts.
`;

function userPrompt(role: Role, q: string, scraped: string) {
  const base = `
QUERY: ${q}

SCRAPED_CONTENT:
${(scraped || "").slice(0, 15000)}

GOALS:
- Produce structured sections tailored to the selected role.
- Also return a complete "html" page assembled from those sections.
- Omit sections if source info is missing (do NOT invent).
`;

  if (role === "agent") {
    return (
      base +
      `
ROLE: Real Estate Agent (Listing/Area Landing)
SECTIONS (suggested):
- Hero (address or hook)
- Listing Highlights (bulleted facts)
- Property Description (concise narrative)
- Neighborhood Vibe (schools/amenities only if present)
- Call to Action (contact mailto/tel placeholders)
`
    );
  }
  if (role === "loan") {
    return (
      base +
      `
ROLE: Loan Officer (Programs/Rates Landing)
SECTIONS (suggested):
- Hero (clear value prop)
- Programs Overview (Conventional/FHA/VA/USDA if present)
- Rates Summary (qualitative; no guarantees)
- FAQ (docs needed, timelines)
- Call to Action (contact mailto/tel placeholders)
DISCLAIMERS:
- Never claim live or guaranteed rates if specifics are missing.
`
    );
  }
  // profile
  return (
    base +
    `
ROLE: Profile Builder (Agent/Team/Pro)
SECTIONS (suggested):
- Hero (name, title, market/service area)
- Bio (short + extended; summarize source)
- Services / Specialties (from source only)
- Reviews/Press (include only if present)
- Links (website/socials if present)
- Contact (mailto/tel placeholders if not provided)
`
  );
}
