import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Box,
  Building2,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileDown,
  FileText,
  Filter,
  Home,
  Info,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  PackageCheck,
  Phone,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const navy = "#071629";
const ink = "#0f1728";
const muted = "#687386";
const cream = "#f5efe4";

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f3dfc2] text-[#071629] shadow-sm">
        n
      </span>
      <span className={dark ? "text-white" : "text-[#111827]"}>norvia</span>
    </div>
  );
}

function Panel({
  number,
  title,
  children,
  className = "",
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[18px] border border-white/10 bg-white shadow-[0_24px_70px_rgba(5,13,28,.24)] ${className}`}>
      <div className="flex h-9 items-center gap-2 bg-[#061326] px-3 text-[11px] font-bold uppercase tracking-[.11em] text-white/90">
        <span className="rounded border border-white/35 px-2 py-0.5 text-[10px] text-white">{number}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function HeroIllustration() {
  return (
    <div className="relative h-full min-h-[390px] overflow-hidden rounded-br-[18px] bg-[linear-gradient(135deg,#eef1f4,#d6dce4_45%,#8c99a8)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,rgba(255,255,255,.7),transparent_22%),linear-gradient(90deg,rgba(255,255,255,.72),transparent_45%)]" />
      <div className="absolute left-[12%] top-[18%] h-72 w-32 rounded-t-full bg-[#d6dbe2] opacity-70 blur-sm" />
      <div className="absolute right-[8%] top-[11%] h-72 w-44 rounded-[40%] bg-[#1f2937] shadow-2xl">
        <div className="mx-auto mt-8 h-24 w-24 rounded-full bg-[#d9a27e]" />
        <div className="absolute left-7 top-32 h-40 w-32 rounded-t-[38px] bg-[#071629]" />
        <BadgeCheck className="absolute left-11 top-40 h-7 w-7 text-[#d7b36f]" />
      </div>
      <div className="absolute left-[34%] top-[23%] h-72 w-44 rounded-[38px] bg-[#343a42] shadow-xl">
        <div className="mx-auto mt-8 h-24 w-24 rounded-full bg-[#b68b73]" />
        <div className="absolute inset-x-8 top-32 h-36 rounded-t-[34px] bg-[#b5bdc7]" />
      </div>
      <div className="absolute bottom-20 right-[17%] h-24 w-36 rounded-lg bg-[#c9945b] shadow-2xl">
        <div className="h-7 border-b border-[#9b6b3f] px-4 py-1 text-lg font-bold text-[#5c3c21]">norvia</div>
        <div className="mx-auto mt-5 h-1 w-24 bg-[#9b6b3f]/50" />
      </div>
    </div>
  );
}

function HomePanel() {
  const cards = [
    [Home, "Anstaltanpassad information", "Regler och rutiner som gäller för varje anstalt."],
    [Box, "Godkända produkter", "Endast produkter som vanligtvis accepteras på svenska anstalter."],
    [PackageCheck, "Säker leverans", "Vi hanterar och levererar enligt anstaltarnas krav."],
    [UserRound, "Stöd för anhöriga", "Råd, guider och svar på vanliga frågor."],
  ] as const;

  return (
    <Panel number="01" title="Hem – Startsida" className="lg:col-span-5">
      <div className="relative grid min-h-[520px] grid-cols-[1.05fr_.95fr] bg-[#f8f8f7] max-lg:grid-cols-1">
        <div className="z-10 flex flex-col px-12 py-9">
          <div className="mb-10 flex items-center justify-between text-xs">
            <Brand />
            <div className="hidden gap-8 font-semibold text-[#1f2937] md:flex"><span>Sök anstalt</span><span>Skicka paket</span><span>Besök & kontakt</span><span>Guider</span><span>Stöd för anhöriga</span></div>
            <button className="rounded-full border border-[#071629]/20 px-4 py-2 font-bold">Kom igång</button>
          </div>
          <div className="max-w-[500px] flex-1 pt-4">
            <h1 className="text-[54px] font-bold leading-[.96] tracking-[-.055em] text-[#091427]">Tydligare stöd för familjer och närstående.</h1>
            <p className="mt-7 max-w-[390px] text-[15px] leading-7 text-[#455064]">Norvia hjälper dig att förstå reglerna, förbereda rätt försändelser och hålla kontakten – på ett enkelt och tryggt sätt.</p>
            <div className="mt-8 flex max-w-[450px] rounded-xl border border-[#dfe3e8] bg-white p-1.5 shadow-sm">
              <div className="flex flex-1 items-center gap-2 px-3 text-sm text-[#7b8494]"><Search className="h-4 w-4" /> Sök anstalt eller ort...</div>
              <button className="rounded-lg bg-[#061326] px-7 py-3 text-sm font-bold text-white">Sök anstalt</button>
            </div>
            <p className="mt-3 text-xs text-[#6b7280]">Exempel: Kumla, Hall, Malmö, Ystad</p>
          </div>
        </div>
        <HeroIllustration />
        <div className="absolute inset-x-10 bottom-28 z-20 grid grid-cols-4 overflow-hidden rounded-2xl border border-[#e4e7eb] bg-white/95 shadow-xl backdrop-blur max-lg:relative max-lg:inset-auto max-lg:m-6 max-lg:grid-cols-2">
          {cards.map(([Icon, title, text]) => <div key={title} className="border-r border-[#edf0f2] p-6 last:border-r-0"><Icon className="mb-4 h-7 w-7 text-[#091427]" /><h3 className="text-sm font-bold text-[#111827]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#697386]">{text}</p></div>)}
        </div>
        <div className="absolute bottom-0 left-10 right-10 z-30 rounded-t-2xl bg-[#061326] p-6 text-white shadow-2xl max-lg:relative max-lg:left-auto max-lg:right-auto max-lg:mx-6">
          <h2 className="mb-5 text-xl font-bold">Så fungerar det – i 4 enkla steg</h2>
          <div className="grid grid-cols-4 gap-5 max-md:grid-cols-2">
            {["Sök anstalt", "Välj produkter", "Vi kontrollerar", "Vi levererar"].map((step, index) => <div key={step} className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 text-xs">{index + 1}</span><div><p className="text-sm font-bold">{step}</p><p className="mt-1 text-xs leading-5 text-white/62">{["Hitta regler och information.", "Se rekommenderat sortiment.", "Vi säkerställer att allt följer reglerna.", "Paketet levereras säkert."][index]}</p></div></div>)}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function InstitutionPanel() {
  const allowed: Array<[LucideIcon, string]> = [[ShieldCheck, "Hygien"], [Shirt, "Kläder"], [FileText, "Skrivmaterial"], [ShoppingBag, "Livsmedel"], [Phone, "Elektronik*"]];
  const denied: Array<[LucideIcon, string]> = [[Ban, "Parfym & rakvatten"], [Ban, "Skarpa föremål"], [Ban, "Energidrycker"], [Ban, "Spel & lotterier"], [Ban, "Tobaksprodukter"]];
  return (
    <Panel number="02" title="Anstaltssida – Exempel" className="lg:col-span-4">
      <div className="p-8 text-[#101827]">
        <div className="text-xs text-[#697386]">Hem › Sök anstalt › Kriminalvården</div>
        <div className="mt-3 grid grid-cols-[1fr_280px] gap-6">
          <div><h2 className="text-4xl font-bold tracking-tight">Kumlaanstalten</h2><div className="mt-3 flex gap-5 text-xs text-[#687386]"><span>ⓘ Säkerhetsklass</span><span>3 av 5</span></div></div>
          <div className="relative h-24 overflow-hidden rounded-xl bg-[#d6dce4]"><Building2 className="absolute bottom-2 right-3 h-20 w-20 text-[#071629]/65" /><div className="absolute inset-0 bg-gradient-to-r from-white/70 to-transparent" /></div>
        </div>
        <div className="mt-6 flex gap-8 border-b border-[#e7eaf0] text-xs font-bold"><span className="border-b-2 border-[#071629] pb-4">Översikt</span><span>Regler & information</span><span>Besök</span><span>Skicka paket</span><span>Kommunikation</span><span>Vanliga frågor</span></div>
        <div className="mt-6 rounded-lg border border-[#e6ebf1] bg-[#fbfcfd] p-3 text-xs text-[#546174]">Informationsuppdaterad 2026-05-10 <button className="float-right font-bold text-[#071629]">Visa källor</button></div>
        <h3 className="mt-6 text-sm font-bold">Viktig information</h3>
        <div className="mt-3 grid grid-cols-4 gap-3 text-xs"><InfoCard icon={<Clock3 />} title="Pakethämtning" text="Mån – Fre 08:00 – 16:00" /><InfoCard icon={<Truck />} title="Beräknad leveranstid" text="2–5 arbetsdagar" /><InfoCard icon={<CalendarCheck />} title="Besökstid" text="Mån – Sön 10:00 – 17:00" /><div className="rounded-xl bg-[#f7f2ea] p-4"><p className="font-bold">Tips för att undvika avslag</p><ul className="mt-3 space-y-2 text-[#607086]"><li>✓ Kontrollera alltid senaste informationen.</li><li>✓ Packa enligt våra riktlinjer.</li><li>✓ Undvik vätskor och oklara varumärken.</li></ul><button className="mt-4 rounded-lg bg-[#071629] px-4 py-2 font-bold text-white">Se alla packningskrav</button></div></div>
        <h3 className="mt-6 text-sm font-bold">Tillåtna kategorier</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">{allowed.map(([Icon, label]) => <Category key={label} icon={<Icon />} label={label} />)}</div>
        <h3 className="mt-6 text-sm font-bold">Ej tillåtna exempel</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">{denied.map(([Icon, label]) => <Category key={label} icon={<Icon />} label={label} muted />)}</div>
      </div>
    </Panel>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-[#e8ebef] bg-white p-4"> <div className="mb-2 h-5 w-5 text-[#071629]">{icon}</div><p className="font-bold">{title}</p><p className="mt-1 text-[#647085]">{text}</p></div>;
}
function Category({ icon, label, muted: isMuted = false }: { icon: React.ReactNode; label: string; muted?: boolean }) {
  return <div className={`grid place-items-center rounded-xl border p-4 text-center text-xs font-bold ${isMuted ? "border-[#ebe7df] bg-[#faf8f4] text-[#5f6b7d]" : "border-[#e7ebef] bg-white text-[#111827]"}`}><div className="mb-2 h-5 w-5">{icon}</div>{label}</div>;
}

const productImages = ["🧴", "🪥", "🦷", "🧼", "🧦", "🩳", "📓", "🖊️"];
function ProductsPanel() {
  const names = ["Schampo", "Tandkräm", "Tandborste", "Deodorant", "Strumpor (3-pack)", "Kalsonger (3-pack)", "Skrivblock", "Kulspetspenna (3-pack)"];
  return (
    <Panel number="03" title="Produktsida" className="lg:col-span-3">
      <div className="grid grid-cols-[150px_1fr] gap-6 p-8 text-[#111827]">
        <aside className="space-y-8 text-sm"><div><h4 className="mb-4 font-bold">Kategorier</h4>{["Hygien", "Kläder", "Skrivmaterial", "Livsmedel", "Elektronik", "Övrigt"].map((x) => <p key={x} className="mb-4 flex items-center gap-2 text-[#667085]"><span className="h-4 w-4 rounded border" />{x}</p>)}</div><div><h4 className="mb-4 font-bold">Filter</h4>{["Godkänd i Kumla", "Mest populära", "Nyheter"].map((x) => <p key={x} className="mb-3 flex gap-2 text-[#667085]"><span className="h-4 w-4 rounded border" />{x}</p>)}<h4 className="mb-4 mt-7 font-bold">Prisintervall</h4><div className="h-1 rounded bg-[#d7dde7]"><div className="h-1 w-3/5 rounded bg-[#071629]" /></div><div className="mt-3 flex justify-between text-xs text-[#667085]"><span>0 kr</span><span>500 kr+</span></div></div></aside>
        <main><div className="mb-7 flex items-end justify-between"><div><h2 className="text-3xl font-bold tracking-tight">Godkända produkter – Kumlaanstalten</h2><p className="mt-2 text-sm text-[#687386]">Endast produkter som vanligtvis accepteras på anstalten.</p></div><p className="text-xs">Sortera: <b>Mest populära</b></p></div><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{names.map((name, i) => <div key={name} className="rounded-xl border border-[#e7e9ed] bg-white p-3 shadow-sm"><div className="grid h-32 place-items-center rounded-lg bg-[#f4f1ed] text-6xl">{productImages[i]}</div><h3 className="mt-3 text-sm font-bold">{name}</h3><p className="text-xs text-[#697386]">{["250 ml", "75 ml", "1 st", "50 ml", "Storlek 40–45", "Storlek M–XL", "A4 – 50 blad", "Blå"][i]}</p><div className="mt-3 flex items-center justify-between"><b>{[29,19,15,29,49,59,29,15][i]} kr</b><button className="grid h-7 w-7 place-items-center rounded bg-[#071629] text-white">+</button></div></div>)}</div><div className="mt-8 flex items-center justify-between rounded-xl bg-[#f5efe4] p-6"><div><h3 className="font-bold">Osäker på något?</h3><p className="mt-1 text-sm text-[#687386]">Kontakta oss innan du beställer så hjälper vi dig att göra rätt.</p></div><button className="rounded-lg bg-[#071629] px-6 py-3 text-sm font-bold text-white">Kontakta support</button></div></main>
      </div>
    </Panel>
  );
}

function OrdersPanel() {
  return <Panel number="04" title="Mina beställningar – Översikt" className="lg:col-span-4"><div className="grid min-h-[360px] grid-cols-[170px_1fr] bg-white"><Sidebar /><div className="p-8"><h2 className="text-3xl font-bold">Mina beställningar</h2><div className="mt-6 flex gap-8 border-b text-xs font-bold"><span className="border-b-2 border-[#071629] pb-3">Alla</span><span>Pågående</span><span>Under granskning</span><span>Levererade</span><span>Avslutade</span></div><table className="mt-4 w-full text-left text-xs"><thead className="text-[#687386]"><tr><th className="py-3">Beställning</th><th>Anstalt</th><th>Status</th><th>Uppdaterad</th><th>Spåra</th></tr></thead><tbody>{[["#NV-250519-001","Kumlaanstalten","Under granskning","19 maj 2024"],["#NV-250512-002","Hallanstalten","Levererad","14 maj 2024"],["#NV-250505-003","Malmöanstalten","Levererad","7 maj 2024"],["#NV-250428-004","Ystadsanstalten","Avslutad","28 apr. 2024"]].map((r) => <tr key={r[0]} className="border-t"><td className="py-4 font-bold">{r[0]}</td><td>{r[1]}</td><td><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${r[2] === "Levererad" ? "bg-emerald-50 text-emerald-700" : r[2] === "Under granskning" ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>{r[2]}</span></td><td>{r[3]}</td><td>◎</td></tr>)}</tbody></table><div className="mt-6 grid grid-cols-2 gap-4"><div className="rounded-xl bg-[#061326] p-5 text-white"><h3 className="font-bold">Prenumerera & spara</h3><p className="mt-2 text-xs text-white/70">Skapa återkommande beställning.</p><button className="mt-4 rounded bg-[#f5efe4] px-4 py-2 text-xs font-bold text-[#071629]">Skapa prenumeration</button></div><div className="rounded-xl bg-[#eaf2fb] p-5"><h3 className="font-bold">Behöver du hjälp?</h3><p className="mt-2 text-xs text-[#607086]">Vår support svarar snabbt.</p><button className="mt-4 rounded bg-[#071629] px-4 py-2 text-xs font-bold text-white">Till support</button></div></div></div></div></Panel>;
}

function Sidebar() {
  return <aside className="bg-[#061326] p-5 text-white"><Brand dark /><nav className="mt-8 space-y-2 text-xs text-white/70">{["Översikt", "Mina beställningar", "Mina adresser", "Mina uppgifter", "Meddelanden", "Support"].map((x, i) => <p key={x} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${i === 1 ? "bg-white/12 text-white" : ""}`}><Home className="h-4 w-4" />{x}</p>)}</nav><p className="mt-10 flex items-center gap-2 text-xs text-white/60"><LogOut className="h-4 w-4" />Logga ut</p></aside>;
}

