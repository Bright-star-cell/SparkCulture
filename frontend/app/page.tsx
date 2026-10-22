"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Command,
  ExternalLink,
  LoaderCircle,
  Play,
  Radio,
  ScanLine,
  Sparkles,
  Utensils,
  Shirt,
  type LucideIcon,
} from "lucide-react";

const verticals = [
  { value: "video_game", label: "Video game" },
  { value: "movie", label: "Film" },
  { value: "tv_show", label: "TV" },
  { value: "podcast", label: "Podcast" },
  { value: "artist", label: "Music" },
  { value: "brand", label: "Brand" },
  { value: "book", label: "Book" },
];

const caseStudies = [
  { eyebrow: "GAMING × CULTURE", title: "Cyberpunk 2077", vertical: "video_game", icon: Command },
  { eyebrow: "DARK SYNTH × SOUND", title: "Perturbator", vertical: "artist", icon: AudioLines },
  { eyebrow: "A24 × PSYCHOLOGICAL", title: "Hereditary", vertical: "movie", icon: Clapperboard },
];

type Partner = {
  id: string;
  name: string;
  vertical: "music" | "fashion" | "dining";
  affinity_score: number;
  score_basis: "qloo_affinity" | "qloo_rank_proxy";
  collaboration_idea: string;
  product_mockup_description: string;
  financial_pro_forma: {
    units: number;
    retail_price_usd: number;
    gross_revenue_usd: number;
    production_cost_usd: number;
    launch_budget_usd: number;
    contribution_before_partner_split_usd: number;
    basis: string;
  };
};

type Analysis = {
  source_entity: { id: string; name: string; vertical: string };
  resolved_tags: { id: string; name: string }[];
  partners: Partner[];
  financial_assumptions: string;
};

