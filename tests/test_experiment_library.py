"""Regression checks for durable saves and non-destructive browser migration."""
import json
import os
import subprocess
import sys

from fastapi.testclient import TestClient
import pytest

from oscillatory_tomography.api import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AQUIFER_LIBRARY_PATH", str(tmp_path / "library.sqlite3"))
    with TestClient(app) as client:
        yield client


def saved(identifier="test-1", name="Field study", folder="folder-1"):
    return {
        "details": {"id": identifier, "name": name, "folderId": folder,
                    "favorite": True, "tags": ["calibration"]},
        "session": {
            "name": name, "step": 5, "selectedTestId": "t1",
            "config": {"dimension": 3, "wells": [{"id": "w1", "z": -20}], "tests": [{"id": "t1"}]},
            "runInput": {"csv": "exact,observation\n1,1.23456789012345"},
            "forwardSource": {"config": {"gridNx": 8}, "result": {"pairs": []}},
            "result": {"volumeFields": {"fields": [[[1.2345678901234567]]]}}
        },
    }


def test_library_survives_a_separate_python_process_and_working_directory(client, tmp_path):
    assert client.post("/api/v1/library/folders", json={"id": "folder-1", "name": "Campaigns"}).status_code == 200
    payload = saved()
    assert client.post("/api/v1/library/experiments", json=payload).status_code == 200
    # A new process simulates restarting Uvicorn, with no shared Python memory.
    script = """
import json
from oscillatory_tomography.library import list_library, read_experiment
print(json.dumps({"library": list_library(), "session": read_experiment("test-1")}))
"""
    result = subprocess.run([sys.executable, "-c", script], cwd=tmp_path, env=os.environ.copy(),
                            text=True, capture_output=True, check=True)
    reopened = json.loads(result.stdout)
    assert reopened["library"]["folders"] == [{"id": "folder-1", "name": "Campaigns"}]
    assert reopened["library"]["entries"][0]["favorite"] is True
    assert reopened["library"]["entries"][0]["hasResults"] is True
    assert reopened["session"] == payload["session"]


def test_browser_migration_is_repeatable_and_preserves_newer_disk_saves(client):
    payload = {"folders": [{"id": "folder-1", "name": "Campaigns"}], "experiments": [saved()]}
    assert client.post("/api/v1/library/import-browser", json=payload).status_code == 200
    assert client.post("/api/v1/library/experiments", json=saved(name="Revised study")).status_code == 200
    assert client.post("/api/v1/library/import-browser", json=payload).status_code == 200
    data = client.get("/api/v1/library").json()
    assert client.get("/api/v1/library/browser-imports").json() == {
        "folders": ["folder-1"], "experiments": ["test-1"],
    }
    assert len(data["entries"]) == 1
    assert data["entries"][0]["name"] == "Revised study"
    assert client.get("/api/v1/library/experiments/test-1").json()["name"] == "Revised study"
    assert client.post("/api/v1/library/experiments/test-1/remove", json={}).status_code == 200
    assert client.post("/api/v1/library/import-browser", json=payload).status_code == 200
    assert client.get("/api/v1/library").json()["entries"] == []


def test_failed_import_rolls_back_folders_sessions_and_migration_markers(client):
    invalid = saved("bad")
    invalid["session"]["config"] = {}
    payload = {"folders": [{"id": "folder-1", "name": "Campaigns"}], "experiments": [saved(), invalid]}
    assert client.post("/api/v1/library/import-browser", json=payload).status_code == 422
    assert client.get("/api/v1/library").json() == {"folders": [], "entries": []}
    payload["experiments"] = [saved()]
    assert client.post("/api/v1/library/import-browser", json=payload).status_code == 200
    assert len(client.get("/api/v1/library").json()["entries"]) == 1


def test_rename_move_delete_folder_and_favorites_preserve_complete_session(client):
    client.post("/api/v1/library/folders", json={"id": "folder-1", "name": "Campaigns"})
    client.post("/api/v1/library/experiments", json=saved())
    response = client.post("/api/v1/library/experiments/test-1/organize",
                           json={"name": "Renamed", "folderId": "folder-1", "tags": ["new"]})
    assert response.status_code == 200
    client.post("/api/v1/library/experiments/test-1/favorite", json={"favorite": False})
    client.post("/api/v1/library/folders/folder-1/remove", json={})
    entry = client.get("/api/v1/library").json()["entries"][0]
    assert entry["folderId"] == ""
    assert entry["tags"] == ["new"]
    assert entry["favorite"] is False
    session = client.get("/api/v1/library/experiments/test-1").json()
    assert session["name"] == "Renamed"
    assert session["result"] == saved()["session"]["result"]
    assert client.get("/api/v1/library/experiments/missing").status_code == 404
    client.post("/api/v1/library/import-browser", json={"folders": [{"id": "folder-1", "name": "Old"}], "experiments": [saved()]})
    client.post("/api/v1/library/folders/folder-1/remove", json={})
    client.post("/api/v1/library/import-browser", json={"folders": [{"id": "folder-1", "name": "Old"}], "experiments": [saved()]})
    assert client.get("/api/v1/library").json()["folders"] == []
