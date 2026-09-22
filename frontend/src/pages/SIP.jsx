import { useEffect, useState, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { PageHeader, Empty, Badge } from "@/components/common";
import { DatePicker } from "@/components/DatePicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { IdCard, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const PROFESI = ["Dokter Umum", "Dokter Gigi", "Bidan", "Perawat", "Apoteker", "Nutrisionis", "Sanitarian", "Analis Laboratorium", "Penyuluh Kesehatan", "Lainnya"];
const empty = { nomor_sip: "", profesi: "Perawat", tanggal_terbit: "", tanggal_berakhir: "", keterangan: "" };

export default function SIP() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const load = useCallback(() => api.get("/sip").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => { setEdit(s); setForm({ nomor_sip: s.nomor_sip, profesi: s.profesi, tanggal_terbit: s.tanggal_terbit, tanggal_berakhir: s.tanggal_berakhir, keterangan: s.keterangan || "" }); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    if (!form.tanggal_terbit || !form.tanggal_berakhir) { toast.error("Isi tanggal terbit & berakhir"); return; }
    try {
      if (edit) { await api.put(`/sip/${edit.id}`, form); toast.success("SIP diperbarui, menunggu verifikasi ulang"); }
      else { await api.post("/sip", form); toast.success("SIP ditambahkan, menunggu verifikasi admin"); }
      setOpen(false); load();
    } catch (er) { toast.error(apiErr(er)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus SIP ini?")) return; await api.delete(`/sip/${id}`); load(); };

  return (
    <div className="space-y-6">
      <PageHeader title="SIP Saya" desc="Kelola Surat Izin Praktik Anda. Data akan diverifikasi oleh admin.">
        <button onClick={openNew} data-testid="add-sip-btn" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Tambah SIP</button>
      </PageHeader>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">No. SIP</th><th className="px-4 py-3">Profesi</th><th className="px-4 py-3">Berlaku</th><th className="px-4 py-3">Masa</th><th className="px-4 py-3">Verifikasi</th><th className="px-4 py-3">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100" data-testid="sip-table">
              {rows.length === 0 && <tr><td colSpan={6} className="p-8"><Empty text="Belum ada SIP" /></td></tr>}
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.nomor_sip}</td>
                  <td className="px-4 py-3 text-slate-700">{s.profesi}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{s.tanggal_terbit} s/d {s.tanggal_berakhir}{s.sisa_hari !== null && <span className="block text-slate-400">{s.sisa_hari >= 0 ? `${s.sisa_hari} hari lagi` : `lewat ${Math.abs(s.sisa_hari)} hari`}</span>}</td>
                  <td className="px-4 py-3"><Badge type="sipmasa" value={s.masa_status} /></td>
                  <td className="px-4 py-3"><Badge type="sipverif" value={s.status_verifikasi} />{s.status_verifikasi === "ditolak" && s.catatan_verifikasi && <p className="mt-1 text-[10px] text-rose-500">{s.catatan_verifikasi}</p>}</td>
                  <td className="px-4 py-3"><div className="flex gap-1.5"><button onClick={() => openEdit(s)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => del(s.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-heading">{edit ? "Edit" : "Tambah"} SIP</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Nomor SIP</label><input required value={form.nomor_sip} onChange={(e) => setForm({ ...form, nomor_sip: e.target.value })} className={inputCls} data-testid="sip-nomor" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Profesi</label><select value={form.profesi} onChange={(e) => setForm({ ...form, profesi: e.target.value })} className={inputCls} data-testid="sip-profesi">{PROFESI.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal Terbit</label><DatePicker value={form.tanggal_terbit} onChange={(v) => setForm({ ...form, tanggal_terbit: v })} testid="sip-terbit" /></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal Berakhir</label><DatePicker value={form.tanggal_berakhir} onChange={(v) => setForm({ ...form, tanggal_berakhir: v })} testid="sip-berakhir" /></div>
            </div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Keterangan</label><input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className={inputCls} /></div>
            <DialogFooter><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm">Batal</button><button data-testid="sip-submit" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white">Simpan</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
