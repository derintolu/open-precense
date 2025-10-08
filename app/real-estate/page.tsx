"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Role = "agent" | "loan" | "profile";
type GenPage = {
  meta?: { title?: string; description?: string };
  sections?: { id: string; title: string; html: string }[];
  html?: string;
};

const FETCH_URL = "/api/generate";

const ROLES: { id: Role; label: string }[] = [
  { id: "agent", label: "Agent" },
  { id: "loan", label: "Loan Officer" },
  { id: "profile", label: "Profile" },
];

export default function RealEstateRemixPage() {
  const [role, setRole] = useState<Role>("agent");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<{ page: GenPage; q: string; role: Role } | null>(null);
  const htmlRef = useRef<HTMLIFrameElement>(null);

  const placeholder = useMemo(() => {
    if (role === "agent") return "Paste an MLS/listing URL or address…";
    if (role === "loan") return "Paste a lender/rates URL or keywords…";
    return "Enter a name or profile URL (LinkedIn/Zillow/Realtor)…";
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!q.trim()) {
      setError("Enter a URL or keywords to generate.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(FETCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, role }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResp({ page: data.page ?? {}, q: data.q ?? q, role: (data.role as Role) ?? role });
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // write HTML into iframe to avoid CSS collisions
  useEffect(() => {
    if (!htmlRef.current) return;
    const doc = htmlRef.current.contentDocument;
    if (!doc) return;
    const html = resp?.page?.html || "<main class='container'><h1>Waiting for output…</h1></main>";
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root { color-scheme: light dark; }
        body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; }
        img, video { max-width: 100%; height: auto; display: block; }
        .container { max-width: 960px; margin: 0 auto; padding: 24px; }
        .muted { opacity: .85 }
        .grid { display: grid; gap: 16px; }
        .btn { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:12px; background:#111; color:#fff; text-decoration:none; }
        .cta { border:1px solid #e5e5e5; padding:16px; border-radius:16px; }
      </style>
    </head><body>${html}</body></html>`);
    doc.close();
  }, [resp?.page?.html]);

  function download(text: string, filename: string, type = "application/json") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-50 via-white to-zinc-50 text-zinc-900">
      <header className="sticky top-0 backdrop-blur border-b border-zinc-200/70 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-amber-500" />
            <span className="font-semibold">Open-Precense • Real Estate Remix</span>
          </div>
          <div className="text-sm text-zinc-500">Search + LLM • No integrations</div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Turn <span className="text-amber-600">listings</span>, <span className="text-amber-600">profiles</span>, and <span className="text-amber-600">rates</span> into instant pages
        </h1>
        <p className="mt-3 text-zinc-600">
          Paste a link or a name — we’ll search, scrape, and write. Choose a mode below.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4">
        <div className="flex gap-2 justify-center mb-3">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                role === r.id ? "bg-black text-white border-black" : "bg-white hover:bg-zinc-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border bg-white shadow-sm p-2 flex items-center gap-2">
          <input
            className="w-full px-3 py-2 outline-none text-zinc-900 placeholder:text-zinc-400"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-60" disabled={loading}>
            {loading ? "Generating…" : "Scrape • Search • Generate →"}
          </button>
        </form>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 mt-8 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">LLM JSON Output</h2>
              <div className="flex gap-2">
                <button
                  className="text-xs rounded-lg border px-2 py-1"
                  onClick={() => resp?.page && download(JSON.stringify(resp.page, null, 2), "page.json", "application/json")}
                >
                  Export JSON
                </button>
                <button
                  className="text-xs rounded-lg border px-2 py-1"
                  onClick={() => download(resp?.page?.html ?? "", "page.html", "text/html")}
                >
                  Export HTML
                </button>
                <button
                  className="text-xs rounded-lg border px-2 py-1"
                  onClick={() => download(toMarkdown(resp?.page), "page.md", "text/markdown")}
                >
                  Export MD
                </button>
              </div>
            </div>

            <pre className="text-xs overflow-auto max-h-[520px] leading-relaxed">
{JSON.stringify(resp?.page ?? { info: "Submit a query to generate…" }, null, 2)}
            </pre>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Rendered Preview</h2>
              <span className="text-xs text-zinc-500">
                {resp ? `Mode: ${resp.role} • Query: ${resp.q}` : "Waiting for output…"}
              </span>
            </div>
            <div className="border rounded-xl overflow-hidden">
              <iframe ref={htmlRef} className="w-full h-[520px]" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200/70 py-8 text-center text-sm text-zinc-500">
        Built with ❤️ for Agents, LOs, and Teams — Search + LLM only.
      </footer>
    </div>
  );
}

function toMarkdown(page?: GenPage) {
  if (!page) return "# Generated Page\n\n_No content yet._";
  const parts: string[] = [];
  const title = page.meta?.title || "Generated Page";
  const desc = page.meta?.description || "";
  parts.push(`# ${title}`, "");
  if (desc) parts.push(`> ${desc}`, "");

  if (page.sections?.length) {
    for (const s of page.sections) {
      parts.push(`## ${s.title || s.id}`, "");
      parts.push(stripHtml(s.html || ""), "");
    }
  } else {
    parts.push("_No sections provided._");
  }
  return parts.join("\n").trim();
}

function stripHtml(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html || "";
  return (el.textContent || el.innerText || "").trim();
}
