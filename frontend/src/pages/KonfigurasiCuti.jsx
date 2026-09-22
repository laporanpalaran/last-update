import { useEffect, useState, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { PageHeader } from "@/components/common";
import { SlidersHorizontal, Save, Plus, X, Wallet, CalendarClock, ListPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export default function KonfigurasiCuti() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [newJenis, setNewJenis] = useState("");

  const load = useCallback(() => api.get("/leave/config").then((r) => setCfg(r.data)).catch((e) => toast.error(apiErr(e))), []);
  useEffect(() => { load(); }, [load]);

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));

  const addJenis = () => {
    const v = newJenis.trim();
    if (!v) return;
    if (cfg.jenis_cuti.some((j) => j.toLowerCase() === v.toLowerCase())) { toast.error("Jenis cuti sudah ada"); return; }
    set({ jenis_cuti: [...cfg.jenis_cuti, v] });
    setNewJenis("");
  };
  const removeJenis = (j) => {
    if (cfg.jenis_cuti.length <= 1) { toast.error("Minimal satu jenis cuti"); return; }
    set({ jenis_cuti: cfg.jenis_cuti.filter((x) => x !== j) });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/leave/config", {
        default_saldo_n: Number(cfg.default_saldo_n),
        default_saldo_bersama: Number(cfg.default_saldo_bersama),
        jenis_cuti: cfg.jenis_cuti,
        tahun: Number(cfg.tahun),
      });
      setCfg(data);
      toast.success("Konfigurasi cuti disimpan");
    } catch (e) { toast.error(apiErr(e)); } finally { setSaving(false); }
  };

  const apply = async () => {
    if (!window.confirm("Terapkan saldo default (N & Cuti Bersama) ke SEMUA pegawai BLUD? Saldo N & Cuti Bersama mereka akan ditimpa nilai default. Saldo N-1 & N-2 tidak berubah.")) return;
    setApplying(true);
    try {
      const { data } = await api.post("/leave/config/apply");
      toast.success(`Saldo default diterapkan ke ${data.updated} pegawai BLUD`);
    } catch (e) { toast.error(apiErr(e)); } finally { setApplying(false); }
  };

  if (!cfg) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Konfigurasi Cuti" desc="Atur saldo default, jenis cuti, dan tahun periode untuk pengelolaan cuti tenaga BLUD.">
        <button onClick={save} disabled={saving} data-testid="konfig-cuti-save" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
        </button>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Saldo Default */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white"><Wallet className="h-5 w-5" /></div>
            <div>
              <p className="font-heading text-base font-bold text-slate-900">Saldo Cuti Default</p>
              <p className="text-xs text-slate-500">Nilai awal saat pegawai baru dibuat.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Cuti Tahunan (N)</label>
              <input type="number" min="0" value={cfg.default_saldo_n} onChange={(e) => set({ default_saldo_n: e.target.value })} className={inputCls} data-testid="konfig-saldo-n" />
              <p className="mt-1 text-[10px] text-slate-400">Umumnya 12 hari per tahun.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Cuti Bersama</label>
              <input type="number" min="0" value={cfg.default_saldo_bersama} onChange={(e) => set({ default_saldo_bersama: e.target.value })} className={inputCls} data-testid="konfig-saldo-bersama" />
              <p className="mt-1 text-[10px] text-slate-400">Kuota cuti bersama tahun berjalan.</p>
            </div>
          </div>
        </div>

        {/* Tahun */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white"><CalendarClock className="h-5 w-5" /></div>
            <div>
              <p className="font-heading text-base font-bold text-slate-900">Tahun Periode (N)</p>
              <p className="text-xs text-slate-500">Tahun berjalan untuk perhitungan saldo N/N-1/N-2.</p>
            </div>
          </div>
          <div className="max-w-[12rem]">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tahun</label>
            <input type="number" value={cfg.tahun} onChange={(e) => set({ tahun: e.target.value })} className={inputCls} data-testid="konfig-tahun" />
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <p className="text-xs font-semibold text-amber-700">Terapkan ke Semua Pegawai BLUD</p>
            <p className="mt-1 text-[11px] text-amber-600">Menimpa saldo N &amp; Cuti Bersama seluruh pegawai BLUD dengan nilai default di atas. Berguna saat pergantian tahun.</p>
            <button onClick={apply} disabled={applying} data-testid="konfig-apply" className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${applying ? "animate-spin" : ""}`} /> {applying ? "Menerapkan..." : "Terapkan Sekarang"}
            </button>
          </div>
        </div>

        {/* Jenis Cuti */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white"><ListPlus className="h-5 w-5" /></div>
            <div>
              <p className="font-heading text-base font-bold text-slate-900">Jenis Cuti</p>
              <p className="text-xs text-slate-500">Daftar jenis cuti yang bisa dipilih pegawai saat mengajukan.</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2" data-testid="konfig-jenis-list">
            {cfg.jenis_cuti.map((j) => (
              <span key={j} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 text-sm font-medium text-slate-700">
                {j}
                <button onClick={() => removeJenis(j)} data-testid={`konfig-jenis-remove-${j}`} className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
          <div className="flex max-w-md gap-2">
            <input value={newJenis} onChange={(e) => setNewJenis(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addJenis())} placeholder="cth: Melahirkan, Besar, Alasan Penting" className={inputCls} data-testid="konfig-jenis-input" />
            <button onClick={addJenis} data-testid="konfig-jenis-add" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Tambah</button>
          </div>
        </div>
      </div>
    </div>
  );
}