function TrackingPanel() {
  return <Panel number="05" title="Beställning – Spårning" className="lg:col-span-4"><div className="min-h-[360px] p-9"><p className="text-xs text-[#687386]">‹ Tillbaka till mina beställningar</p><h2 className="mt-4 text-2xl font-bold">#NV-250519-001</h2><p className="mt-1 text-sm">Kumlaanstalten <span className="ml-3 rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">Under granskning</span></p><div className="mt-8 flex items-start justify-between">{["Beställning mottagen", "Granskning pågår", "Godkänd", "Leverans på väg", "Levererad"].map((s, i) => <div key={s} className="relative flex w-full flex-col items-center text-center text-xs"><span className={`z-10 grid h-7 w-7 place-items-center rounded-full border ${i <= 1 ? "bg-[#071629] text-white" : "bg-white"}`}>{i + 1}</span><p className="mt-2 font-bold">{s}</p><p className="text-[#687386]">{i === 1 ? "19 maj 09:10" : "Väntar"}</p>{i < 4 && <span className="absolute left-1/2 top-3 h-px w-full bg-[#cdd3dc]" />}</div>)}</div><div className="mt-10 grid grid-cols-[1fr_260px] gap-8"><div><h3 className="font-bold">Statusuppdateringar</h3>{["Granskning påbörjad", "Beställning mottagen", "Betalning godkänd"].map((x, i) => <div key={x} className="mt-4 flex gap-3 text-sm"><span className="mt-1 h-2 w-2 rounded-full bg-[#071629]" /><div><p className="font-bold">{x}</p><p className="text-xs text-[#687386]">Din beställning hanteras enligt anstaltens regler.</p></div></div>)}</div><div className="rounded-xl border bg-[#fbfcfd] p-5 text-sm"><h3 className="font-bold">Leveransinformation</h3><p className="mt-4 flex justify-between"><span>Anstalt</span><b>Kumlaanstalten</b></p><p className="mt-3 flex justify-between"><span>Mottagare</span><b>XXXXXX-XXXX</b></p><p className="mt-3 flex justify-between"><span>Beräknad leveranstid</span><b>2–5 arbetsdagar</b></p><button className="mt-6 w-full rounded-lg bg-[#071629] py-3 text-xs font-bold text-white">Visa beställning</button></div></div></div></Panel>;
}

