"""Workflow API + scheduler integration tests (Celery eager -> DAG runs inline)."""

CSV = "id,name,age\n1,Alice,30\n2,Bob,40\n2,Bob,40\n"
BAD_CSV = 'a,b\n"x,1\n'  # unterminated quote -> pandas parse error


def _create(client, tasks, deps=None, name="wf"):
    return client.post(
        "/workflows",
        json={"name": name, "tasks": tasks, "dependencies": deps or []},
    )


def _run(client, wid, csv=CSV):
    return client.post(
        f"/workflows/{wid}/run", files={"file": ("d.csv", csv, "text/csv")}
    )


def test_create_linear_workflow(client):
    resp = _create(
        client,
        [
            {"id": "clean", "type": "DATA_CLEANING"},
            {"id": "profile", "type": "DATA_PROFILE_REPORT"},
        ],
        [{"from": "clean", "to": "profile"}],
    )
    assert resp.status_code == 201, resp.text
    wf = resp.json()
    assert wf["status"] == "PENDING"
    assert len(wf["tasks"]) == 2
    assert wf["dependencies"] == [{"from": "clean", "to": "profile"}]


def test_run_linear_pipeline_passes_output_downstream(client):
    wid = _create(
        client,
        [
            {"id": "clean", "type": "DATA_CLEANING"},
            {"id": "profile", "type": "DATA_PROFILE_REPORT"},
        ],
        [{"from": "clean", "to": "profile"}],
    ).json()["id"]

    body = _run(client, wid).json()
    assert body["status"] == "COMPLETED"
    statuses = {t["ref"]: t["status"] for t in body["tasks"]}
    assert statuses == {"clean": "SUCCESS", "profile": "SUCCESS"}

    tasks = {t["ref"]: t for t in body["tasks"]}
    # profile consumed clean's cleaned-CSV output and produced an HTML report.
    assert tasks["clean"]["output_file_path"].endswith("_cleaned.csv")
    assert tasks["profile"]["input_file_path"] == tasks["clean"]["output_file_path"]
    assert tasks["profile"]["output_file_path"].endswith(".html")


def test_independent_tasks_both_run(client):
    wid = _create(
        client,
        [
            {"id": "a", "type": "CSV_ANALYSIS"},
            {"id": "b", "type": "DATA_CLEANING"},
        ],
    ).json()["id"]

    body = _run(client, wid).json()
    assert body["status"] == "COMPLETED"
    assert all(t["status"] == "SUCCESS" for t in body["tasks"])


def test_cycle_rejected_400(client):
    resp = _create(
        client,
        [{"id": "a", "type": "CSV_ANALYSIS"}, {"id": "b", "type": "CSV_ANALYSIS"}],
        [{"from": "a", "to": "b"}, {"from": "b", "to": "a"}],
    )
    assert resp.status_code == 400


def test_invalid_task_options_400(client):
    resp = _create(
        client,
        [{"id": "c", "type": "FILE_CONVERSION", "payload": {"output_format": "pdf"}}],
    )
    assert resp.status_code == 400


def test_retry_then_fail(client):
    wid = _create(
        client, [{"id": "c", "type": "CSV_ANALYSIS", "max_retries": 1}]
    ).json()["id"]
    body = _run(client, wid, csv=BAD_CSV).json()
    assert body["status"] == "FAILED"
    task = body["tasks"][0]
    assert task["status"] == "FAILED"
    assert task["retry_count"] == 1  # retried once, then gave up


def test_failure_skips_downstream(client):
    wid = _create(
        client,
        [
            {"id": "bad", "type": "CSV_ANALYSIS"},
            {"id": "down", "type": "DATA_CLEANING"},
        ],
        [{"from": "bad", "to": "down"}],
    ).json()["id"]
    body = _run(client, wid, csv=BAD_CSV).json()
    assert body["status"] == "FAILED"
    statuses = {t["ref"]: t["status"] for t in body["tasks"]}
    assert statuses["bad"] == "FAILED"
    assert statuses["down"] == "SKIPPED"


def test_cancel_pending_workflow(client):
    wid = _create(client, [{"id": "a", "type": "CSV_ANALYSIS"}]).json()["id"]
    resp = client.post(f"/workflows/{wid}/cancel")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "CANCELLED"
    assert body["tasks"][0]["status"] == "SKIPPED"


def test_run_requires_file(client):
    wid = _create(client, [{"id": "a", "type": "CSV_ANALYSIS"}]).json()["id"]
    # No file attached -> 400 (workflow has no stored input).
    assert client.post(f"/workflows/{wid}/run").status_code == 400


def test_metrics_and_listing(client):
    wid = _create(client, [{"id": "a", "type": "CSV_ANALYSIS"}]).json()["id"]
    _run(client, wid)
    metrics = client.get("/workflows/metrics").json()
    assert metrics["completed"] >= 1
    assert 0.0 <= metrics["success_rate"] <= 1.0
    assert client.get("/workflows").status_code == 200
    assert client.get(f"/workflows/{wid}").status_code == 200
    assert (
        client.get("/workflows/00000000-0000-0000-0000-000000000000").status_code
        == 404
    )
