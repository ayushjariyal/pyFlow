"""API integration tests (Celery eager mode -> jobs run inline).

Because tasks run synchronously here, a job is already SUCCESS by the time the
upload returns, so we can assert on the final result immediately.
"""

CSV = "id,name,age\n1, Alice ,30\n2,Bob,\n2,Bob,\n3,Carol,41\n"


def _upload(client, job_type: str, options: str = "{}", csv: str = CSV):
    return client.post(
        "/jobs/upload",
        data={"job_type": job_type, "options": options},
        files={"file": ("data.csv", csv, "text/csv")},
    )


def test_upload_csv_analysis_runs_to_success(client):
    resp = _upload(client, "CSV_ANALYSIS")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["job_type"] == "CSV_ANALYSIS"
    assert body["input_file_path"].startswith("uploads/")
    assert body["celery_task_id"]

    job = client.get(f"/jobs/{body['id']}").json()
    assert job["status"] == "SUCCESS"
    assert job["result"]["row_count"] == 4
    assert job["execution_time"] is not None


def test_data_cleaning_produces_downloadable_output(client):
    resp = _upload(client, "DATA_CLEANING")
    job = client.get(f"/jobs/{resp.json()['id']}").json()
    assert job["status"] == "SUCCESS"
    assert job["result"]["duplicates_removed"] == 1
    assert job["output_file_path"]

    dl = client.get(f"/jobs/{job['id']}/download")
    assert dl.status_code == 200
    assert "Alice" in dl.text  # cleaned CSV content


def test_file_conversion_xlsx(client):
    resp = _upload(client, "FILE_CONVERSION", options='{"output_format": "xlsx"}')
    job = client.get(f"/jobs/{resp.json()['id']}").json()
    assert job["status"] == "SUCCESS"
    assert job["output_file_path"].endswith(".xlsx")
    assert client.get(f"/jobs/{job['id']}/download").status_code == 200


def test_profile_report_html(client):
    resp = _upload(client, "DATA_PROFILE_REPORT")
    job = client.get(f"/jobs/{resp.json()['id']}").json()
    assert job["status"] == "SUCCESS"
    assert job["output_file_path"].endswith(".html")


def test_bulk_validation(client):
    resp = _upload(
        client,
        "BULK_DATA_VALIDATION",
        options='{"required_columns": ["id", "name"], "id_column": "id"}',
    )
    job = client.get(f"/jobs/{resp.json()['id']}").json()
    assert job["status"] == "SUCCESS"
    assert job["result"]["valid"] is False
    assert job["result"]["duplicate_id_count"] == 1


def test_invalid_options_returns_400(client):
    resp = _upload(client, "FILE_CONVERSION", options='{"output_format": "pdf"}')
    assert resp.status_code == 400
    assert "errors" in resp.json()


def test_empty_file_returns_400(client):
    resp = _upload(client, "CSV_ANALYSIS", csv="")
    assert resp.status_code == 400


def test_invalid_csv_marks_job_failed(client):
    # An unterminated quoted field makes pandas' parser raise -> worker FAILED.
    bad_csv = 'a,b\n"x,1\n'
    resp = _upload(client, "CSV_ANALYSIS", csv=bad_csv)
    assert resp.status_code == 201  # upload accepted (file is non-empty)
    job = client.get(f"/jobs/{resp.json()['id']}").json()
    assert job["status"] == "FAILED"  # parsing fails in the worker
    assert "error" in (job["result"] or {})


def test_download_missing_when_no_output(client):
    resp = _upload(client, "CSV_ANALYSIS")  # analysis has no output file
    job_id = resp.json()["id"]
    assert client.get(f"/jobs/{job_id}/download").status_code == 404


def test_unknown_job_404(client):
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/jobs/{missing}").status_code == 404
    assert client.get(f"/jobs/{missing}/download").status_code == 404
    assert client.post(f"/jobs/{missing}/retry").status_code == 404
