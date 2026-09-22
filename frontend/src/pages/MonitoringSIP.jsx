import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import api, { apiErr } from "@/lib/api";
import { PageHeader, Empty, Badge, StatCard, hasRole } from "@/components/common";
import { ShieldCheck, CheckCircle2, Clock, XCircle, AlertTriangle, Check, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

const FILTERS = [
  { key: "", label: "Semua" },
  { key: "aktif", label: "Aktif" },
  { key: "akan_habis", label: "Akan Habis" },
  { key: "kadaluarsa", label: "Kadaluarsa" },
];

export default function MonitoringSIP() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const load = useCallback(() => api.get("/sip/dashboard").then((r) => setData(r.data)).catch((e) => toast.error(apiErr(e))), []);
  useEffect(() => { load(); }, [load]);

  const verify = async (s, status) => {
    let catatan = "";
    if (status === "ditolak") { catatan = window.prompt("Alasan penolakan:") || ""; if (!catatan.trim()) return; }
    try { await api.put(`/sip/${s.id}/verify`, { status, catatan }); toast.success(`SIP ${status}`); load(); }
    catch (e) { toast.error(apiErr(e)); }
  };

  if (!data) return <div className="grid h-64 place-items-center text-sm text-slate-400">Memuat monitoring SIP...</div>;
  const s = data.summary;
  const items = filter ? data.items.filter((x) => x.masa_status === filter) : data.items;

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring SIP Tenaga Kesehatan" desc="Pantau masa berlaku Surat Izin Praktik seluruh tenaga kesehatan dan verifikasi pengajuan." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard testid="sip-total" label="Total SIP" value={s.total} icon={ShieldCheck} tone="slate" />
        <StatCard testid="sip-aktif" label="Aktif" value={s.aktif} icon={CheckCircle2} tone="emerald" />
        <StatCard testid="sip-akan" label="Akan Habis" value={s.akan_habis} sub="≤ 90 hari" icon={Clock} tone="amber" />
        <StatCard testid="sip-kadaluarsa" label="Kadaluarsa" value={s.kadaluarsa} icon={XCircle} tone="rose" />
        <StatCard testid="sip-menunggu" label="Menunggu Verifikasi" value={s.menunggu} icon={AlertTriangle} tone="indigo" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-heading font-semibold text-slate-800">Distribusi per Profesi</h3>
        {data.per_profesi.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.per_profesi} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="profesi" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-18} textAnchor="end" height={64} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="jumlah" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} data-testid={`sip-filter-${f.key || "all"}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f.key ? "bg-gradient-to-r from-sky-500 to-teal-500 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{f.label}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Tenaga Kesehatan</th><th className="px-4 py-3">No. SIP</th><th className="px-4 py-3">Profesi</th><th className="px-4 py-3">Berakhir</th><th className="px-4 py-3">Masa</th><th className="px-4 py-3">Verifikasi</th>{isAdmin && <th className="px-4 py-3">Aksi</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100" data-testid="sip-monitor-table">
              {items.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="p-8"><Empty /></td></tr>}
              {items.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3"><p className="font-medium text-slate-800">{x.employee_nama}</p><p className="text-xs text-slate-400">{x.employee_unit}</p></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{x.nomor_sip}</td>
                  <td className="px-4 py-3 text-slate-700">{x.profesi}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{x.tanggal_berakhir}<span className="block text-slate-400">{x.sisa_hari >= 0 ? `${x.sisa_hari} hari lagi` : `lewat ${Math.abs(x.sisa_hari)} hari`}</span></td>
                  <td className="px-4 py-3"><Badge type="sipmasa" value={x.masa_status} /></td>
                  <td className="px-4 py-3"><Badge type="sipverif" value={x.status_verifikasi} /></td>
                  {isAdmin && <td className="px-4 py-3">{x.status_verifikasi === "menunggu" ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => verify(x, "disetujui")} data-testid={`sip-approve-${x.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => verify(x, "ditolak")} data-testid={`sip-reject-${x.id}`} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : <span className="text-xs text-slate-400">—</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
