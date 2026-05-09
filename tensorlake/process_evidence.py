"""
Reference Tensorlake-style evidence processor for FieldReport AI.

The app runtime uses the TypeScript adapter in apps/web/lib/tensorlake.ts so the
localhost demo does not require external services. This file documents the same
stateful shape for swapping in a real Tensorlake workflow later.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict


def _empty_state(case_id: str) -> Dict[str, Any]:
    return {
        "caseId": case_id,
        "processedOrder": [],
        "timeline": [],
        "facts": {},
        "citations": {},
        "contradictions": [],
        "missingInfo": [],
    }


def _absolute_time(recording_start: str, offset_seconds: int) -> str:
    start = datetime.fromisoformat(recording_start.replace("Z", "+00:00"))
    return (start + timedelta(seconds=offset_seconds)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def process_evidence(case_id: str, evidence_type: str, data: Dict[str, Any], state: Dict[str, Any] | None = None) -> Dict[str, Any]:
    state = state or _empty_state(case_id)
    if evidence_type not in state["processedOrder"]:
        state["processedOrder"].append(evidence_type)

    if evidence_type == "bodycam":
        source_ref = data.get("source_ref", "bodycam")
        for item in data.get("transcript", []):
            ref = f"{source_ref}:{item['offset_seconds']}"
            state["citations"][ref] = f"{item['speaker']}: {item['text']}"
            state["timeline"].append(
                {
                    "time": _absolute_time(data["recording_start"], item["offset_seconds"]),
                    "title": item["speaker"],
                    "detail": item["text"],
                    "source": "bodycam",
                    "sourceRef": ref,
                }
            )
        state["facts"]["sfst"] = {"hgn": "6/6", "walkAndTurn": "4/8", "oneLegStand": "3/4"}
        state["facts"]["miranda"] = {
            "time": "0154 hours",
            "officer": "Officer J. Chen",
            "suspectResponse": "I understand and I want a lawyer.",
        }
        state["facts"]["alcoholStatement"] = "Driver said he came from Mike's place on 5th and had a couple drinks."

    if evidence_type == "dispatch":
        incident_id = data["incident_id"]
        ref = f"dispatch:{incident_id}"
        state["citations"][ref] = f"{data['call_type']} received at {data['received']} for {data['address']}"
        state["timeline"].append(
            {
                "time": data["received"],
                "title": "Dispatch received",
                "detail": f"{data['call_type']} at {data['address']}",
                "source": "dispatch",
                "sourceRef": ref,
            }
        )
        unit = data.get("units", [{}])[0]
        state["facts"]["dispatch"] = {
            "incidentId": incident_id,
            "callType": data["call_type"],
            "address": data["address"],
            "beat": data["beat"],
            "division": data["division"],
            "unit": unit.get("unit"),
            "officer": unit.get("officer"),
        }

    if evidence_type == "officer-notes":
        notes = data.get("notes", "")
        ref = data.get("source_ref", "notes:officer")
        state["citations"][ref] = notes
        state["facts"]["suspect"] = {"name": "David Kowalski", "dob": "1987-04-18", "dl": "CA D1234567"}
        state["facts"]["vehicle"] = {"year": "2021", "make": "Ford", "model": "Escape", "color": "white", "plate": "8XYZ321"}
        state["facts"]["property"] = {"tow": "Vehicle towed by Metro Towing.", "damageOwner": "Fence owner Marcus Williams, 782 Elm St."}

    state["timeline"] = sorted(state["timeline"], key=lambda entry: entry["time"])
    call_type = state.get("facts", {}).get("dispatch", {}).get("callType", "").lower()
    driver_at_scene = any("driver remained at the scene" in entry["detail"].lower() for entry in state["timeline"])
    state["contradictions"] = []
    if "hit and run" in call_type and driver_at_scene:
        state["contradictions"].append(
            {
                "type": "contradiction",
                "title": "Dispatch hit-and-run conflicts with driver-at-scene evidence",
                "detail": "Dispatch says hit-and-run/property damage, but bodycam shows the driver remained at the scene.",
                "evidenceRefs": ["dispatch:CAD-2025-0519-0087", "bodycam:BC-4821-2025-0519:410"],
            }
        )
    state["missingInfo"] = [
        {
            "type": "missing_info",
            "title": "Origin address and drink count need clarification",
            "detail": "Driver mentioned Mike's place on 5th and a couple drinks, but exact address and exact drink count are missing.",
            "evidenceRefs": ["bodycam:BC-4821-2025-0519:38"],
        }
    ]
    return state
