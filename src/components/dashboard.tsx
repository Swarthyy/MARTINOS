"use client";

import { useState } from "react";
import { Activity, ArrowRight, CalendarDays, ChevronDown, CircleHelp, CreditCard, Dumbbell, FileUp, HeartPulse, LayoutGrid, Menu, Moon, PlugZap, ShieldCheck, Sparkles, TrendingUp, Wallet, X } from "lucide-react";
import { type Connection, type Mode, freshness, integrations } from "@/lib/catalog";

type Props = { configured: boolean; email: string | null; connections: Connection[]; importCount: number; schemaError: boolean };

const modeCopy = {
  life: { title: "Your life, in focus.", subtitle: "A clear view of health, money and the commitments that matter.", accent: "Life mode", icon: HeartPulse },
  ceo: { title: "Lead with clarity.", subtitle: "Keep the Mind of Martin business in view, from audience to revenue.", accent: "CEO mode", icon: TrendingUp }
};

export function Dashboard({ configured, email, connections, importCount, schemaError }: Props) {
  const [mode, setMode] = useState<Mode>("life");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const connectionMap = new Map(connections.map((item) => [item.integration_key, item]));
  const modeIntegrations = integrations.filter((item) => item.mode === mode);
  const shownIntegrations = showAll ? modeIntegrations : modeIntegrations.slice(0, 4);
  const activeCount = connections.filter((item) => item.status === "connected" || item.status === "imported").length;
  const copy = modeCopy[mode];

  async function uploadStatement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setUploadMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/imports/latitude", { method: "POST", body: formData });
      const result = await response.json() as { message?: string; imported?: number };
      setUploadMessage(response.ok ? `Imported ${result.imported ?? 0} rows. Refresh to see updated source status.` : result.message ?? "Import failed.");
      if (response.ok) form.reset();
    } catch {
      setUploadMessage("Import failed. Check your connection and try again.");
    } finally { setUploading(false); }
  }

  return <div className="app-shell flex">
    <aside className={`${mobileMenu ? "flex" : "hidden"} sidebar fixed inset-y-0 z-30 w-64 flex-col px-5 py-7 md:sticky md:top-0 md:flex md:h-screen`}>
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b9e97f] text-[#102113] font-black text-xl">M</div><div><div className="text-sm font-extrabold tracking-[.16em]">MARTIN OS</div><div className="text-[10px] uppercase tracking-[.18em] text-[#8fa89d]">Command centre</div></div></div><button className="md:hidden" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={20}/></button></div>
      <div className="mt-12 text-[11px] uppercase tracking-[.16em] text-[#6f8a82]">Workspace</div>
      <nav className="mt-3 space-y-1" aria-label="Main navigation">
        <a className="flex items-center gap-3 rounded-xl bg-[#1e3028] px-4 py-3 text-sm text-[#c7ef9e]" href="#overview" onClick={() => setMobileMenu(false)}><LayoutGrid size={17}/>Overview</a>
        <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#9fb0aa] hover:bg-[#1b2926]" href="#integrations" onClick={() => setMobileMenu(false)}><PlugZap size={17}/>Integrations</a>
        <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#9fb0aa] hover:bg-[#1b2926]" href="/memory">Memory & Routines</a>
        <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#9fb0aa] hover:bg-[#1b2926]" href="#latitude" onClick={() => setMobileMenu(false)}><FileUp size={17}/>Imports</a>
      </nav>
      <div className="mt-auto panel p-4"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={16} className="text-[#b9e97f]"/>Data integrity</div><p className="muted mt-2 text-xs leading-5">No metrics appear until a connected source supplies them. Every source shows its status and freshness.</p></div>
      <div className="mt-5 truncate text-xs text-[#8da29b]">{email ?? "Local setup preview"}</div>
    </aside>

    <main className="min-w-0 flex-1 px-5 pb-14 pt-6 sm:px-8 lg:px-12" id="overview">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div className="flex items-center gap-3"><button className="md:hidden" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={23}/></button><div className="text-xs uppercase tracking-[.14em] text-[#8aa299]">MARTIN OS <span className="mx-2 text-[#445a51]">/</span> {copy.accent}</div></div><div className="flex items-center gap-2 rounded-full border border-[#34463e] px-3 py-2 text-xs text-[#a8c3ad]"><span className="status-dot"/> {configured ? "Private workspace" : "Setup preview"}</div></header>
      <div className="mx-auto max-w-7xl">
        <section className="mt-10 flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><div className="eyebrow">Your command centre</div><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl lg:text-6xl">{copy.title}</h1><p className="muted mt-4 max-w-xl text-sm leading-6 sm:text-base">{copy.subtitle}</p></div><div className="flex w-fit rounded-xl border border-[#34453f] bg-[#121e1a] p-1" role="group" aria-label="Dashboard mode"><button className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${mode === "life" ? "bg-[#b9e97f] text-[#132217]" : "text-[#aabdb0]"}`} onClick={() => { setMode("life"); setShowAll(false); }}>🌿 LIFE</button><button className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${mode === "ceo" ? "bg-[#b9e97f] text-[#132217]" : "text-[#aabdb0]"}`} onClick={() => { setMode("ceo"); setShowAll(false); }}>💼 CEO</button></div></section>
        {(!configured || schemaError) && <div className="mt-8 rounded-xl border border-[#6b583a] bg-[#2b241a] px-5 py-4 text-sm text-[#f3d8aa]"><strong>{schemaError ? "Database setup needed." : "Preview mode."}</strong> {schemaError ? "Apply supabase/schema.sql to your Supabase project. Your account is protected, but source tables are not ready." : "Connect Supabase to enable private sign-in and real imports. All values below are empty until a source is connected."}</div>}

        <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
          {(mode === "life" ? [
            { label: "Financial position", icon: Wallet, note: "Connect Up or import a statement" },
            { label: "Sleep & recovery", icon: Moon, note: "Connect a sleep source" },
            { label: "Training", icon: Dumbbell, note: "Connect Hevy" },
            { label: "Upcoming", icon: CalendarDays, note: "Connect Google Calendar" }
          ] : [
            { label: "Monthly revenue", icon: CreditCard, note: "Connect a revenue source" },
            { label: "Audience growth", icon: TrendingUp, note: "Connect social analytics" },
            { label: "Community", icon: Activity, note: "Connect Skool" },
            { label: "Upcoming calls", icon: CalendarDays, note: "Connect Calendly" }
          ]).map((card) => <div key={card.label} className="panel min-h-44 p-5"><div className="flex items-start justify-between"><div className="muted text-xs font-medium">{card.label}</div><card.icon size={18} className="text-[#8caa96]"/></div><div className="mt-7 text-2xl font-semibold tracking-tight">No data yet</div><div className="muted mt-2 text-xs">{card.note}</div></div>)}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]"><div className="gradient-card fine-grid relative overflow-hidden rounded-[20px] border border-[#45664c] p-7 sm:p-9"><div className="eyebrow">Intelligence layer</div><h2 className="mt-5 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">A smarter picture starts with trusted data.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#bdd0c4]">Link official sources or import a statement. Martin OS will preserve history, identify where data came from, and keep suggested actions in draft for your review.</p><a href="#integrations" className="btn-primary mt-7 inline-flex items-center gap-2">Explore integrations <ArrowRight size={15}/></a><Sparkles size={120} strokeWidth={.6} className="pointer-events-none absolute -right-2 -bottom-7 text-[#c4ed9b]/20"/></div><div className="panel p-7"><div className="flex items-center justify-between"><div><div className="eyebrow">System pulse</div><h2 className="mt-3 text-xl font-semibold">Data sources</h2></div><Activity size={19} className="text-[#b9e97f]"/></div><div className="mt-8 grid grid-cols-2 gap-4"><div><div className="text-3xl font-semibold">{activeCount}</div><div className="muted mt-1 text-xs">With data</div></div><div><div className="text-3xl font-semibold">{importCount}</div><div className="muted mt-1 text-xs">Imports</div></div></div><div className="mt-7 border-t border-[#2d3b38] pt-5 text-xs text-[#9eb6a6]">{activeCount ? "Check individual sources for freshness." : "Connect or import your first source to begin."}</div></div></section>

        <section className="mt-12" id="integrations"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">Connections</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">Integration registry</h2><p className="muted mt-2 text-sm">Each source has its own status, method and last successful sync.</p></div><button className="btn-quiet inline-flex items-center gap-2" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : "View all sources"}<ChevronDown size={15}/></button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{shownIntegrations.map((integration) => { const connection = connectionMap.get(integration.key); return <div className="panel flex items-center justify-between gap-4 p-5" key={integration.key}><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><span className={`status-dot ${connection?.status ?? ""}`}/>{integration.name}</div><div className="muted mt-1 text-xs">{integration.description}</div><div className="mt-2 text-[11px] text-[#7fa08a]">{connection ? freshness(connection.last_success_at) : "Never synced"} · {integration.method.replaceAll("_", " ")}</div>{connection?.last_error && <div className="mt-2 text-xs text-[#efbb74]">Sync needs attention</div>}</div><span className="shrink-0 rounded-full border border-[#385045] px-3 py-1 text-[11px] text-[#aac4ad]">{connection?.status ?? "Not connected"}</span></div>; })}</div></section>

        <section className="panel mt-10 p-6 sm:p-8" id="latitude"><div className="flex items-start gap-4"><div className="rounded-xl bg-[#2e4435] p-3 text-[#c1e894]"><FileUp size={22}/></div><div><div className="eyebrow">First financial source</div><h2 className="mt-2 text-xl font-semibold">Import a Latitude statement</h2><p className="muted mt-2 max-w-2xl text-sm leading-6">Use the normalized CSV template in the repository. Imported transactions stay private to your account. Amounts are kept unclassified until reconciliation rules are added, so repayments are never silently counted as income or spending.</p></div></div><div className="mt-5 flex flex-wrap items-center gap-3"><a href="/latitude-template.csv" download className="btn-quiet">Download CSV template</a>{configured && <form onSubmit={uploadStatement} className="flex flex-wrap items-center gap-3"><input type="file" name="file" accept=".csv,text/csv" required className="max-w-60 text-xs text-[#a7b8ae] file:mr-3 file:rounded-lg file:border-0 file:bg-[#304b38] file:px-3 file:py-2 file:text-[#d9f3c4]"/><button className="btn-primary" disabled={uploading}>{uploading ? "Importing…" : "Import CSV"}</button></form>}</div>{!configured && <p className="mt-4 text-xs text-[#d8bd8e]">Set up Supabase and sign in before importing personal data.</p>}{uploadMessage && <p role="status" className="mt-4 text-sm text-[#cdecae]">{uploadMessage}</p>}</section>
        <footer className="muted mt-10 flex items-center gap-2 text-xs"><CircleHelp size={14}/>Data is shown only when a source supplies it. AI actions remain draft only.</footer>
      </div>
    </main>
  </div>;
}