const verticalStyle: Record<Partner["vertical"], { icon: LucideIcon; tint: string }> = {
  music: { icon: AudioLines, tint: "text-violet-300" },
  fashion: { icon: Shirt, tint: "text-pink-300" },
  dining: { icon: Utensils, tint: "text-orange-300" },
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const [title, setTitle] = useState("Cyberpunk 2077");
  const [vertical, setVertical] = useState("video_game");
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyze(
    event?: FormEvent<HTMLFormElement>,
    overrides?: { title: string; vertical: string; description?: string },
  ) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setAnalysis(null);
    const input = overrides ?? { title, vertical, description };
    try {
      const response = await fetch("/api/analyze-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          vertical: input.vertical,
          ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const detail =
          typeof payload === "object" && payload !== null && "detail" in payload
            ? String(payload.detail)
            : "The analysis could not be completed.";
        throw new Error(detail);
      }
      setAnalysis(payload as Analysis);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A network error prevented analysis.");
    } finally {
      setLoading(false);
    }
  }

  const bestMatch = analysis?.partners[0];
  const affinityLabel = bestMatch?.score_basis === "qloo_rank_proxy" ? "RELATIVE RANK" : "TASTE AFFINITY";

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="SparkCulture home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-acid text-ink">
              <ScanLine size={18} strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">sparkculture<span className="text-acid">.</span></span>
            <span className="hidden border-l border-line pl-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:inline">
              Culture intelligence
            </span>
          </a>
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-30" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-acid" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-300">Qloo taste graph live</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-acid">
              <Sparkles size={13} /> The culture-to-commerce engine
            </div>
            <h1 className="max-w-3xl text-4xl font-medium leading-[1.07] tracking-[-0.045em] sm:text-6xl">
              Find the signal
              <br />
              <span className="text-muted">between worlds.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-gray-400">
              Turn any IP into its next unexpected collaboration. We map taste across music, fashion, and dining with Qloo&apos;s cultural intelligence.
            </p>
          </div>
          <div className="hidden items-center gap-5 border-l border-line pl-6 lg:flex">
            <div><div className="font-mono text-2xl tracking-tight">250<span className="text-acid">M+</span></div><div className="mt-1 text-[10px] uppercase tracking-widest text-muted">Entities mapped</div></div>
            <div className="h-9 w-px bg-line" />
            <div><div className="font-mono text-2xl tracking-tight">03</div><div className="mt-1 text-[10px] uppercase tracking-widest text-muted">Verticals scanned</div></div>
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-line bg-panel/80 p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">01 / Input signal</div><h2 className="mt-2 text-lg font-medium">Brief your IP</h2></div>
              <CircleHelp size={17} className="text-muted" />
            </div>
            <form onSubmit={analyze} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs text-gray-400">IP title <span className="text-acid">*</span></span>
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Dune: Part Two"
                  className="h-11 w-full rounded-lg border border-line bg-ink px-3 text-sm outline-none transition placeholder:text-gray-600 focus:border-acid/70"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs text-gray-400">Home vertical</span>
                <span className="relative block">
                  <select
                    value={vertical}
                    onChange={(event) => setVertical(event.target.value)}
                    className="h-11 w-full appearance-none rounded-lg border border-line bg-ink px-3 text-sm outline-none focus:border-acid/70"
                  >
                    {verticals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-muted" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs text-gray-400">A little context <span className="text-muted">(optional)</span></span>
                <textarea
                  maxLength={1200}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Genre, audience, world-building, cultural cues…"
                  className="w-full resize-none rounded-lg border border-line bg-ink px-3 py-2.5 text-sm leading-5 outline-none transition placeholder:text-gray-600 focus:border-acid/70"
                />
              </label>
              <button
                type="submit"
                disabled={loading || title.trim().length < 2}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-acid px-4 text-sm font-semibold text-ink transition hover:bg-[#e5ff9b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
                {loading ? "Reading the taste graph…" : "Find cultural matches"}
                {!loading && <ArrowUpRight size={15} className="ml-auto" />}
              </button>
            </form>
            {error && <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">{error}</div>}
            <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-line" /><span className="font-mono text-[9px] uppercase tracking-widest text-muted">Or start with a signal</span><div className="h-px flex-1 bg-line" /></div>
            <div className="space-y-2">
              {caseStudies.map((study) => {
                const Icon = study.icon;
                return (
                  <button
                    key={study.title}
                    type="button"
                    onClick={() => {
                      setTitle(study.title);
                      setVertical(study.vertical);
                      setDescription("");
                      void analyze(undefined, { title: study.title, vertical: study.vertical });
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-line/70 bg-ink/50 p-3 text-left transition hover:border-acid/40 hover:bg-ink"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-gray-300"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{study.title}</span><span className="mt-1 block font-mono text-[9px] tracking-[0.1em] text-muted">{study.eyebrow}</span></span>
                    <ArrowUpRight size={13} className="text-muted" />
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-[10px] leading-4 text-muted">
              <Check size={13} className="mt-0.5 shrink-0 text-acid" /> Your Qloo API key stays server-side. Only analysis inputs are sent to SparkCulture.
            </div>
          </aside>

          <section className="min-h-[620px] rounded-2xl border border-line bg-[#0d1014]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
              <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">02 / Partnership intelligence</div><h2 className="mt-1.5 text-base font-medium">Cross-vertical signals</h2></div>
              <span className="rounded-md border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted">{analysis ? `${analysis.partners.length} MATCHES` : "AWAITING INPUT"}</span>
            </div>

            {!analysis && !loading && (
              <div className="scanlines flex min-h-[545px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-panel text-acid"><Radio size={24} /></div>
                <h3 className="text-sm font-medium">The graph is listening.</h3>
                <p className="mt-2 max-w-xs text-xs leading-5 text-muted">Choose a case study or enter an IP to surface culturally aligned partners and product concepts.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {["MUSIC", "FASHION", "DINING"].map((label, index) => <span key={label} className={`rounded-full border border-line px-3 py-1.5 font-mono text-[9px] tracking-[0.15em] ${index === 0 ? "text-violet-300" : index === 1 ? "text-pink-300" : "text-orange-300"}`}>{label}</span>)}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[545px] flex-col items-center justify-center text-center">
                <LoaderCircle size={30} className="animate-spin text-acid" />
                <p className="mt-5 text-sm text-gray-300">Following the taste signal</p>
                <p className="mt-2 font-mono text-[10px] tracking-widest text-muted">RESOLVING ENTITY · SCANNING 03 VERTICALS</p>
              </div>
            )}

            {analysis && (
              <div className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-panel/70 p-4">
                  <div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Source entity · {analysis.source_entity.vertical}</div><div className="mt-1.5 text-lg font-medium">{analysis.source_entity.name}</div><div className="mt-1 font-mono text-[9px] text-muted">QLOO ID · {analysis.source_entity.id}</div></div>
                  <div className="text-right"><div className="font-mono text-[9px] uppercase tracking-widest text-muted">Resolved taste tags</div><div className="mt-2 flex max-w-sm flex-wrap justify-end gap-1.5">{analysis.resolved_tags.length ? analysis.resolved_tags.map((tag) => <span key={tag.id} className="rounded-md border border-line px-2 py-1 text-[10px] text-gray-300">{tag.name}</span>) : <span className="text-[10px] text-muted">No description tags supplied</span>}</div></div>
                </div>

                <div className="mb-3 grid grid-cols-[minmax(0,1fr)_92px] gap-3 px-3 font-mono text-[9px] uppercase tracking-[0.15em] text-muted sm:grid-cols-[minmax(0,1fr)_100px_140px]">
                  <span>Partner / activation</span><span className="text-right sm:text-center">{affinityLabel}</span><span className="hidden text-right sm:block">Signal</span>
                </div>
                {analysis.partners.length === 0 ? (
                  <div className="rounded-xl border border-line bg-panel/50 p-8 text-center"><p className="text-sm">No cross-vertical recommendations for this signal.</p><p className="mt-2 text-xs text-muted">Try another entity or add a more descriptive context.</p></div>
                ) : (
                  <div className="space-y-2">
                    {analysis.partners.map((partner, index) => {
                      const style = verticalStyle[partner.vertical];
                      const Icon = style.icon;
                      return (
                        <details key={`${partner.vertical}-${partner.id}`} className="group rounded-xl border border-line bg-panel/55 transition hover:border-gray-600">
                          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_92px] items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px] sm:p-4">
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ink"><Icon size={16} className={style.tint} /></span>
                              <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{partner.name}</span>{index === 0 && <span className="hidden rounded bg-acid/10 px-1.5 py-0.5 font-mono text-[8px] tracking-wider text-acid sm:inline">TOP SIGNAL</span>}</span><span className={`mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] ${style.tint}`}>{partner.vertical} · expand brief</span></span>
                            </span>
                            <span className="text-right font-mono text-sm tabular-nums sm:text-center">{partner.affinity_score}<span className="text-muted">%</span></span>
                            <span className="hidden items-center justify-end gap-2 sm:flex"><span className="h-1 w-16 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-acid" style={{ width: `${partner.affinity_score}%` }} /></span><span className="font-mono text-[9px] text-muted">{partner.score_basis === "qloo_affinity" ? "QLOO" : "RANK"}</span><ChevronDown size={13} className="text-muted transition group-open:rotate-180" /></span>
                          </summary>
                          <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2">
                            <div><div className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Collaboration thesis</div><p className="text-xs leading-5 text-gray-300">{partner.collaboration_idea}</p><div className="mb-2 mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Product blueprint</div><p className="text-xs leading-5 text-gray-300">{partner.product_mockup_description}</p></div>
                            <div className="rounded-lg border border-line bg-ink/80 p-3">
                              <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Illustrative pro forma</span><ArrowDownRight size={13} className="text-acid" /></div>
                              <div className="grid grid-cols-2 gap-y-3 text-xs"><span className="text-muted">Gross revenue</span><span className="text-right font-mono">{money(partner.financial_pro_forma.gross_revenue_usd)}</span><span className="text-muted">Production + launch</span><span className="text-right font-mono">{money(partner.financial_pro_forma.production_cost_usd + partner.financial_pro_forma.launch_budget_usd)}</span><span className="border-t border-line pt-2 text-gray-300">Before partner split</span><span className="border-t border-line pt-2 text-right font-mono text-acid">{money(partner.financial_pro_forma.contribution_before_partner_split_usd)}</span></div>
                              <p className="mt-3 text-[9px] leading-4 text-muted">{partner.financial_pro_forma.units.toLocaleString()} units · {money(partner.financial_pro_forma.retail_price_usd)} retail · illustrative assumptions</p>
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-[9px] leading-4 text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>Overlap scores reflect Qloo entity affinity where available; otherwise ordered-result rank.</span>
                  <span className="flex items-center gap-1"><ExternalLink size={10} /> Qloo data · planning estimates only</span>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-muted">{analysis.financial_assumptions}</p>
              </div>
            )}
          </section>
        </section>
        <footer className="mt-7 flex flex-col gap-2 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>SPARKCULTURE / QLOO AGENTIC HACKATHON</span>
          <span>TASTE IS THE NEW DISTRIBUTION CHANNEL</span>
        </footer>
      </div>
    </main>
  );
}