function GuidePanel() {
  return <Panel number="06" title="Guide – Packningsriktlinjer" className="lg:col-span-4"><div className="grid min-h-[360px] grid-cols-[1fr_330px] gap-8 p-9"><div><h2 className="text-3xl font-bold">Så packar du rätt</h2><p className="mt-2 text-[#687386]">Följ dessa steg för att minska risken för avslag och förseningar.</p>{["Rätt produkter", "Rätt mängd", "Ren förpackning", "Märkning"].map((x, i) => <div key={x} className="mt-6 flex gap-4"><span className="grid h-8 w-8 rounded-full border text-center text-sm font-bold place-items-center">{i + 1}</span><div><p className="font-bold">{x}</p><p className="text-sm text-[#687386]">{["Välj endast produkter som är tillåtna på anstalten.", "Följ anstaltens gränser för mängd och storlek.", "Använd genomskinlig påse och enkel kartong.", "Fyll i följesedeln tydligt och komplett."][i]}</p></div></div>)}</div><div className="relative"><div className="h-64 rounded-xl bg-[#c8945f] p-6 shadow-2xl"><div className="h-full rounded border-8 border-[#9d6b3f] bg-[#dfb076] p-5"><div className="h-24 rounded bg-white/75" /><div className="mt-5 flex gap-3"><span className="h-16 flex-1 rounded-full bg-white/70" /><span className="h-16 flex-1 rounded-full bg-[#d8e1e8]" /></div></div></div><div className="mt-5 rounded-xl bg-[#f7f2ea] p-5"><h3 className="font-bold">Viktigt att tänka på</h3>{["Inget tejp på påsen", "Ingen parfym eller doft", "Inget förbjudet innehåll", "Tydlig märkning"].map((x) => <p key={x} className="mt-3 flex gap-2 text-sm text-[#607086]"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{x}</p>)}<button className="mt-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold"><FileDown className="h-4 w-4" />Ladda ner packguide (PDF)</button></div></div></div></Panel>;
}

