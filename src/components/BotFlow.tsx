import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Save, RotateCcw, ChevronLeft, MessageSquareText, Check } from "lucide-react";
import { listBotTexts, saveBotText, listBotSteps } from "@/lib/crm.functions";
import { StepEditor, StepCard } from "@/components/BotSteps";
import { Plus, Home, Store, Factory, Zap } from "lucide-react";
import { offlineQuery } from "@/lib/offline-cache";
import ALL from "@/lib/bot-texts.json";

type T = { k: string; m: string; t: string; s: string; o: string; b?: string; d?: string };
const TEXTS = ALL as T[];
const ORDER = ["الترحيب والقائمة الرئيسية", "السكني", "التجاري", "الصناعي", "التخزين", "عرض السعر", "تعديل المنظومة", "طلب أصناف", "الموقع والمدينة", "دراسة PVsyst", "مخطط SLD", "التقارير", "الشراء والدفع", "التواصل مع المبيعات", "الدعم الفني", "رسائل الانتظار", "أزرار الرجوع", "رسائل عامة", "رسائل أخرى"];

// Keep the original leading/trailing spaces and line breaks so the message layout stays intact.
const edges = (s: string) => { const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)!; return [m[1] ?? "", m[2] ?? "", m[3] ?? ""] as const; };

