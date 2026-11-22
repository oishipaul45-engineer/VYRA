"""VYRA Persistence V2 isolated tests; no real accounts or data are accessed."""
import os
import sys
import tempfile
from pathlib import Path

from pydantic import ValidationError
from fastapi import HTTPException

with tempfile.TemporaryDirectory(prefix="vyra-persistence-test-") as temp:
    os.environ["VYRA_DB_PATH"] = str(Path(temp) / "isolated.sqlite3")
    os.environ["VYRA_JWT_SECRET"] = "isolated-test-secret-only-never-use-in-production-1234567890"
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import app as api

    if api.DB_PATH != Path(os.environ["VYRA_DB_PATH"]):
        raise RuntimeError("Refusing to run: test database isolation failed")

    with api.connect() as db:
        db.execute("INSERT INTO users (id, name, email, password_hash) VALUES (1, 'A', 'a@example.test', 'test')")
        db.execute("INSERT INTO users (id, name, email, password_hash) VALUES (2, 'B', 'b@example.test', 'test')")
        db.commit()
    user_a = {"id": 1}
    user_b = {"id": 2}
    initial = {
        "name": "Test", "reducedMotion": False, "hideAmounts": False,
        "transactions": [{"id": "tx-1", "name": "Demo", "category": "Other", "amount": -10, "date": "2026-11-22"}],
        "vaults": [{"id": "v-1", "name": "Savings", "goal": 100, "saved": 20, "icon": "V"}],
        "circles": []
    }
    state = api.WorkspaceState.model_validate(initial)
    result = api.initialize_workspace(body=state, user=user_a)
    assert result["version"] == 1
    assert api.get_workspace(user=user_a)["state"]["name"] == "Test"
    print("PASS: account workspace initialized")

    edited = dict(initial, name="Updated")
    result = api.save_workspace(body=api.WorkspaceWrite(version=1, state=edited), user=user_a)
    assert result["version"] == 2
    assert api.get_workspace(user=user_a)["state"]["name"] == "Updated"
    assert api.list_workspace_revisions(user=user_a)["revisions"][0]["version"] == 1
    assert api.get_workspace_revision(1, user=user_a)["state"]["name"] == "Test"
    print("PASS: atomic save and previous-version recovery")

    try:
        api.save_workspace(body=api.WorkspaceWrite(version=1, state=edited), user=user_a)
        raise AssertionError("Outdated version overwrote current workspace")
    except HTTPException as error:
        assert error.status_code == 409
    assert len(api.list_workspace_revisions(user=user_a)["revisions"]) == 1
    print("PASS: stale concurrent write rejected without a new snapshot")

    try:
        api.get_workspace_revision(1, user=user_b)
        raise AssertionError("Another account could read a snapshot")
    except HTTPException as error:
        assert error.status_code == 404
    assert not api.list_workspace_revisions(user=user_b)["revisions"]
    print("PASS: account isolation for version history")

    duplicate = dict(initial, transactions=initial["transactions"] * 2)
    try:
        api.WorkspaceState.model_validate(duplicate)
        raise AssertionError("Duplicate transaction IDs were accepted")
    except ValidationError:
        pass
    print("PASS: duplicate transaction IDs rejected")

    result = api.restore_workspace(body=api.WorkspaceRestore(version=2, revision_version=1), user=user_a)
    assert result["version"] == 3
    assert api.get_workspace(user=user_a)["state"]["name"] == "Test"
    assert [r["version"] for r in api.list_workspace_revisions(user=user_a)["revisions"]] == [2, 1]
    print("PASS: versioned restore retains the previously active version")

    print("PASS: persistence V2 isolated tests completed")

    # sqlite3.Connection context managers commit/rollback but do not close.
    # Close module-level connection(s) before Windows removes the temporary DB.
    db.close()
    if hasattr(api, "db"):
        api.db.close()
    import gc
    gc.collect()