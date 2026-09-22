"""E-SPAK iteration 4: leave config (Konfigurasi Cuti) + BLUD-only visibility for Cuti Pegawai."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def H(t): return {"Authorization": f"Bearer {t}"}


def _login(s, identifier, password):
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, f"Login {identifier}: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def s(): return requests.Session()


@pytest.fixture(scope="module")
def admin(s): return _login(s, "laporanpalaran", "Palaran2024!")


@pytest.fixture(scope="module")
def blud(s): return _login(s, "pegawai1", "pegawai123")  # BLUD


@pytest.fixture(scope="module")
def asn(s): return _login(s, "pegawai3", "pegawai123")  # ASN


class TestLeaveConfig:
    def test_get_config_defaults(self, s, admin):
        tok, _ = admin
        r = s.get(f"{API}/leave/config", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert "default_saldo_n" in d and "default_saldo_bersama" in d
        assert isinstance(d["jenis_cuti"], list) and len(d["jenis_cuti"]) >= 1
        assert "tahun" in d

    def test_put_and_persist_config(self, s, admin):
        tok, _ = admin
        payload = {"default_saldo_n": 12, "default_saldo_bersama": 3,
                   "jenis_cuti": ["Tahunan", "Sakit", "Melahirkan"],
                   "tahun": date.today().year}
        r = s.put(f"{API}/leave/config", headers=H(tok), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["default_saldo_n"] == 12
        assert d["default_saldo_bersama"] == 3
        assert "Melahirkan" in d["jenis_cuti"]

        # verify by GET
        d2 = s.get(f"{API}/leave/config", headers=H(tok)).json()
        assert d2["default_saldo_bersama"] == 3
        assert "Melahirkan" in d2["jenis_cuti"]

    def test_non_admin_cannot_put(self, s, blud):
        tok, _ = blud
        r = s.put(f"{API}/leave/config", headers=H(tok),
                  json={"default_saldo_n": 999, "default_saldo_bersama": 0,
                        "jenis_cuti": ["X"], "tahun": 2026})
        assert r.status_code in (401, 403)

    def test_apply_defaults_to_blud(self, s, admin):
        tok, _ = admin
        r = s.post(f"{API}/leave/config/apply", headers=H(tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert isinstance(d.get("updated"), int) and d["updated"] >= 1

        # Verify a BLUD user's balance now has saldo_bersama=3, saldo_n=12
        users = s.get(f"{API}/users", headers=H(tok)).json()
        blud_user = next(u for u in users if u.get("username") == "pegawai1")
        balances = s.get(f"{API}/leave/balances", headers=H(tok)).json()
        b = next(x for x in balances if x["employee_id"] == blud_user["id"])
        assert b["saldo_bersama"] == 3
        assert b["saldo_n"] == 12

    def test_apply_non_admin_forbidden(self, s, blud):
        tok, _ = blud
        r = s.post(f"{API}/leave/config/apply", headers=H(tok))
        assert r.status_code in (401, 403)


class TestJenisValidationAndBLUDOnly:
    def test_create_leave_with_new_jenis(self, s, blud, admin):
        tok, u = blud
        atok, _ = admin
        start = (date.today() + timedelta(days=200)).isoformat()
        end = (date.today() + timedelta(days=200)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(tok), json={
            "jenis": "Melahirkan", "tanggal_mulai": start, "tanggal_selesai": end,
            "alasan": "TEST_config_jenis", "alamat": "Palaran"
        })
        assert r.status_code in (200, 201), r.text
        lid = r.json()["id"]
        s.delete(f"{API}/leaves/{lid}", headers=H(atok))

    def test_create_leave_with_invalid_jenis(self, s, blud):
        tok, _ = blud
        start = (date.today() + timedelta(days=201)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(tok), json={
            "jenis": "TidakAda", "tanggal_mulai": start, "tanggal_selesai": start,
            "alasan": "x", "alamat": "x"
        })
        assert r.status_code == 400

    def test_balances_only_blud(self, s, admin):
        tok, _ = admin
        rows = s.get(f"{API}/leave/balances", headers=H(tok)).json()
        # every row must be BLUD (is_blud True or tipe_pegawai=BLUD)
        for b in rows:
            assert b.get("is_blud") is True or b.get("tipe_pegawai") == "BLUD", f"non-BLUD in balances: {b}"

    def test_asn_login_ok(self, s, asn):
        # ASN user can login; leave endpoints should still be reachable but menu-restricted at UI
        tok, u = asn
        assert u.get("tipe_pegawai") == "ASN" or u.get("is_blud") is False


class TestRestoreDefaults:
    def test_restore(self, s, admin):
        tok, _ = admin
        r = s.put(f"{API}/leave/config", headers=H(tok), json={
            "default_saldo_n": 12, "default_saldo_bersama": 0,
            "jenis_cuti": ["Tahunan", "Sakit"], "tahun": date.today().year
        })
        assert r.status_code == 200
        d = r.json()
        assert d["default_saldo_bersama"] == 0
        assert d["jenis_cuti"] == ["Tahunan", "Sakit"]
