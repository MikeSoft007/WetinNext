import base64
import io
import zipfile

ADMIN = {"X-Admin-Key": "test-admin-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
TEXT = "Education\nUniversity student\nSkills\nPython, SQL, Excel\nProjects\nBuilt a data tracker for 100 records. Experience\nHelped a student team analyse survey data."


def upload(text=TEXT, filename="cv.txt"):
    return {
        "filename": filename,
        "content_base64": base64.b64encode(text.encode()).decode(),
        "goal": "Data internship",
        "opportunity_id": "sample-data",
    }


def test_admin_gate_publication_archive_and_audit(clients):
    a, b, _, _ = clients
    assert a.get("/api/v1/admin/learners").status_code == 403
    assert (
        a.get(
            "/api/v1/admin/content/resources", headers={"X-Admin-Key": "bad"}
        ).status_code
        == 403
    )
    item = {
        "title": "Draft guide",
        "provider": "Example",
        "url": "https://example.com/guide",
        "format": "text",
        "device": "phone",
        "cost": "free",
        "review": "pending",
    }
    path = "/api/v1/admin/content/resources/test-guide"
    assert (
        a.put(path, headers=ADMIN, json={"status": "draft", "data": item}).status_code
        == 200
    )
    assert not any(x["id"] == "test-guide" for x in b.get("/api/v1/resources").json())
    assert (
        a.put(
            path, headers=ADMIN, json={"status": "published", "data": item}
        ).status_code
        == 200
    )
    assert any(x["id"] == "test-guide" for x in b.get("/api/v1/resources").json())
    assert (
        a.put(
            path, headers=ADMIN, json={"status": "archived", "data": item}
        ).status_code
        == 200
    )
    assert not any(x["id"] == "test-guide" for x in b.get("/api/v1/resources").json())
    assert len(a.get("/api/v1/admin/audit", headers=ADMIN).json()) == 3
    assert a.get("/api/v1/admin/learners", headers=ADMIN).status_code == 200


def test_live_validation(clients):
    a, _, _, _ = clients
    data = {
        "title": "Role",
        "organisation": "Org",
        "type": "Job",
        "country": "Nigeria",
        "skills": ["SQL"],
        "description": "Role",
        "mandatory": "Requirements",
        "sample": False,
        "url": None,
        "deadline": None,
    }
    path = "/api/v1/admin/content/opportunities/real-role"
    assert (
        a.put(
            path, headers=ADMIN, json={"status": "published", "data": data}
        ).status_code
        == 422
    )
    data.update(url="javascript:alert(1)", deadline="2026-12-30")
    assert (
        a.put(
            path, headers=ADMIN, json={"status": "published", "data": data}
        ).status_code
        == 422
    )


def test_cv_ownership_guidance_and_delete(clients):
    a, b, _, _ = clients
    result = a.post("/api/v1/me/cv-reviews", json=upload())
    assert result.status_code == 200, result.text
    review = result.json()
    assert "Python" in review["skills"] and "SQL" in review["skills"]
    assert review["actions"] and review["engine"] == "explainable text checks"
    assert b.get("/api/v1/me/cv-reviews").json() == []
    assert b.delete("/api/v1/me/cv-reviews/" + review["id"]).status_code == 404
    assert a.delete("/api/v1/me/cv-reviews/" + review["id"]).status_code == 200
    assert a.get("/api/v1/me/cv-reviews").json() == []


def test_bad_documents_and_account_erasure(clients):
    a, _, _, _ = clients
    assert a.post("/api/v1/me/cv-reviews", json=upload("too short")).status_code == 422
    assert (
        a.post("/api/v1/me/cv-reviews", json=upload(TEXT, "cv.exe")).status_code == 422
    )
    assert (
        a.post("/api/v1/me/cv-reviews", json=upload(TEXT, "cv.pdf")).status_code == 422
    )
    assert a.post("/api/v1/me/cv-reviews", json=upload()).status_code == 200
    assert a.delete("/api/v1/me").status_code == 200
    a.post("/api/v1/demo/session")
    assert a.get("/api/v1/me/cv-reviews").json() == []


def test_docx_extraction():
    from app.services.learners.cv import extract

    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr(
            "word/document.xml",
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>'
            + TEXT
            + "</w:t></w:r></w:p></w:document>",
        )
    assert "Python" in extract("cv.docx", base64.b64encode(data.getvalue()).decode())


def test_pdf_text_extraction():
    from app.services.learners.cv import extract

    stream = b"BT /F1 12 Tf 50 750 Td (Education University student. Skills Python SQL Excel. Projects Built a tracker with 100 records. Experience Volunteered with a student team.) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(stream)).encode()
        + b" >>\nstream\n"
        + stream
        + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    xref = len(pdf)
    pdf += (
        b"xref\n0 6\n0000000000 65535 f \n"
        + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
        + b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"
        + str(xref).encode()
        + b"\n%%EOF"
    )
    assert "Python SQL Excel" in extract("cv.pdf", base64.b64encode(pdf).decode())
