"""Seed demo data for E-SPAK."""
import os
import uuid
from datetime import datetime, timezone, timedelta


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def seed_data(db, hash_password):
    # ---- Users ----
    if await db.users.count_documents({}) == 0:
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@espak.id")
        admin_user = os.environ.get("ADMIN_USERNAME", "admin")
        admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
        users = [
            {"username": admin_user, "nip": "19700101 200001 1 001", "email": admin_email,
             "password": admin_pass, "nama": "Administrator E-SPAK", "role": "admin",
             "jabatan": "Administrator Sistem", "unit": "Tata Usaha"},
            {"username": "kepala", "nip": "19780512 200312 1 004", "email": "kepala@espak.id",
             "password": "kepala123", "nama": "dr. H. Ahmad Fauzi, M.Kes", "role": "kepala",
             "jabatan": "Kepala Puskesmas", "unit": "Manajemen"},
            {"username": "pjkia", "nip": "19850321 201001 2 015", "email": "pjkia@espak.id",
             "password": "pj123", "nama": "Ns. Siti Rahmawati, S.Kep", "role": "pj_program",
             "jabatan": "Bidan Koordinator", "unit": "KIA"},
            {"username": "pjtb", "nip": "19880711 201203 1 009", "email": "pjtb@espak.id",
             "password": "pj123", "nama": "Budi Santoso, A.Md.Kep", "role": "pj_program",
             "jabatan": "Perawat P2P", "unit": "P2P"},
        ]
        nakes = [
            ("Dewi Lestari, A.Md.Keb", "Bidan", "KIA"),
            ("Rian Hidayat, S.Farm", "Apoteker", "Kefarmasian"),
            ("Maya Puspita, A.Md.Gz", "Nutrisionis", "Gizi"),
            ("Andi Wijaya, A.Md.Kep", "Perawat", "UKP"),
            ("Nur Aisyah, S.KM", "Penyuluh Kesehatan", "Promkes"),
            ("Fajar Nugroho, A.Md.AK", "Analis Laboratorium", "Laboratorium"),
            ("Rina Marlina, A.Md.Keb", "Bidan", "KIA"),
            ("Hendra Gunawan, A.Md.KL", "Sanitarian", "Kesling"),
            ("Sri Wahyuni, A.Md.Kep", "Perawat", "PTM"),
            ("Taufik Rahman, drg", "Dokter Gigi", "UKP"),
        ]
        for i, (nama, jab, unit) in enumerate(nakes, 1):
            users.append({"username": f"pegawai{i}", "nip": f"1990{i:02d}15 2015{i:02d} 1 00{i}",
                          "email": f"pegawai{i}@espak.id", "password": "pegawai123", "nama": nama,
                          "role": "pegawai", "jabatan": jab, "unit": unit, "is_blud": (i % 3 != 0)})
        for u in users:
            uroles = u.get("roles") or [u["role"]]
            tipe = "BLUD" if u.get("is_blud") else "ASN"
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "username": u["username"], "nip": u["nip"], "email": u["email"],
                "password_hash": hash_password(u["password"]), "nama": u["nama"],
                "role": uroles[0], "roles": uroles, "is_blud": u.get("is_blud", False), "tipe_pegawai": tipe,
                "jabatan": u["jabatan"], "unit": u["unit"], "status": "aktif",
                "created_at": now_iso(), "updated_at": now_iso(),
            })

    all_users = await db.users.find().to_list(1000)
    pj_kia = next((u for u in all_users if u["username"] == "pjkia"), None)
    pj_tb = next((u for u in all_users if u["username"] == "pjtb"), None)

    # ---- Official SPM Kesehatan (Permenkes No. 6 Tahun 2024) ----
    # Structure only: 12 jenis pelayanan dasar kabupaten/kota (target 100%).
    # Monthly achievement (capaian) is left EMPTY to be filled by the puskesmas.
    # Certificates & policy briefs are intentionally NOT seeded.
    if await db.programs.count_documents({}) == 0:
        spm_def = [
            ("Kesehatan Ibu, Bayi & Balita (KIA)", pj_kia, [
                "Pelayanan Kesehatan Ibu Hamil",
                "Pelayanan Kesehatan Ibu Bersalin",
                "Pelayanan Kesehatan Bayi Baru Lahir",
                "Pelayanan Kesehatan Balita",
            ]),
            ("Kesehatan Usia Sekolah, Produktif & Lanjut", None, [
                "Pelayanan Kesehatan pada Usia Pendidikan Dasar",
                "Pelayanan Kesehatan pada Usia Produktif",
                "Pelayanan Kesehatan pada Usia Lanjut",
            ]),
            ("Penyakit Tidak Menular (PTM)", None, [
                "Pelayanan Kesehatan Penderita Hipertensi",
                "Pelayanan Kesehatan Penderita Diabetes Melitus",
            ]),
            ("Kesehatan Jiwa", None, [
                "Pelayanan Kesehatan Orang dengan Gangguan Jiwa (ODGJ) Berat",
            ]),
            ("Pencegahan & Pengendalian Penyakit Menular (P2P)", pj_tb, [
                "Pelayanan Kesehatan Orang Terduga Tuberkulosis",
                "Pelayanan Kesehatan Orang dengan Risiko Terinfeksi HIV",
            ]),
        ]
        for pnama, pj, inds in spm_def:
            pid = str(uuid.uuid4())
            await db.programs.insert_one({
                "id": pid, "nama_program": pnama,
                "penanggung_jawab_id": pj["id"] if pj else "",
                "penanggung_jawab": pj["nama"] if pj else "-",
                "status": "aktif", "created_at": now_iso(),
            })
            for inama in inds:
                await db.indicators.insert_one({
                    "id": str(uuid.uuid4()), "program_id": pid, "nama_indikator": inama,
                    "target": 100, "satuan": "%", "status": "aktif", "created_at": now_iso(),
                })

    # ---- Saldo cuti awal untuk pegawai (ASN & BLUD) ----
    if await db.leave_balances.count_documents({}) == 0:
        year = datetime.now(timezone.utc).year
        pegawai = [u for u in all_users if "pegawai" in (u.get("roles") or [u.get("role")])]
        for i, u in enumerate(pegawai):
            await db.leave_balances.insert_one({
                "id": str(uuid.uuid4()), "employee_id": u["id"], "tahun": year,
                "saldo_n": 12, "saldo_n1": 6 if i % 2 == 0 else 0,
                "saldo_n2": 3 if i % 3 == 0 else 0, "saldo_bersama": 3,
                "updated_at": now_iso(),
            })

    # ---- Contoh data SIP tenaga kesehatan ----
    if await db.sip.count_documents({}) == 0:
        prof_map = {"Bidan": "SIPB", "Perawat": "SIPP", "Apoteker": "SIPA",
                    "Dokter Gigi": "SIPDG", "Nutrisionis": "SIP", "Sanitarian": "SIP",
                    "Analis Laboratorium": "SIP", "Penyuluh Kesehatan": "SIP"}
        pegawai = [u for u in all_users if "pegawai" in (u.get("roles") or [u.get("role")])]
        offsets = [400, 250, 60, -20, 800, 30, 500, 120, -5, 700]
        for i, u in enumerate(pegawai):
            prof = u.get("jabatan", "Perawat")
            end = datetime.now(timezone.utc) + timedelta(days=offsets[i % len(offsets)])
            terbit = end - timedelta(days=1825)
            await db.sip.insert_one({
                "id": str(uuid.uuid4()), "employee_id": u["id"],
                "nomor_sip": f"{prof_map.get(prof,'SIP')}/{1000+i}/DINKES/{terbit.year}",
                "profesi": prof, "tanggal_terbit": terbit.strftime("%Y-%m-%d"),
                "tanggal_berakhir": end.strftime("%Y-%m-%d"), "keterangan": "",
                "status_verifikasi": "disetujui" if i % 4 != 0 else "menunggu",
                "catatan_verifikasi": "", "verified_by": "Administrator E-SPAK" if i % 4 != 0 else "",
                "verified_at": now_iso() if i % 4 != 0 else "", "created_at": now_iso(),
            })