function MobilePanel() {
  const screens = ["Tydligare stöd\nför familjer och\nnärstående.", "Kumlaanstalten", "Godkända\nprodukter", "Mina beställningar", "#NV-250519-001"];
  return <Panel number="07" title="Mobilupplevelse" className="lg:col-span-4"><div className="flex min-h-[280px] items-end justify-around gap-5 bg-[#f8fafc] p-6">{screens.map((s, i) => <div key={s} className="h-[245px] w-[118px] rounded-[28px] border-[6px] border-[#111827] bg-white p-3 shadow-2xl"><div className="mx-auto mb-3 h-1 w-10 rounded bg-[#111827]" /><Brand /><h3 className="mt-4 whitespace-pre-line text-lg font-bold leading-tight">{s}</h3><div className="mt-4 space-y-2">{[1,2,3].map(n => <div key={n} className="h-8 rounded bg-[#f0f3f7]" />)}</div><button className="mt-3 w-full rounded bg-[#071629] py-2 text-[10px] text-white">Sök</button></div>)}</div></Panel>;
}

function DesignSystemPanel() {
  return <Panel number="08" title="Design system – Visuell identitet" className="lg:col-span-4"><div className="grid min-h-[280px] grid-cols-2 gap-8 p-8"><div><h3 className="font-bold">Färger</h3><div className="mt-4 flex gap-4">{[[navy,"Primär"],[ink,"Sekundär"],["#1b49e5","Accent"],["#f5f7fa","Ljus"],[cream,"Beige"],["#16a34a","Success"]].map(([c,l]) => <div key={l}><div className="h-16 w-16 rounded-lg border" style={{background:c}} /><p className="mt-2 text-xs font-bold">{l}</p></div>)}</div><h3 className="mt-8 font-bold">Typografi</h3><div className="mt-4 grid grid-cols-2 gap-8"><div><p className="text-xs">Canela (Rubriker)</p><p className="text-6xl font-serif">Aa</p></div><div><p className="text-xs">Suisse Intl (Brödtext)</p><p className="text-6xl">Aa</p></div></div></div><div><h3 className="font-bold">Ikoner</h3><div className="mt-4 grid grid-cols-6 gap-4 text-[#071629]">{[Home,Box,Truck,Phone,UserRound,PackageCheck,MessageCircle,Camera,ShieldCheck,ShoppingBag,FileText,LockKeyhole].map((Icon, i) => <Icon key={i} />)}</div><h3 className="mt-8 font-bold">Komponenter</h3><div className="mt-4 flex flex-wrap gap-3"><button className="rounded-lg bg-[#071629] px-4 py-2 text-xs font-bold text-white">Primär knapp</button><button className="rounded-lg border px-4 py-2 text-xs font-bold">Sekundär knapp</button><span className="rounded-full bg-[#f1f4f8] px-4 py-2 text-xs">Chip</span><span className="rounded-lg border px-4 py-2 text-xs">Textfält</span><span className="rounded-lg border px-4 py-2 text-xs">Vald</span><span className="rounded-lg border px-4 py-2 text-xs">Drop-down⌄</span></div></div></div></Panel>;
}