function Field({ row, saved, onSave }: { row: T; saved: { value: string | null; desc_value: string | null } | undefined; onSave: (v: string | null, d: string | null) => Promise<void> }) {
  const [lead, core, trail] = edges(row.o);
  const cur = saved?.value != null ? edges(saved.value)[1] : core;
  const [v, setV] = useState(cur);
  const [d, setD] = useState(saved?.desc_value ?? row.d ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const isBtn = row.t === "b";
  const changed = v !== cur || (isBtn && row.d != null && d !== (saved?.desc_value ?? row.d));
  const edited = saved != null;
  const save = async (val: string | null, desc: string | null) => {
    setBusy(true);
    try { await onSave(val, desc); setOk(true); setTimeout(() => setOk(false), 1500); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className={`flex items-start gap-1.5 ${isBtn ? "" : "w-full"}`}>
      {isBtn ? (
        <div className="flex-1 space-y-1">
          <input value={v} maxLength={20} onChange={(e) => setV(e.target.value)} aria-label="اسم الزر"
            className={`w-full rounded-full border px-3 py-1 text-center text-sm font-semibold text-primary outline-none focus:ring-2 focus:ring-ring ${edited ? "border-primary bg-primary/5" : "border-input bg-background"}`} />
          {row.d != null && <input value={d} maxLength={72} onChange={(e) => setD(e.target.value)} aria-label="وصف الخيار" className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs text-muted-foreground" />}
        </div>
      ) : (
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={Math.min(8, Math.max(1, v.split("\n").length))} dir="rtl"
          className={`flex-1 resize-y rounded-lg border px-2 py-1.5 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring ${edited ? "border-primary bg-primary/5" : "border-input bg-background"}`} />
      )}
      <div className="flex flex-col gap-1">
        {changed && <button disabled={busy || !v.trim()} onClick={() => save(lead + v + trail, isBtn && row.d != null ? d : null)} aria-label="حفظ" className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /></button>}
        {ok && <span className="p-1.5 text-primary"><Check className="h-4 w-4" /></span>}
        {edited && !changed && <button disabled={busy} onClick={async () => { await save(null, null); setV(core); setD(row.d ?? ""); }} aria-label="إرجاع النص الأصلي" title="إرجاع النص الأصلي" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><RotateCcw className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

// Residential quote path as the customer sees it: 7 stations, each with its message parts and buttons.
const RES_TREE: { title: string; msg: string[]; btns: string[]; note?: string }[] = [
  { title: "اختيار نوع المنظومة", msg: ["5f3a5397b45b53d7", "43496107d13ca096"], btns: ["3e8021ccc9fdb708", "be0ff08827145be4", "dff2de3b794789b3"] },
  { title: "طلب قيمة الفاتورة الشهرية", msg: ["25241f77f16c8dc4"], btns: ["b475509fe976959b"] },
  { title: "نمط الاستخدام (نهار / ليل)", msg: ["14396d9b58cf5304", "0ded4780a60eaa29"], btns: ["2b18ee871f40b0fd", "ac0b2da7a98be976", "49e61614093c2a7f"] },
  { title: "اختيار نوع البطارية", msg: [], btns: ["49e61614093c2a7f"], note: "أسماء البطاريات (UF5000 / Fidus Pro) تأتي من الأصناف — عدّلها من شاشة الأصناف." },
  { title: "ملخص المنظومة المقترحة", msg: ["c70260d1503cbd9e", "2eaea7b9b7d0c673"], btns: ["9d7fbbbf88df922f", "49e61614093c2a7f"] },
  { title: "إدخال اسم العميل", msg: ["1b9f2bd45379d795"], btns: ["49e61614093c2a7f"], note: "زر «الاسم المسجل سابقاً» يظهر تلقائياً باسم العميل." },
  { title: "خيارات ما بعد عرض السعر", msg: [], btns: ["484bf23e3dd44054", "8a500db8ddc7b809", "8bb17c0836d361db", "49e61614093c2a7f"] },
];
// Commercial quote path (approved plan): stations with their harvested message parts and buttons.
const COM_TREE: typeof RES_TREE = [
  { title: "اختيار نوع المنظومة", msg: ["5f3a5397b45b53d7", "43496107d13ca096"], btns: ["3e8021ccc9fdb708", "be0ff08827145be4", "dff2de3b794789b3"] },
  { title: "طريقة إدخال الاستهلاك", msg: ["f59fc2fbde4d4139"], btns: ["bc6b06e11dd584c3", "da5bde195f4ac7d9", "87da7c0b23278abf", "49e61614093c2a7f"] },
  { title: "إدخال قيمة الاستهلاك", msg: ["2e0057c20a9e6656", "75e9f26980fc0454", "769ebb2a960c6fd9"], btns: ["49e61614093c2a7f"], note: "بعدها يتفرع المسار حسب الاستهلاك: جهد منخفض أو جهد عالي." },
];
const comBranch = (lv: boolean): typeof RES_TREE => [
  { title: "طريقة تحديد الإنفرتر", msg: [], btns: ["49e61614093c2a7f"], note: "رسالة وأزرار «الحمل في الساعة / اختيار الإنفرتر» ثابتة داخل البوت حالياً." },
  { title: lv ? "اختيار قدرة الإنفرتر (6–20 kW)" : "اختيار قدرة الإنفرتر (30–125 kW)", msg: ["0069cb23b5a0ae8a", "a2cf5ae56ed8224f"], btns: ["49e61614093c2a7f"], note: "قائمة القدرات تُبنى تلقائياً من الأصناف." },
  { title: "نمط الاستخدام", msg: ["14396d9b58cf5304", "0ded4780a60eaa29"], btns: ["77d0b52a0182f3a2", "2b18ee871f40b0fd", "ac0b2da7a98be976", "49e61614093c2a7f"] },
  lv
    ? { title: "اختيار نوع البطارية", msg: [], btns: ["49e61614093c2a7f"], note: "Hithium 16kWh / Fidus 16kWh — الأسماء من شاشة الأصناف." }
    : { title: "اختيار نظام التخزين والكبائن", msg: [], btns: ["49e61614093c2a7f"], note: "راكات Hithium 112S / Pylontech / كبائن — الأسماء من شاشة الأصناف." },
  { title: "ملخص المنظومة المقترحة", msg: ["e5e513b9703cd7a9"], btns: ["cca78d5e7f57d233", "2dd4e1a26d82b5c8", "49e61614093c2a7f"] },
  { title: "خيارات ما بعد عرض السعر", msg: [], btns: ["484bf23e3dd44054", "8a500db8ddc7b809", "8bb17c0836d361db", "49e61614093c2a7f"] },
];
const COM_LV = comBranch(true);
const COM_HV = comBranch(false);
// Industrial quote path (approved plan): 14 stations.
const IND_TREE: typeof RES_TREE = [
  { title: "اختيار نوع المنظومة", msg: ["5f3a5397b45b53d7", "43496107d13ca096"], btns: ["3e8021ccc9fdb708", "be0ff08827145be4", "dff2de3b794789b3"] },
  { title: "اسم المشروع أو المصنع", msg: ["04213971b6cd422a", "fe05d8c84f2b5a7a", "08cebc7cf6b7a18c"], btns: ["49e61614093c2a7f"] },
  { title: "موقع المشروع", msg: [], btns: ["49e61614093c2a7f"], note: "قائمة المحافظات ثابتة داخل البوت." },
  { title: "نوع النشاط الصناعي", msg: ["db015be4d9a89414", "90a0001df342e6f5", "a442fa39b3a2da6d"], btns: ["3e809abae64270ea", "be3a2d01c8055d81", "74a57aa64db81928", "855e5bd69a46e5e3", "13d94cd6486d3049", "49b560f99302689e", "66514b1009d0fbb3"] },
  { title: "ساعات التشغيل (الورديات)", msg: ["cc615c5901bac3b8", "7b181c7bce18336d"], btns: ["0ff8032cf0bf1d35", "6588bc30ca4a0e3a", "ff7761b4d35dd1a6"] },
  { title: "أوقات الورديات", msg: ["c83700c0108a6988", "d01165ceebe82f3d", "328fec9ecce17e78", "aa7b0bafe44f7543", "740ae4bb945f99e8", "3ef0cbf115786d58"], btns: ["49e61614093c2a7f"] },
  { title: "طريقة إدخال الأحمال", msg: ["44dd7937961ba528", "abbeddc26bca8293", "5a341aec6063b8ac"], btns: ["e7084929a050ac9e", "9de647e82cdf300e", "c49e601e874712b2", "1067986d27697ced"] },
  { title: "إجمالي الحمل التشغيلي", msg: ["3a29c5b7d97ea4c1"], btns: ["49e61614093c2a7f"] },
  { title: "أكبر ماكينة منفردة", msg: ["6bfc398324c81bfc"], btns: ["49e61614093c2a7f"] },
  { title: "محركات تيار الإقلاع العالي", msg: ["32210fb09bfcf81d", "6e3b5fba89476633"], btns: ["2e25a5a3f3602484", "ee63d54e81144d9a"] },
  { title: "مصدر الكهرباء الحالي", msg: ["829b2889e3217ad7", "33ba1f6b42122436", "031fda8fed57607d", "c7c5f6e0aaba29e6", "e77df798e5671923", "4e7192be8fbf45aa", "eb36483bb29d8d54"], btns: ["3f1175301cc0c4a2", "5ed1ccf3315263c0", "d436992eebb929cc", "cd4dc6272a5153d4", "b622987744f8e476"] },
  { title: "الهدف من المنظومة", msg: ["b23245bfa39d669a", "8a12db610f2dc494"], btns: ["3b8c25a45ea558d4", "c37b24d3a5235f92", "06dc98684a4f0026"] },
  { title: "ملخص المنظومة واختيار الخطوة التالية", msg: ["f2b8e3219c9529c1"], btns: ["8a517ef606b599bf"], note: "أرقام الملخص تُحسب تلقائياً." },
  { title: "خيارات ما بعد عرض السعر", msg: [], btns: ["484bf23e3dd44054", "8a500db8ddc7b809", "8bb17c0836d361db", "49e61614093c2a7f"] },
];
const BY_KEY = new Map(TEXTS.map((r) => [r.k, r]));

type Extra = { pw: string; steps: Awaited<ReturnType<typeof listBotSteps>>; refetchSteps: () => void };
function ResTree({ saved, onSave, tree = RES_TREE, label = "السكني", start = 0, mark = "", ex, head = true }: { ex?: Extra; head?: boolean; tree?: typeof RES_TREE; label?: string; start?: number; mark?: string; saved: Map<string, { value: string | null; desc_value: string | null; updated_at?: string }>; onSave: (k: string) => (v: string | null, d: string | null) => Promise<void> }) {
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const txt = (k: string) => { const r = BY_KEY.get(k); return (saved.get(k)?.value ?? r?.o ?? "").trim(); };
  return (
    <div className="rounded-xl border bg-card p-2">
      {head && <div className="p-1 text-sm font-bold text-primary">مسار عرض السعر — {label}</div>}
      <ol className="relative space-y-2 border-r-2 border-primary/30 pr-3">
        {tree.map((st, i) => {
          const keys = [...st.msg, ...st.btns];
          const edited = keys.filter((k) => saved.has(k)).length;
          const isOpen = open === i;
          return (
            <li key={i} className="relative">
              <span className="absolute -right-[1.15rem] top-3 h-3 w-3 rounded-full border-2 border-primary bg-background" />
              <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center gap-2 rounded-lg border bg-background p-2 text-right text-sm font-semibold">
                <span className="flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1 + start}{mark}</span>
                <span className="flex-1">{st.title}</span>
                {edited > 0 && <span className="rounded-full bg-primary/15 px-2 text-xs text-primary">{edited} معدّل</span>}
                <ChevronLeft className={`h-4 w-4 transition-transform ${isOpen ? "-rotate-90" : ""}`} />
              </button>
              {!isOpen && st.msg.length > 0 && <p className="mt-1 line-clamp-2 rounded-md bg-accent/40 px-2 py-1 text-xs leading-5 text-foreground/80">{st.msg.map(txt).join(" … ")}</p>}
              {isOpen && (
                <div className="mt-1 space-y-2 rounded-lg border bg-muted/30 p-2">
                  {st.msg.length > 0 && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" />الرسالة</div>}
                  {st.msg.map((k) => { const r = BY_KEY.get(k); return r ? <Field key={k + (saved.get(k)?.updated_at ?? "")} row={r} saved={saved.get(k)} onSave={onSave(k)} /> : null; })}
                  <div className="text-xs text-muted-foreground">الأزرار</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {st.btns.map((k) => { const r = BY_KEY.get(k); return r ? <div key={k} className="space-y-1"><Field key={k + (saved.get(k)?.updated_at ?? "")} row={r} saved={saved.get(k)} onSave={onSave(k)} />
                      {ex && <button onClick={() => setAdding(adding === k ? null : k)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3 w-3" />إضافة رسالة وأزرار بعد هذا الزر</button>}</div> : null; })}
                  </div>
                  {ex && st.btns.map((k) => (
                    <div key={"s" + k} className="space-y-2">
                      {ex.steps.filter((x) => x.trigger_key === k).map((x) => <div key={x.id}><div className="mb-1 text-xs text-muted-foreground">بعد زر «{txt(k)}»:</div><StepCard pw={ex.pw} step={x} steps={ex.steps} onChanged={ex.refetchSteps} /></div>)}
                      {adding === k && <StepEditor pw={ex.pw} triggerKey={k} section={label} steps={ex.steps} onDone={() => { setAdding(null); ex.refetchSteps(); }} />}
                    </div>
                  ))}
                  {st.note && <p className="text-xs text-muted-foreground">{st.note}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BotFlow({ pw }: { pw: string }) {
  const list = useServerFn(listBotTexts);
  const saveFn = useServerFn(saveBotText);
  const { data: rows = [], refetch } = useQuery(offlineQuery({ queryKey: ["bot-texts"], queryFn: () => list({ data: { pw } }) }));
  const listSteps = useServerFn(listBotSteps);
  const { data: steps = [], refetch: refetchSteps } = useQuery(offlineQuery({ queryKey: ["bot-steps"], queryFn: () => listSteps({ data: { pw } }) }));
  const [adding, setAdding] = useState<string | null>(null);
  const [sys, setSys] = useState<"res" | "com" | "ind" | null>("com");
  const ex: Extra = { pw, steps, refetchSteps: () => void refetchSteps() };
  const saved = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(ORDER[0] ?? null);

  const sections = useMemo(() => {
    const qq = q.trim();
    const hit = (r: T) => !qq || r.o.includes(qq) || (saved.get(r.k)?.value ?? "").includes(qq);
    const bySec = new Map<string, Map<string, T[]>>();
    for (const r of TEXTS) {
      if (!bySec.has(r.s)) bySec.set(r.s, new Map());
      const g = bySec.get(r.s)!;
      if (!g.has(r.m)) g.set(r.m, []);
      g.get(r.m)!.push(r);
    }
    return ORDER.filter((s) => bySec.has(s)).map((s) => {
      const msgs = [...bySec.get(s)!.values()].filter((ms) => ms.some(hit));
      return { s, msgs, edited: msgs.flat().filter((r) => saved.has(r.k)).length };
    }).filter((x) => x.msgs.length);
  }, [q, saved]);

  const onSave = (k: string) => async (value: string | null, desc_value: string | null) => {
    await saveFn({ data: { pw, key: k, value, desc_value } });
    await refetch();
  };

  return (
    <div dir="rtl" className="space-y-3 p-3">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6">
        <b>مسار البوت:</b> هنا كل رسائل البوت النصية وأزراره. عدّل أي نص أو اسم زر واضغط حفظ، والبوت يرسل الجديد من الرسالة التالية.
        الأرقام والأسماء التي يحسبها البوت (القدرة، السعر، اسم العميل) تُضاف تلقائياً بين الأجزاء ولا تحتاج تعديل. الملفات لا تتغير من هنا.
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن كلمة في رسالة أو زر..." aria-label="بحث"
          className="w-full rounded-lg border border-input bg-background py-2 pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {!q.trim() && <div className="space-y-2 rounded-2xl border bg-card p-2">
        <div className="mx-auto w-fit rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">➊ اختيار نوع المنظومة</div>
        <div className="grid grid-cols-3 gap-2">
          {([["res", "السكني", Home], ["com", "التجاري", Store], ["ind", "الصناعي", Factory]] as const).map(([id, t, I]) => (
            <button key={id} onClick={() => setSys(sys === id ? null : id)} className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-bold transition ${sys === id ? "border-accent-foreground/20 bg-[var(--flow-active)] text-[var(--flow-active-foreground)] shadow" : "border-border bg-secondary text-secondary-foreground"}`}><I className="h-4 w-4" />{t}</button>
          ))}
        </div>
        {sys === "res" && <ResTree ex={ex} saved={saved} onSave={onSave} tree={RES_TREE.slice(1)} start={1} label="السكني" head={false} />}
        {sys === "com" && <div className="space-y-2"><ResTree ex={ex} saved={saved} onSave={onSave} tree={COM_TREE.slice(1)} start={1} label="التجاري" head={false} />
          <div className="grid gap-2 md:grid-cols-2">
            {([[COM_LV, "أ", "الجهد المنخفض (LV)", "حتى 20kW"], [COM_HV, "ب", "الجهد العالي (HV)", "أكبر من 20kW"]] as const).map(([tr, m, t, sub]) => (
              <div key={m} className="space-y-1"><div className="flex items-center justify-center gap-2 rounded-xl bg-primary p-2 text-primary-foreground"><Zap className="h-5 w-5 text-[var(--flow-active)]" /><div className="text-center"><b className="text-sm">{t}</b><div className="text-xs font-bold text-[var(--flow-active)]">{sub}</div></div></div>
                <ResTree ex={ex} saved={saved} onSave={onSave} tree={tr} start={3} mark={m} label={"التجاري " + t} head={false} /></div>
            ))}
          </div></div>}
        {sys === "ind" && <ResTree ex={ex} saved={saved} onSave={onSave} tree={IND_TREE.slice(1)} start={1} label="الصناعي" head={false} />}
      </div>}
      <div className="space-y-2 rounded-xl border bg-card p-2">
        <div className="flex items-center gap-2"><b className="flex-1 text-sm text-primary">خطوات مستقلة (تُفتح من خطوات أخرى)</b>
          <button onClick={() => setAdding("__free")} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" />خطوة</button></div>
        {steps.filter((x) => !x.trigger_key).map((x) => <StepCard key={x.id} pw={pw} step={x} steps={steps} onChanged={() => void refetchSteps()} />)}
        {adding === "__free" && <StepEditor pw={pw} triggerKey={null} section={null} steps={steps} onDone={() => { setAdding(null); void refetchSteps(); }} />}
      </div>
      {sections.map(({ s, msgs, edited }) => {
        const isOpen = open === s || !!q.trim();
        return (
          <div key={s} className="rounded-xl border bg-card">
            <button onClick={() => setOpen(isOpen && !q ? null : s)} className="flex w-full items-center gap-2 p-3 text-right font-bold text-primary">
              <ChevronLeft className={`h-4 w-4 transition-transform ${isOpen ? "-rotate-90" : ""}`} />
              <span className="flex-1">{s}</span>
              {edited > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{edited} معدّل</span>}
              <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{msgs.length} رسالة</span>
            </button>
            {isOpen && (
              <div className="space-y-2 px-2 pb-2">
                {msgs.map((ms) => {
                  const texts = ms.filter((r) => r.t === "t");
                  const btns = ms.filter((r) => r.t === "b");
                  return (
                    <div key={ms[0]?.m} className="space-y-2 rounded-lg border bg-background p-2">
                      {texts.length > 0 && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" />رسالة{texts.length > 1 ? ` — ${texts.length} أجزاء، وبينها قيم يضيفها البوت` : ""}</div>}
                      {texts.map((r) => <Field key={r.k + (saved.get(r.k)?.updated_at ?? "")} row={r} saved={saved.get(r.k)} onSave={onSave(r.k)} />)}
                      {btns.length > 0 && <div className="text-xs text-muted-foreground">الأزرار / الخيارات</div>}
                      {btns.length > 0 && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {btns.map((r) => (
                          <div key={r.k} className="space-y-1">
                            <Field key={r.k + (saved.get(r.k)?.updated_at ?? "")} row={r} saved={saved.get(r.k)} onSave={onSave(r.k)} />
                            <button onClick={() => setAdding(r.k)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3 w-3" />إضافة خطوة بعد هذا الزر</button>
                          </div>
                        ))}
                      </div>}
                      {btns.map((r) => (
                        <div key={"s" + r.k} className="space-y-2">
                          {steps.filter((x) => x.trigger_key === r.k).map((x) => <div key={x.id}><div className="mb-1 text-xs text-muted-foreground">بعد زر «{r.o}»:</div><StepCard pw={pw} step={x} steps={steps} onChanged={() => void refetchSteps()} /></div>)}
                          {adding === r.k && <StepEditor pw={pw} triggerKey={r.k} section={s} steps={steps} onDone={() => { setAdding(null); void refetchSteps(); }} />}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
