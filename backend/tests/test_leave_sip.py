"""Backend tests for multi-role users, Cuti (Leave), and SIP features (E-SPAK 2026)."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def _login(s, identifier, password):
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, f"Login {identifier} failed: {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin(s):
    return _login(s, "admin", "admin123")


@pytest.fixture(scope="module")
def kepala(s):
    return _login(s, "kepala", "kepala123")


@pytest.fixture(scope="module")
def pegawai(s):
    return _login(s, "pegawai1", "pegawai123")


# ---------------- Multi-role users ----------------
class TestMultiRoleUsers:
    def test_create_multi_role_and_blud(self, s, admin):
        tok, _ = admin
        payload = {
            "username": "TEST_multiuser",
            "password": "test12345",
            "nama": "TEST Multi Role",
            "roles": ["admin", "pj_program"],
            "is_blud": True,
            "unit": "TEST",
            "jabatan": "TEST",
            "nip": "TEST_NIP_MULTI",
        }
        # cleanup any leftovers
        existing = s.get(f"{API}/users", headers=H(tok)).json()
        for u in existing:
            if u.get("username") == "TEST_multiuser":
                s.delete(f"{API}/users/{u['id']}", headers=H(tok))

        r = s.post(f"{API}/users", headers=H(tok), json=payload)
        assert r.status_code in (200, 201), r.text
        u = r.json()
        assert set(u.get("roles") or []) == {"admin", "pj_program"}
        assert u.get("is_blud") is True
        uid = u["id"]

        # Login as new user works
        rl = s.post(f"{API}/auth/login", json={"identifier": "TEST_multiuser", "password": "test12345"})
        assert rl.status_code == 200
        user = rl.json()["user"]
        assert set(user.get("roles") or []) == {"admin", "pj_program"}

        # Update roles
        r2 = s.put(f"{API}/users/{uid}", headers=H(tok), json={**payload, "roles": ["kepala"]})
        assert r2.status_code == 200
        assert set(r2.json().get("roles") or []) == {"kepala"}

        s.delete(f"{API}/users/{uid}", headers=H(tok))


# ---------------- Leave: balances, submit, priority deduction, cancel restore ----------------
class TestLeaveFlow:
    def test_balances_endpoint(self, s, admin):
        tok, _ = admin
        r = s.get(f"{API}/leave/balances", headers=H(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1

    def test_my_balance(self, s, pegawai):
        tok, _ = pegawai
        r = s.get(f"{API}/leave/my-balance", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("saldo_n", "saldo_n1", "saldo_n2", "saldo_bersama"):
            assert k in d

    def test_priority_deduction_and_cancel_restore(self, s, admin, pegawai):
        atok, _ = admin
        ptok, puser = pegawai
        emp_id = puser["id"]

        # Set known balances: bersama=3, n2=5, n1=5, n=5
        r = s.put(f"{API}/leave/balances/{emp_id}", headers=H(atok),
                  json={"saldo_bersama": 3, "saldo_n2": 5, "saldo_n1": 5, "saldo_n": 5})
        assert r.status_code == 200

        # Submit 3-day Tahunan leave
        start = (date.today() + timedelta(days=30)).isoformat()
        end = (date.today() + timedelta(days=32)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(ptok), json={
            "jenis": "Tahunan", "tanggal_mulai": start, "tanggal_selesai": end,
            "alasan": "TEST_priority", "alamat": "Palaran"
        })
        assert r.status_code in (200, 201), r.text
        leave = r.json()
        assert leave["jumlah_hari"] == 3
        lid = leave["id"]

        # Approve as admin
        r = s.put(f"{API}/leaves/{lid}/verify", headers=H(atok),
                  json={"status": "disetujui", "catatan": "ok"})
        assert r.status_code == 200

        # Bersama should decrement to 0 first
        r = s.get(f"{API}/leave/my-balance", headers=H(ptok))
        d = r.json()
        assert d["saldo_bersama"] == 0, f"Bersama should be 0, got {d}"
        assert d["saldo_n2"] == 5 and d["saldo_n1"] == 5 and d["saldo_n"] == 5

        # Cancel and restore
        r = s.put(f"{API}/leaves/{lid}/cancel", headers=H(atok))
        assert r.status_code == 200
        r = s.get(f"{API}/leave/my-balance", headers=H(ptok))
        d = r.json()
        assert d["saldo_bersama"] == 3, f"Bersama should be restored to 3, got {d}"

        # Cleanup
        s.delete(f"{API}/leaves/{lid}", headers=H(atok))

    def test_pdf_generation(self, s, admin, pegawai):
        atok, _ = admin
        ptok, _ = pegawai
        # Submit a fresh leave
        start = (date.today() + timedelta(days=60)).isoformat()
        end = (date.today() + timedelta(days=60)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(ptok), json={
            "jenis": "Sakit", "tanggal_mulai": start, "tanggal_selesai": end,
            "alasan": "TEST_pdf", "alamat": "Palaran"
        })
        assert r.status_code in (200, 201)
        lid = r.json()["id"]

        r = s.get(f"{API}/leaves/{lid}/pdf", params={"auth": atok})
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        s.delete(f"{API}/leaves/{lid}", headers=H(atok))


# ---------------- SIP feature ----------------
class TestSIP:
    def test_dashboard_admin(self, s, admin):
        tok, _ = admin
        r = s.get(f"{API}/sip/dashboard", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("summary", "per_profesi", "items"):
            assert k in d
        for k in ("total", "aktif", "akan_habis", "kadaluarsa", "menunggu"):
            assert k in d["summary"]

    def test_dashboard_kepala_ok(self, s, kepala):
        tok, _ = kepala
        r = s.get(f"{API}/sip/dashboard", headers=H(tok))
        assert r.status_code == 200

    def test_pegawai_cannot_access_dashboard(self, s, pegawai):
        tok, _ = pegawai
        r = s.get(f"{API}/sip/dashboard", headers=H(tok))
        assert r.status_code == 403

    def test_sip_submit_and_verify(self, s, admin, pegawai):
        atok, _ = admin
        ptok, _ = pegawai
        payload = {
            "nomor_sip": "TEST_SIP_001",
            "profesi": "Perawat",
            "tanggal_terbit": "2025-01-01",
            "tanggal_berakhir": (date.today() + timedelta(days=200)).isoformat(),
            "keterangan": "TEST"
        }
        r = s.post(f"{API}/sip", headers=H(ptok), json=payload)
        assert r.status_code in (200, 201), r.text
        sip = r.json()
        assert sip["status_verifikasi"] == "menunggu"
        sid = sip["id"]

        # Admin approves
        r = s.put(f"{API}/sip/{sid}/verify", headers=H(atok),
                  json={"status": "disetujui", "catatan": ""})
        assert r.status_code == 200
        # verify by GET
        got = s.get(f"{API}/sip", headers=H(atok)).json()
        assert any(x["id"] == sid and x["status_verifikasi"] == "disetujui" for x in got)

        # Cleanup
        s.delete(f"{API}/sip/{sid}", headers=H(atok))

    def test_kepala_cannot_verify_sip(self, s, kepala, pegawai):
        ktok, _ = kepala
        ptok, _ = pegawai
        # create a SIP first
        r = s.post(f"{API}/sip", headers=H(ptok), json={
            "nomor_sip": "TEST_SIP_KEP",
            "profesi": "Perawat",
            "tanggal_terbit": "2025-01-01",
            "tanggal_berakhir": (date.today() + timedelta(days=200)).isoformat(),
        })
        assert r.status_code in (200, 201)
        sid = r.json()["id"]
        r = s.put(f"{API}/sip/{sid}/verify", headers=H(ktok),
                  json={"status": "disetujui", "catatan": ""})
        assert r.status_code == 403
        # cleanup as pegawai owner
        s.delete(f"{API}/sip/{sid}", headers=H(ptok))
