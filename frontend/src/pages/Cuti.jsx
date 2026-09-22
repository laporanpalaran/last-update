import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import api, { apiErr, API } from "@/lib/api";
import { PageHeader, Empty, Badge, hasRole } from "@/components/common";
import { DatePicker } from "@/components/DatePicker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Plus, Printer, Trash2, Check, X, Ban, Save, Wallet, Upload, Paperclip } from "lucide-react";
import { toast } from "sonner";

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const JENIS = ["Tahunan", "Sakit"];
const token = () => localStorage.getItem("espak_token");

function BalanceCards({ b }) {
  if (!b) return null;
  const y = b.tahun || new Date().getFullYear();
  const total = (b.saldo_bersama || 0) + (b.saldo_n2 || 0) + (b.saldo_n1 || 0) + (b.saldo_n || 0);
  const cells = [
    { label: "Cuti Bersama", val: b.saldo_bersama, tone: "from-violet-500 to-purple-500" },
    { label: `N-2 (${y - 2})`, val: b.saldo_n2, tone: "from-amber-500 to-orange-500" },
    { label: `N-1 (${y - 1})`, val: b.saldo_n1, tone: "from-sky-500 to-cyan-500" },
    { label: `N (${y})`, val: b.saldo_n, tone: "from-emerald-500 to-teal-500" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5" data-testid="cuti-balance">
      {cells.map((c) => (
        <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className={`mb-2 grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${c.tone} text-white`}><Wallet className="h-4 w-4" /></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{c.val ?? 0}<span className="ml-1 text-xs font-medium text-slate-400">hari</span></p>
        </div>
      ))}
      <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white shadow-sm sm:col-span-4 lg:col-span-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Total Saldo</p>
        <p className="mt-1 font-heading text-3xl font-extrabold">{total}<span className="ml-1 text-xs font-medium text-slate-400">hari</span></p>
        <p className="mt-1 text-[10px] text-slate-400">Prioritas pakai: Bersama → N-2 → N-1 → N</p>
      </div>
    </div>
  );
}

const emptyForm = { jenis: "Tahunan", tanggal_mulai: "", tanggal_selesai: "", alasan: "", alamat: "", employee_id: "" };

function daysBetween(a, b) {
  if (!a || !b) return 0;
  const d1 = new Date(a), d2 = new Date(b);
  if (d2 < d1) return 0;
  return Math.round((d2 - d1) / 86400000) + 1;
}

function LeaveForm({ form, setForm, onlyOwn = true, staff = [], balance = null }) {
  const jml = daysBetween(form.tanggal_mulai, form.tanggal_selesai);
  const y = balance?.tahun || new Date().getFullYear();
  return (
    <div className="space-y-3">
      {balance && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3" data-testid="cuti-form-saldo">
          <p className="mb-2 text-xs font-semibold text-slate-700">Sisa Saldo Cuti Anda (referensi)</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["Bersama", balance.saldo_bersama], [`N-2 (${y - 2})`, balance.saldo_n2], [`N-1 (${y - 1})`, balance.saldo_n1], [`N (${y})`, balance.saldo_n]].map(([lbl, v]) => (
              <div key={lbl} className="rounded-lg bg-white px-2 py-1.5">
                <p className="text-[10px] font-medium text-slate-500">{lbl}</p>
                <p className="font-heading text-lg font-bold text-slate-900">{v ?? 0}</p>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">Pemakaian saldo: Cuti Bersama → N-2 → N-1 → N. (N = tahun berjalan)</p>
        </div>
      )}
      {!onlyOwn && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Pegawai</label>
          <select required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className={inputCls} data-testid="cuti-employee">
            <option value="">-- Pilih Pegawai --</option>
            {staff.map((s) => <option key={s.employee_id} value={s.employee_id}>{s.nama} {s.is_blud ? "(BLUD)" : ""}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Jenis Cuti</label>
          <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} className={inputCls} data-testid="cuti-jenis">
            {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Jumlah Hari</label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{jml} hari</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal Mulai</label><DatePicker value={form.tanggal_mulai} onChange={(v) => setForm({ ...form, tanggal_mulai: v })} testid="cuti-mulai" /></div>
        <div><label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal Selesai</label><DatePicker value={form.tanggal_selesai} onChange={(v) => setForm({ ...form, tanggal_selesai: v })} testid="cuti-selesai" /></div>
      </div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">Alasan</label><textarea value={form.alasan} onChange={(e) => setForm({ ...form, alasan: e.target.value })} rows={2} className={inputCls} data-testid="cuti-alasan" /></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">Alamat Selama Cuti</label><input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className={inputCls} data-testid="cuti-alamat" /></div>
      {form.jenis === "Tahunan" && <p className="text-xs text-amber-600">Cuti Tahunan memotong saldo (Bersama → N-2 → N-1 → N).</p>}
    </div>
  );
}

function LeaveTable({ rows, showName, onDelete, onVerify, onCancel, onUpload, selfId, isAdmin }) {
  if (!rows.length) return <Empty text="Belum ada data cuti" />;
  const cetak = (id) => window.open(`${API}/leaves/${id}/pdf?auth=${token()}`, "_blank");
  const lihatLampiran = (id) => window.open(`${API}/leaves/${id}/attachment?auth=${token()}`, "_blank");
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              {showName && <th className="px-4 py-3">Pegawai</th>}
              <th className="px-4 py-3">Jenis</th><th className="px-4 py-3">Periode</th><th className="px-4 py-3">Hari</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100" data-testid="cuti-table">
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/60">
                {showName && <td className="px-4 py-3"><p className="font-medium text-slate-800">{l.employee_nama}</p><p className="text-xs text-slate-400">{l.employee_unit}</p></td>}
                <td className="px-4 py-3 text-slate-700">{l.jenis}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{l.tanggal_mulai} s/d {l.tanggal_selesai}{l.alasan ? <span className="block text-slate-400">{l.alasan}</span> : null}</td>
                <td className="px-4 py-3 font-semibold text-slate-700">{l.jumlah_hari}</td>
                <td className="px-4 py-3"><Badge type="leave" value={l.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button title="Cetak / PDF" onClick={() => cetak(l.id)} data-testid={`cuti-print-${l.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><Printer className="h-3.5 w-3.5" /></button>
                    {l.has_lampiran && <button title="Lihat Lampiran" onClick={() => lihatLampiran(l.id)} data-testid={`cuti-lampiran-${l.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"><Paperclip className="h-3.5 w-3.5" /></button>}
                    {onUpload && l.employee_id === selfId && l.status === "diajukan" && (
                      <label title="Upload Lampiran" data-testid={`cuti-upload-${l.id}`} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100">
                        <Upload className="h-3.5 w-3.5" />
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onUpload(l, e.target.files[0]); e.target.value = ""; }} />
                      </label>
                    )}
                    {isAdmin && l.status === "diajukan" && <>
                      <button title="Setujui" onClick={() => onVerify(l, "disetujui")} data-testid={`cuti-approve-${l.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check className="h-3.5 w-3.5" /></button>
                      <button title="Tolak" onClick={() => onVerify(l, "ditolak")} data-testid={`cuti-reject-${l.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><X className="h-3.5 w-3.5" /></button>
                    </>}
                    {isAdmin && ["disetujui", "diajukan"].includes(l.status) && <button title="Batalkan" onClick={() => onCancel(l)} data-testid={`cuti-cancel-${l.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Ban className="h-3.5 w-3.5" /></button>}
                    {onDelete && l.status === "diajukan" && <button title="Hapus" onClick={() => onDelete(l)} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SaldoTab() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get("/leave/balances").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try {
      await api.put(`/leave/balances/${edit.employee_id}`, {
        saldo_n: Number(edit.saldo_n), saldo_n1: Number(edit.saldo_n1),
        saldo_n2: Number(edit.saldo_n2), saldo_bersama: Number(edit.saldo_bersama),
      });
      toast.success("Saldo cuti diperbarui"); setEdit(null); load();
    } catch (e) { toast.error(apiErr(e)); }
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Pegawai</th><th className="px-4 py-3">Bersama</th><th className="px-4 py-3">N-2</th><th className="px-4 py-3">N-1</th><th className="px-4 py-3">N</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100" data-testid="saldo-table">
            {rows.map((b) => (
              <tr key={b.employee_id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><p className="font-medium text-slate-800">{b.nama}</p><p className="text-xs text-slate-400">{b.unit}{b.is_blud ? " · BLUD" : ""}</p></td>
                <td className="px-4 py-3">{b.saldo_bersama}</td><td className="px-4 py-3">{b.saldo_n2}</td><td className="px-4 py-3">{b.saldo_n1}</td><td className="px-4 py-3">{b.saldo_n}</td>
                <td className="px-4 py-3 font-semibold">{(b.saldo_bersama || 0) + (b.saldo_n2 || 0) + (b.saldo_n1 || 0) + (b.saldo_n || 0)}</td>
                <td className="px-4 py-3"><button onClick={() => setEdit({ ...b })} data-testid={`saldo-edit-${b.employee_id}`} className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">Atur</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent><DialogHeader><DialogTitle className="font-heading">Atur Saldo Cuti · {edit?.nama}</DialogTitle></DialogHeader>
          {edit && <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Cuti Bersama</label><input type="number" value={edit.saldo_bersama} onChange={(e) => setEdit({ ...edit, saldo_bersama: e.target.value })} className={inputCls} data-testid="saldo-bersama" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">N-2</label><input type="number" value={edit.saldo_n2} onChange={(e) => setEdit({ ...edit, saldo_n2: e.target.value })} className={inputCls} data-testid="saldo-n2" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">N-1</label><input type="number" value={edit.saldo_n1} onChange={(e) => setEdit({ ...edit, saldo_n1: e.target.value })} className={inputCls} data-testid="saldo-n1" /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">N (tahun berjalan)</label><input type="number" value={edit.saldo_n} onChange={(e) => setEdit({ ...edit, saldo_n: e.target.value })} className={inputCls} data-testid="saldo-n" /></div>
          </div>}
          <DialogFooter><button onClick={() => setEdit(null)} className="rounded-xl border px-4 py-2 text-sm">Batal</button><button onClick={save} data-testid="saldo-save" className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" /> Simpan</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Cuti() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const isManager = hasRole(user, "admin", "kepala");
  const [balance, setBalance] = useState(null);
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [adminAdd, setAdminAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadMine = useCallback(() => { api.get("/leave/my-balance").then((r) => setBalance(r.data)); api.get("/leaves").then((r) => setMine(r.data.filter((l) => l.employee_id === user.id))); }, [user.id]);
  const loadAdmin = useCallback(() => { if (isManager) { api.get("/leaves").then((r) => setAll(r.data)); api.get("/leave/balances").then((r) => setStaff(r.data)); } }, [isManager]);
  useEffect(() => { loadMine(); loadAdmin(); }, [loadMine, loadAdmin]);

  const submit = async (behalf) => {
    try {
      const body = { jenis: form.jenis, tanggal_mulai: form.tanggal_mulai, tanggal_selesai: form.tanggal_selesai, alasan: form.alasan, alamat: form.alamat };
      if (behalf) body.employee_id = form.employee_id;
      if (!body.tanggal_mulai || !body.tanggal_selesai) { toast.error("Isi tanggal mulai & selesai"); return; }
      if (behalf && !body.employee_id) { toast.error("Pilih pegawai"); return; }
      await api.post("/leaves", body);
      toast.success(behalf ? "Cuti pegawai ditambahkan & disetujui" : "Pengajuan cuti terkirim");
      setOpen(false); setAdminAdd(false); setForm(emptyForm); loadMine(); loadAdmin();
    } catch (e) { toast.error(apiErr(e)); }
  };
  const verify = async (l, status) => {
    let catatan = "";
    if (status === "ditolak") { catatan = window.prompt("Alasan penolakan:") || ""; if (!catatan.trim()) return; }
    try { await api.put(`/leaves/${l.id}/verify`, { status, catatan }); toast.success(`Cuti ${status}`); loadAdmin(); loadMine(); }
    catch (e) { toast.error(apiErr(e)); }
  };
  const cancel = async (l) => { if (!window.confirm("Batalkan cuti ini? Saldo akan dikembalikan bila sudah disetujui.")) return; try { await api.put(`/leaves/${l.id}/cancel`); toast.success("Cuti dibatalkan"); loadAdmin(); loadMine(); } catch (e) { toast.error(apiErr(e)); } };
  const del = async (l) => { if (!window.confirm("Hapus pengajuan?")) return; try { await api.delete(`/leaves/${l.id}`); loadMine(); loadAdmin(); } catch (e) { toast.error(apiErr(e)); } };
  const upload = async (l, file) => { const fd = new FormData(); fd.append("file", file); try { await api.post(`/leaves/${l.id}/attachment`, fd); toast.success("Lampiran cuti berhasil diunggah"); loadMine(); loadAdmin(); } catch (e) { toast.error(apiErr(e)); } };

  return (
    <div className="space-y-6">
      <PageHeader title="Cuti Pegawai" desc="Pengajuan, status, dan pengelolaan cuti tenaga BLUD dengan saldo N/N-1/N-2 & cuti bersama.">
        <button onClick={() => { setForm(emptyForm); setOpen(true); }} data-testid="ajukan-cuti-btn" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Ajukan Cuti</button>
      </PageHeader>

      <Tabs defaultValue="saya">
        <TabsList>
          <TabsTrigger value="saya" data-testid="tab-cuti-saya"><CalendarDays className="mr-1.5 h-4 w-4" /> Cuti Saya</TabsTrigger>
          {isManager && <TabsTrigger value="kelola" data-testid="tab-cuti-kelola"><Check className="mr-1.5 h-4 w-4" /> Kelola & Verifikasi</TabsTrigger>}
          {isAdmin && <TabsTrigger value="saldo" data-testid="tab-cuti-saldo"><Wallet className="mr-1.5 h-4 w-4" /> Saldo Pegawai</TabsTrigger>}
        </TabsList>

        <TabsContent value="saya" className="mt-4 space-y-5">
          <BalanceCards b={balance} />
          <h3 className="font-heading text-lg font-semibold text-slate-800">Riwayat Pengajuan Saya</h3>
          <p className="-mt-3 text-xs text-slate-500">Unggah lampiran (surat/dokumen pendukung) pada pengajuan berstatus "Diajukan" sebelum diverifikasi.</p>
          <LeaveTable rows={mine} onDelete={del} onUpload={upload} selfId={user.id} />
        </TabsContent>

        {isManager && (
          <TabsContent value="kelola" className="mt-4 space-y-4">
            {isAdmin && <div className="flex justify-end"><button onClick={() => { setForm(emptyForm); setAdminAdd(true); }} data-testid="admin-add-cuti" className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Tambah Cuti Pegawai</button></div>}
            <LeaveTable rows={all} showName isAdmin={isAdmin} onVerify={verify} onCancel={cancel} />
          </TabsContent>
        )}

        {isAdmin && <TabsContent value="saldo" className="mt-4"><SaldoTab /></TabsContent>}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-heading">Ajukan Cuti</DialogTitle></DialogHeader>
          <LeaveForm form={form} setForm={setForm} onlyOwn balance={balance} />
          <DialogFooter><button onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm">Batal</button><button onClick={() => submit(false)} data-testid="cuti-submit" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white">Kirim Pengajuan</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminAdd} onOpenChange={setAdminAdd}>
        <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-heading">Tambah Cuti Pegawai</DialogTitle></DialogHeader>
          <LeaveForm form={form} setForm={setForm} onlyOwn={false} staff={staff} />
          <DialogFooter><button onClick={() => setAdminAdd(false)} className="rounded-xl border px-4 py-2 text-sm">Batal</button><button onClick={() => submit(true)} data-testid="admin-cuti-submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Simpan & Setujui</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
