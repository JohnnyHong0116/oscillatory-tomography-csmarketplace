"""Persistent local experiment library, shared by every frontend origin.

SQLite transactions keep experiment metadata and the complete session together.
The database lives in the user's home directory so builds and checkouts can be
replaced without moving saved experiments.
"""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
from time import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/v1/library", tags=["Experiment library"])


def library_path() -> Path:
    configured = os.environ.get("AQUIFER_LIBRARY_PATH")
    return Path(configured).expanduser() if configured else Path.home() / ".aquifer-imaging-studio" / "experiments.sqlite3"


@contextmanager
def database():
    path = library_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS experiments (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL,
                tags TEXT NOT NULL, favorite INTEGER NOT NULL, updated INTEGER NOT NULL,
                dimension INTEGER NOT NULL, wells INTEGER NOT NULL, tests INTEGER NOT NULL,
                has_results INTEGER NOT NULL, session TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS browser_imports (
                kind TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (kind, id)
            );
        """)
        with connection:
            yield connection
    finally:
        connection.close()


class LibraryModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Folder(LibraryModel):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)


class ExperimentDetails(LibraryModel):
    name: str = Field(min_length=1, max_length=500)
    folderId: str = Field(default="", max_length=200)
    tags: list[str] = Field(default_factory=list, max_length=100)


class SavedDetails(ExperimentDetails):
    id: str = Field(min_length=1, max_length=200)
    favorite: bool = False


class ExperimentSave(LibraryModel):
    details: SavedDetails
    session: dict[str, Any]


class Favorite(LibraryModel):
    favorite: bool


class BrowserImport(LibraryModel):
    folders: list[Folder]
    experiments: list[ExperimentSave]


def entry(row: sqlite3.Row) -> dict:
    return dict(id=row["id"], name=row["name"], folderId=row["folder"],
                tags=json.loads(row["tags"]), favorite=bool(row["favorite"]),
                updatedAt=row["updated"], dimension=row["dimension"],
                wellCount=row["wells"], testCount=row["tests"],
                hasResults=bool(row["has_results"]))


def existing_folder(connection, folder_id: str) -> str:
    return folder_id if connection.execute("SELECT 1 FROM folders WHERE id=?", (folder_id,)).fetchone() else ""


def save_experiment(connection, saved: ExperimentSave, *, replace: bool):
    details = saved.details
    session = {**saved.session, "name": details.name}
    config = session.get("config")
    if not isinstance(config, dict) or not isinstance(config.get("wells"), list) or not isinstance(config.get("tests"), list):
        raise HTTPException(422, "The experiment must include its well and test configuration.")
    values = (details.id, details.name, existing_folder(connection, details.folderId),
              json.dumps(details.tags), int(details.favorite), int(time() * 1000),
              config.get("dimension") or 2, len(config["wells"]), len(config["tests"]),
              int(session.get("result") is not None),
              json.dumps(session, ensure_ascii=False, allow_nan=False))
    action = "REPLACE" if replace else "IGNORE"
    connection.execute(f"INSERT OR {action} INTO experiments VALUES (?,?,?,?,?,?,?,?,?,?,?)", values)


@router.get("")
def list_library():
    with database() as connection:
        return {
            "folders": [dict(row) for row in connection.execute("SELECT id,name FROM folders ORDER BY name")],
            "entries": [entry(row) for row in connection.execute(
                "SELECT id,name,folder,tags,favorite,updated,dimension,wells,tests,has_results "
                "FROM experiments ORDER BY updated DESC"
            )],
        }


@router.get("/browser-imports")
def browser_imports():
    with database() as connection:
        rows = connection.execute("SELECT kind,id FROM browser_imports").fetchall()
        return {
            "folders": [row["id"] for row in rows if row["kind"] == "folder"],
            "experiments": [row["id"] for row in rows if row["kind"] == "experiment"],
        }


@router.post("/folders")
def save_folder(folder: Folder):
    with database() as connection:
        connection.execute("INSERT OR REPLACE INTO folders VALUES (?,?)", (folder.id, folder.name))
    return {"saved": True}


@router.post("/folders/{folder_id}/remove")
def remove_folder(folder_id: str):
    with database() as connection:
        connection.execute("UPDATE experiments SET folder='' WHERE folder=?", (folder_id,))
        connection.execute("DELETE FROM folders WHERE id=?", (folder_id,))
    return {"removed": True}


@router.post("/experiments")
def store_experiment(saved: ExperimentSave):
    with database() as connection:
        save_experiment(connection, saved, replace=True)
    return {"saved": True}


@router.get("/experiments/{experiment_id}")
def read_experiment(experiment_id: str):
    with database() as connection:
        row = connection.execute("SELECT name,session FROM experiments WHERE id=?", (experiment_id,)).fetchone()
        if not row:
            raise HTTPException(404, "The saved experiment was not found.")
        return {**json.loads(row["session"]), "name": row["name"]}


@router.post("/experiments/{experiment_id}/organize")
def organize_experiment(experiment_id: str, changes: ExperimentDetails):
    with database() as connection:
        cursor = connection.execute(
            "UPDATE experiments SET name=?,folder=?,tags=?,updated=? WHERE id=?",
            (changes.name, existing_folder(connection, changes.folderId), json.dumps(changes.tags),
             int(time() * 1000), experiment_id),
        )
        if not cursor.rowcount:
            raise HTTPException(404, "The saved experiment was not found.")
    return {"saved": True}


@router.post("/experiments/{experiment_id}/favorite")
def favorite_experiment(experiment_id: str, changes: Favorite):
    with database() as connection:
        cursor = connection.execute("UPDATE experiments SET favorite=? WHERE id=?", (int(changes.favorite), experiment_id))
        if not cursor.rowcount:
            raise HTTPException(404, "The saved experiment was not found.")
    return {"saved": True}


@router.post("/experiments/{experiment_id}/remove")
def remove_experiment(experiment_id: str):
    with database() as connection:
        connection.execute("DELETE FROM experiments WHERE id=?", (experiment_id,))
    return {"removed": True}


@router.post("/import-browser")
def import_browser(saved: BrowserImport):
    # Track imported IDs, including those already on disk. Reopening an old
    # browser must not resurrect items subsequently removed from the library.
    with database() as connection:
        for folder in saved.folders:
            imported = connection.execute("INSERT OR IGNORE INTO browser_imports VALUES ('folder',?)", (folder.id,))
            if imported.rowcount:
                connection.execute("INSERT OR IGNORE INTO folders VALUES (?,?)", (folder.id, folder.name))
        for experiment in saved.experiments:
            imported = connection.execute("INSERT OR IGNORE INTO browser_imports VALUES ('experiment',?)", (experiment.details.id,))
            if imported.rowcount:
                save_experiment(connection, experiment, replace=False)
    return {"saved": True}