function TrustPanel() {
  return <Panel number="09" title="Förtroende & transparens" className="lg:col-span-4"><div className="min-h-[150px] bg-white p-8"><div className="grid grid-cols-4 gap-4">{[[Box,"Oberoende plattform","Norvia är oberoende och transparent."],[LockKeyhole,"Säker hantering","Vi följer gällande rutiner."],[Info,"Tydlig information","Vi strävar efter uppdaterade regler."],[CircleHelp,"Support i Sverige","Hjälp finns nära för dig."]].map(([Icon,t,d]) => <div key={t as string} className="rounded-xl border p-5"><Icon className="mb-4 h-7 w-7" /><h3 className="font-bold">{t as string}</h3><p className="mt-2 text-xs leading-5 text-[#687386]">{d as string}</p></div>)}</div></div></Panel>;
}

function AboutPanel() {
  return <Panel number="10" title="Om Norvia" className="lg:col-span-4"><div className="relative min-h-[210px] overflow-hidden bg-[#071629] p-9 text-white"><Building2 className="absolute bottom-0 right-12 h-48 w-48 text-white/18" /><h2 className="text-2xl font-bold">Norvia finns här för att göra en svår situation lite enklare.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Vi tror på tydlighet, respekt och mänskligt stöd – varje steg på vägen.</p><div className="mt-10 grid max-w-3xl grid-cols-4 gap-8"><b className="text-2xl">150+<span className="block text-xs font-normal text-white/60">Anstalter i Sverige</span></b><b className="text-2xl">98%<span className="block text-xs font-normal text-white/60">Leveranssäkerhet</span></b><b className="text-2xl">24h<span className="block text-xs font-normal text-white/60">Snabb support</span></b><b className="text-2xl">10 000+<span className="block text-xs font-normal text-white/60">Nöjda anhöriga</span></b></div></div></Panel>;
}

export default function NorviaBoard() {
  return (
    <div className="min-h-screen bg-[#07101f] p-3 font-sans text-[#111827]">
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-3 lg:grid-cols-12">
        <HomePanel />
        <InstitutionPanel />
        <ProductsPanel />
        <OrdersPanel />
        <TrackingPanel />
        <GuidePanel />
        <MobilePanel />
        <DesignSystemPanel />
        <div className="lg:col-span-4 grid gap-3">
          <TrustPanel />
          <AboutPanel />
        </div>
      </div>
    </div>
  );
}
