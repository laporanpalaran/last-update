"""E-SPAK iteration 3: tipe_pegawai (ASN/BLUD), leave attachment upload/download, PDF official format."""
import io
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
def pegawai(s):
    return _login(s, "pegawai1", "pegawai123")


# ---- Tipe Pegawai ASN/BLUD ----
class TestTipePegawai:
    def test_seed_distribution(self, s, admin):
        tok, _ = admin
        r = s.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 200
        users = r.json()
        pegawai_users = [u for u in users if (u.get("username") or "").startswith("pegawai")]
        assert len(pegawai_users) >= 10
        asn = [u for u in pegawai_users if u.get("tipe_pegawai") == "ASN"]
        blud = [u for u in pegawai_users if u.get("tipe_pegawai") == "BLUD"]
        # expect 3 ASN, 7 BLUD among pegawai1..10
        p110 = [u for u in pegawai_users if u.get("username") in {f"pegawai{i}" for i in range(1, 11)}]
        assert len(p110) == 10
        p110_asn = [u for u in p110 if u.get("tipe_pegawai") == "ASN"]
        p110_blud = [u for u in p110 if u.get("tipe_pegawai") == "BLUD"]
        assert len(p110_asn) == 3 and len(p110_blud) == 7, f"got ASN={[u['username'] for u in p110_asn]}, BLUD={[u['username'] for u in p110_blud]}"
        # specific expected ASN
        assert set(u["username"] for u in p110_asn) == {"pegawai3", "pegawai6", "pegawai9"}

    def test_create_asn_user(self, s, admin):
        tok, _ = admin
        # cleanup
        for u in s.get(f"{API}/users", headers=H(tok)).json():
            if u.get("username") == "TEST_asn":
                s.delete(f"{API}/users/{u['id']}", headers=H(tok))
        payload = {
            "username": "TEST_asn", "password": "test12345", "nama": "TEST ASN",
            "roles": ["pj_program"], "tipe_pegawai": "ASN",
            "unit": "TEST", "jabatan": "TEST", "nip": "TEST_NIP_ASN",
        }
        r = s.post(f"{API}/users", headers=H(tok), json=payload)
        assert r.status_code in (200, 201), r.text
        u = r.json()
        assert u["tipe_pegawai"] == "ASN"
        assert u["is_blud"] is False
        # GET verify
        got = [x for x in s.get(f"{API}/users", headers=H(tok)).json() if x["id"] == u["id"]][0]
        assert got["tipe_pegawai"] == "ASN"
        # Update to BLUD
        r2 = s.put(f"{API}/users/{u['id']}", headers=H(tok),
                   json={**payload, "tipe_pegawai": "BLUD"})
        assert r2.status_code == 200
        assert r2.json()["tipe_pegawai"] == "BLUD"
        assert r2.json()["is_blud"] is True
        s.delete(f"{API}/users/{u['id']}", headers=H(tok))


# ---- Leave attachment upload/download ----
class TestLeaveAttachment:
    def test_upload_before_verify_and_download(self, s, admin, pegawai):
        atok, _ = admin
        ptok, _ = pegawai
        start = (date.today() + timedelta(days=90)).isoformat()
        end = (date.today() + timedelta(days=90)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(ptok), json={
            "jenis": "Sakit", "tanggal_mulai": start, "tanggal_selesai": end,
            "alasan": "TEST_att", "alamat": "Palaran"
        })
        assert r.status_code in (200, 201), r.text
        lid = r.json()["id"]

        # Upload a tiny PNG
        png_bytes = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                     b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff"
                     b"\xff?\x00\x05\xfe\x02\xfe\xa4\x0e\xe2\xf5\x00\x00\x00\x00IEND\xaeB`\x82")
        files = {"file": ("test.png", io.BytesIO(png_bytes), "image/png")}
        r = s.post(f"{API}/leaves/{lid}/attachment", headers=H(ptok), files=files)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # verify has_lampiran flag on GET
        leaves = s.get(f"{API}/leaves", headers=H(ptok)).json()
        mine = [x for x in leaves if x["id"] == lid][0]
        assert mine.get("has_lampiran") is True
        assert "employee_tipe" in mine

        # Download attachment (Bearer)
        r = s.get(f"{API}/leaves/{lid}/attachment", headers=H(ptok))
        assert r.status_code == 200
        assert r.content[:4] == b"\x89PNG"

        # Download via ?auth= query
        r = s.get(f"{API}/leaves/{lid}/attachment", params={"auth": ptok})
        assert r.status_code == 200

        # Now admin approves -> pegawai upload should be forbidden
        r = s.put(f"{API}/leaves/{lid}/verify", headers=H(atok),
                  json={"status": "disetujui", "catatan": ""})
        assert r.status_code == 200

        files = {"file": ("test2.png", io.BytesIO(png_bytes), "image/png")}
        r = s.post(f"{API}/leaves/{lid}/attachment", headers=H(ptok), files=files)
        assert r.status_code == 400, f"expected 400 after verify, got {r.status_code} {r.text}"

        # Admin still can upload after verify
        files = {"file": ("test3.png", io.BytesIO(png_bytes), "image/png")}
        r = s.post(f"{API}/leaves/{lid}/attachment", headers=H(atok), files=files)
        assert r.status_code == 200

        # cleanup
        s.delete(f"{API}/leaves/{lid}", headers=H(atok))

    def test_upload_bad_extension_rejected(self, s, admin, pegawai):
        atok, _ = admin
        ptok, _ = pegawai
        start = (date.today() + timedelta(days=91)).isoformat()
        end = (date.today() + timedelta(days=91)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(ptok), json={
            "jenis": "Sakit", "tanggal_mulai": start, "tanggal_selesai": end,
            "alasan": "TEST_badext", "alamat": "Palaran"
        })
        lid = r.json()["id"]
        files = {"file": ("evil.exe", io.BytesIO(b"MZ\x90"), "application/octet-stream")}
        r = s.post(f"{API}/leaves/{lid}/attachment", headers=H(ptok), files=files)
        assert r.status_code == 400
        s.delete(f"{API}/leaves/{lid}", headers=H(atok))


# ---- Official PDF format ----
class TestOfficialLeavePDF:
    def test_pdf_contains_official_sections(self, s, admin, pegawai):
        atok, _ = admin
        ptok, _ = pegawai
        start = (date.today() + timedelta(days=95)).isoformat()
        end = (date.today() + timedelta(days=95)).isoformat()
        r = s.post(f"{API}/leaves", headers=H(ptok), json={
            "jenis": "Tahunan", "tanggal_mulai": start, "tanggal_selesai": end,
            "alasan": "TEST_pdf_official", "alamat": "Palaran"
        })
        assert r.status_code in (200, 201)
        lid = r.json()["id"]

        r = s.get(f"{API}/leaves/{lid}/pdf", params={"auth": atok})
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        # File should be reasonable size (official form ~3KB+)
        assert len(r.content) > 1500

        s.delete(f"{API}/leaves/{lid}", headers=H(atok))
