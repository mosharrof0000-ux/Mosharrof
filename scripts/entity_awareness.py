#!/usr/bin/env python3
"""Deterministic runtime awareness/heartbeat for every Mosharrof entity."""
import json, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/"config"; ARTIFACT=ROOT/"artifacts"/"entity-awareness.json"
REQUIRED={"id","type","owner","name","responsibility","brain","scope","permission_profile","memory","tools","audit","delete_allowed"}
def load(p): return json.loads(p.read_text(encoding="utf-8"))
def main():
    registry=load(CONFIG/"entity_registry.json"); policy=load(CONFIG/"policy.json")
    entities=registry.get("entities",[]); errors=[]; ids=set(); states=[]
    if not entities: raise SystemExit("Entity registry is empty.")
    for e in entities:
        eid=e.get("id",""); missing=sorted(REQUIRED-set(e))
        if not eid: errors.append("entity without id"); continue
        if eid in ids: errors.append(f"duplicate entity id: {eid}")
        ids.add(eid)
        if missing: errors.append(f"{eid}: missing contract fields: {', '.join(missing)}")
        if e.get("delete_allowed") is not False: errors.append(f"{eid}: delete_allowed must be false")
        states.append({"id":eid,"name":e.get("name"),"brain":e.get("brain"),"state":"awake" if not missing else "degraded","heartbeat":"ok" if not missing else "contract-incomplete","responsibility":e.get("responsibility"),"scope":e.get("scope"),"permission_profile":e.get("permission_profile"),"communication":"core-coordinated","audit":e.get("audit")})
    gp=policy.get("global_policy",{})
    for key in ("delete_allowed","destructive_operations_allowed","scope_escape_allowed"):
        if gp.get(key) is not False: errors.append(f"global policy must deny {key}")
    report={"schema_version":"1.0.0","generated_at":datetime.now(timezone.utc).isoformat(),"system":"mosharrof-component-awareness","status":"awake" if not errors else "degraded","entity_count":len(states),"healthy_entities":sum(s["state"]=="awake" for s in states),"entities":states,"errors":errors,"meaning":"Technical awareness verifies identity, responsibility, scope, permissions, communication and heartbeat; it is not a claim of sentience."}
    ARTIFACT.parent.mkdir(parents=True,exist_ok=True); ARTIFACT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":report["status"],"entity_count":report["entity_count"],"healthy_entities":report["healthy_entities"],"errors":errors},ensure_ascii=False))
    if errors: raise SystemExit(2)
if __name__=="__main__": main()
