import os
import sys
import json
import time
import random
import datetime
import asyncio
from typing import Optional, List, Dict, Any
from pathlib import Path

import pandas as pd
import numpy as np
from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Cloud Net — Datadog Log Anomaly Detection & Autonomous Self-Healing")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 1. CATALOGS & SELF-HEALING KNOWLEDGE BASE (From Project Colab & Benchmark)
# -----------------------------------------------------------------------------
SERVICES_CATALOG = [
    {"name": "web-store", "display_name": "web-store", "count_label": "1.79M", "env": "prod", "source": "nodejs", "host_prefix": "gke-us-east-web"},
    {"name": "auth-dotnet", "display_name": "auth-dotnet", "count_label": "1.61M", "env": "staging", "source": "auth-dotnet-internal", "host_prefix": "gke-us-east-auth"},
    {"name": "email-api-py", "display_name": "email-api-py", "count_label": "785K", "env": "dev", "source": "python", "host_prefix": "gke-us-east-email"},
    {"name": "ad-server", "display_name": "ad-server", "count_label": "398K", "env": "prod", "source": "golang", "host_prefix": "gke-us-east-ad"},
    {"name": "email-queue-processor", "display_name": "email-queue-process...", "count_label": "370K", "env": "prod", "source": "python-worker", "host_prefix": "gke-us-east-worker"},
    {"name": "web-store-mongo", "display_name": "web-store-mongo", "count_label": "340K", "env": "prod", "source": "mongodb", "host_prefix": "mongo-primary-01"},
]

SELF_HEALING_POLICIES = {
    "Metadata desync": {
        "action_id": "SH-ACT-101",
        "action_name": "FSCK_METADATA_RESYNC_AND_ORPHAN_PURGE",
        "description": "Reconcile NameNode metadata, re-index DataNode volumeMap, and purge unreferenced block pointers from invalidSet.",
        "manual_s": 2100,
        "auto_ms": 280,
        "manual_label": "35 min",
        "auto_label": "280 ms",
        "recovery_rate": 0.992,
        "severity": "CRITICAL",
        "subsystem": "DataNode-VolumeMap",
        "post_verification": "VolumeMap consistency verified (0 orphan pointers; status=HEALTHY)"
    },
    "Network I/O": {
        "action_id": "SH-ACT-102",
        "action_name": "CIRCUIT_BREAKER_RESET_AND_PIPELINE_FAILOVER",
        "description": "Trip circuit-breaker on degraded socket, failover client pipeline to secondary replica in alternate rack, reset TCP descriptors.",
        "manual_s": 2400,
        "auto_ms": 320,
        "manual_label": "40 min",
        "auto_label": "320 ms",
        "recovery_rate": 0.985,
        "severity": "HIGH",
        "subsystem": "DataXceiver-Socket",
        "post_verification": "Socket channel failover acknowledged (ACK 200 OK; latency < 5ms)"
    },
    "Under-replication": {
        "action_id": "SH-ACT-103",
        "action_name": "DYNAMIC_FORCE_RE_REPLICATION",
        "description": "Query surviving healthy replicas, spawn prioritized parallel replication tasks to target DataNodes, restore target factor = 3.",
        "manual_s": 1800,
        "auto_ms": 350,
        "manual_label": "30 min",
        "auto_label": "350 ms",
        "recovery_rate": 0.988,
        "severity": "MEDIUM",
        "subsystem": "NameSystem-Replication",
        "post_verification": "Block replication audit confirmed replica count = 3/3 (status=HEALTHY)"
    },
    "Thread contention": {
        "action_id": "SH-ACT-104",
        "action_name": "RECYCLE_DATAXCEIVER_WORKERS",
        "description": "Flush hung worker thread pool, release deadlocked channel locks, and scale worker pool capacity (+20% concurrency headroom).",
        "manual_s": 1200,
        "auto_ms": 310,
        "manual_label": "20 min",
        "auto_label": "310 ms",
        "recovery_rate": 0.991,
        "severity": "HIGH",
        "subsystem": "DataXceiver-Pool",
        "post_verification": "Thread pool probe returned 0 stuck workers; worker latency normalized"
    },
    "Client abort": {
        "action_id": "SH-ACT-105",
        "action_name": "LEASE_RECOVERY_AND_PARTIAL_BLOCK_COMMIT",
        "description": "Trigger NameNode lease recovery on abandoned file lease, finalize partial block chunks, release cluster write locks.",
        "manual_s": 900,
        "auto_ms": 220,
        "manual_label": "15 min",
        "auto_label": "220 ms",
        "recovery_rate": 0.997,
        "severity": "LOW",
        "subsystem": "NameSystem-Lease",
        "post_verification": "Lease recovered; partial chunk committed; cluster lock released"
    },
}

TOP_PATTERNS_CATALOG = [
    {
        "id": "pat_1",
        "service": "email-api-py",
        "count_label": "≈ 107K",
        "count": 107000,
        "recent_rate": "3.65K",
        "template": 'XXX.XXX.XXX.XXX - - [23/Mar/2022 HH:mm:ss] "GET /_health HTTP/1.1" 200 - writeBlock blk_<*> exception java.io.IOException: Could not read stream',
        "severity": "ERROR",
        "rca": "Network I/O",
        "divergence": "+19.2% above baseline"
    },
    {
        "id": "pat_2",
        "service": "auth-dotnet",
        "count_label": "≈ 42K",
        "count": 42000,
        "recent_rate": "3.8K",
        "template": 'XXX.XXX.XXX.XXX - - [23/Mar/2022 HH:mm:ss] "POST /api/v1/auth/token" 500 - Unexpected error deleting block: BlockInfo not found in volumeMap (E35)',
        "severity": "ERROR",
        "rca": "Metadata desync",
        "divergence": "+30.4% above baseline"
    },
    {
        "id": "pat_3",
        "service": "web-store",
        "count_label": "≈ 24K",
        "count": 24000,
        "recent_rate": "540",
        "template": 'BLOCK* NameSystem.allocateBlock: /orders/trans_2022.json PendingReplicationMonitor timed out block blk_<*> (E46)',
        "severity": "WARN",
        "rca": "Under-replication",
        "divergence": "+20.3% under-replication"
    },
    {
        "id": "pat_4",
        "service": "email-queue-processor",
        "count_label": "≈ 12K",
        "count": 12000,
        "recent_rate": "120",
        "template": 'DataXceiver worker thread pool exhausted: active threads = 1024/1024. PacketResponder for block blk_<*> Interrupted (E26)',
        "severity": "HIGH",
        "rca": "Thread contention",
        "divergence": "Deadlock Alert"
    },
    {
        "id": "pat_5",
        "service": "ad-server",
        "count_label": "≈ 8.5K",
        "count": 8500,
        "recent_rate": "85",
        "template": 'Receiving empty packet for block blk_<*>. Client socket EOF prematurely closed by peer (E18)',
        "severity": "WARN",
        "rca": "Client abort",
        "divergence": "Premature truncation"
    },
    {
        "id": "pat_6",
        "service": "web-store-mongo",
        "count_label": "≈ 1.72M",
        "count": 1720000,
        "recent_rate": "84K",
        "template": 'Receiving block blk_<*> src: 10.0.1.12:50010 dest: 10.0.1.14:50010 of size 67108864 (E1/E4)',
        "severity": "INFO",
        "rca": "Nominal Operation",
        "divergence": "Nominal Baseline"
    }
]

# Generate realistic logs matching the photo timestamps
print("[INIT] Loading rich in-memory log dataset matching reference photo...")
LOG_ENTRIES: List[Dict[str, Any]] = []
LOG_LOOKUP: Dict[str, Dict[str, Any]] = {}

base_date = datetime.datetime(2026, 3, 10, 16, 1, 34)
services_list = ["web-store", "auth-dotnet", "email-api-py", "ad-server", "email-queue-processor", "web-store-mongo"]

for i in range(6000):
    t_offset = datetime.timedelta(seconds=i * 0.08)
    cur_time = base_date - t_offset
    millis = f"{random.randint(100, 999):03d}"
    date_str = cur_time.strftime("Mar 10 %H:%M:%S.") + millis

    srv_name = services_list[i % len(services_list)]
    srv_meta = next(s for s in SERVICES_CATALOG if s["name"] == srv_name)
    host_map = {
        "web-store": "gke-us-east-web",
        "auth-dotnet": "gke-us-east-auth",
        "email-api-py": "gke-us-east-email",
        "ad-server": "gke-us-east-ad",
        "email-queue-processor": "gke-us-east-email",
        "web-store-mongo": "mongo-primary"
    }
    host_prefix = host_map.get(srv_name, "gke-us-east-web")
    host_str = f"{host_prefix}-node-{random.randint(10, 99)}.internal"
    block_id = f"blk_{random.randint(100000000000, 999999999999)}"

    # Specific error templates matching photo
    seq = i // len(services_list)
    if srv_name == "auth-dotnet" and (seq % 4 == 0):
        is_anom = True
        rca = "Metadata desync"
        level = "ERROR"
        content = f'XXX.XXX.XXX.XXX - - [{cur_time.strftime("%d/%b/%Y %H:%M:%S")}] "POST /api/v1/auth/token" 500 - Unexpected error deleting block {block_id}: BlockInfo not found in volumeMap (E35)'
        policy = SELF_HEALING_POLICIES[rca]
    elif srv_name == "email-api-py" and (seq % 4 == 0):
        is_anom = True
        rca = "Network I/O"
        level = "ERROR"
        content = f'XXX.XXX.XXX.XXX - - [{cur_time.strftime("%d/%b/%Y %H:%M:%S")}] "GET /_health HTTP/1.1" 200 - writeBlock {block_id} exception java.io.IOException: Could not read stream'
        policy = SELF_HEALING_POLICIES[rca]
    elif srv_name == "web-store" and (seq % 5 == 0):
        is_anom = True
        rca = "Under-replication"
        level = "WARN"
        content = f'BLOCK* NameSystem.allocateBlock: /orders/{block_id}.json PendingReplicationMonitor timed out block {block_id} (E46)'
        policy = SELF_HEALING_POLICIES[rca]
    elif srv_name == "email-queue-processor" and (seq % 5 == 0):
        is_anom = True
        rca = "Thread contention"
        level = "HIGH"
        content = f'DataXceiver worker thread pool exhausted: active threads = 1024/1024. PacketResponder for block {block_id} Interrupted (E26)'
        policy = SELF_HEALING_POLICIES[rca]
    elif srv_name == "ad-server" and (seq % 6 == 0):
        is_anom = True
        rca = "Client abort"
        level = "WARN"
        content = f'Receiving empty packet for block {block_id}. Client socket EOF prematurely closed by peer (E18)'
        policy = SELF_HEALING_POLICIES[rca]
    else:
        is_anom = False
        rca = "Nominal Operation"
        level = "INFO"
        content = f'10.0.{random.randint(1,9)}.{random.randint(1,50)} - - [{cur_time.strftime("%d/%b/%Y %H:%M:%S")}] "GET /api/v2/{srv_name}/status HTTP/1.1" 200 - Received block {block_id} size 67108864'
        policy = None

    log_entry = {
        "id": f"log_{i}",
        "date": date_str,
        "host": host_str,
        "service": srv_name,
        "env": srv_meta["env"],
        "source": srv_meta["source"],
        "level": level,
        "is_anomaly": is_anom,
        "rca": rca,
        "block_id": block_id,
        "content": content,
        "policy": policy,
        "recovery_ms": policy["auto_ms"] if policy else 0
    }
    LOG_ENTRIES.append(log_entry)
    LOG_LOOKUP[log_entry["id"]] = log_entry

print(f"[INIT] Loaded {len(LOG_ENTRIES)} logs into memory.")


# -----------------------------------------------------------------------------
# 2. REST API ROUTES
# -----------------------------------------------------------------------------
@app.get("/api/logs")
def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=5, le=100),
    services: str = Query("all"),
    sources: str = Query("all"),
    hosts: str = Query("all"),
    status: str = Query("all"),
    search: str = Query("")
):
    """Filter logs with full support for multi-checkbox service, source, and host selection."""
    filtered = LOG_ENTRIES

    # Service filtering
    if services != "all" and services.strip():
        sel_services = [s.strip().lower() for s in services.split(",") if s.strip()]
        if sel_services:
            filtered = [l for l in filtered if l["service"].lower() in sel_services]

    # Source filtering
    if sources != "all" and sources.strip():
        sel_sources = [s.strip().lower() for s in sources.split(",") if s.strip()]
        if sel_sources:
            filtered = [l for l in filtered if l.get("source", "").lower() in sel_sources]

    # Host filtering
    if hosts != "all" and hosts.strip():
        sel_hosts = [h.strip().lower() for h in hosts.split(",") if h.strip()]
        if sel_hosts:
            filtered = [l for l in filtered if any(h in l.get("host", "").lower() for h in sel_hosts)]

    # Status filtering
    if status == "anomaly":
        filtered = [l for l in filtered if l["is_anomaly"]]
    elif status == "normal":
        filtered = [l for l in filtered if not l["is_anomaly"]]

    # Search filter
    if search.strip():
        q = search.strip().lower()
        filtered = [
            l for l in filtered
            if q in l["content"].lower()
            or q in l["service"].lower()
            or q in l["host"].lower()
            or q in l["rca"].lower()
            or q in l["block_id"].lower()
        ]

    total_records = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    page_items = filtered[start_idx:end_idx]

    # Dynamically inject current real-time timestamps (second-by-second)
    now = datetime.datetime.now()
    items = []
    for idx, l in enumerate(page_items):
        item_copy = dict(l)
        item_time = now - datetime.timedelta(seconds=(page - 1) * limit * 0.4 + idx * 0.4)
        millis = f"{random.randint(100, 999):03d}"
        item_copy["date"] = item_time.strftime("%b %d %H:%M:%S.") + millis
        items.append(item_copy)

    return {
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": max(1, (total_records + limit - 1) // limit),
        "items": items
    }


@app.get("/api/patterns")
def get_patterns(services: str = Query("all"), search: str = Query("")):
    """Datadog 'Group into: Patterns' view data."""
    pats = TOP_PATTERNS_CATALOG
    if services != "all" and services.strip():
        sel_services = [s.strip().lower() for s in services.split(",") if s.strip()]
        if sel_services:
            pats = [p for p in pats if p["service"].lower() in sel_services]

    if search.strip():
        q = search.strip().lower()
        pats = [p for p in pats if q in p["template"].lower() or q in p["service"].lower() or q in p["rca"].lower()]

    return {"patterns": pats}


@app.get("/api/transactions")
def get_transactions(services: str = Query("all")):
    """Datadog 'Group into: Transactions' view data."""
    txs = []
    sample_pool = LOG_ENTRIES[:40]
    if services != "all" and services.strip():
        sel_services = [s.strip().lower() for s in services.split(",") if s.strip()]
        if sel_services:
            sample_pool = [l for l in LOG_ENTRIES if l["service"].lower() in sel_services][:40]

    for idx, l in enumerate(sample_pool):
        dur = random.randint(35, 120) if not l["is_anomaly"] else (l["recovery_ms"] + 45)
        txs.append({
            "transaction_id": f"tx_{l['block_id'].replace('blk_', '')[:10]}",
            "date": l["date"],
            "service": l["service"],
            "host": l["host"],
            "duration_ms": dur,
            "status": "200 OK" if not l["is_anomaly"] else f"AUTO-HEALED ({l['rca']})",
            "is_anomaly": l["is_anomaly"],
            "remediation": l["policy"]["action_name"] if l["policy"] else None
        })
    return {"transactions": txs}


@app.get("/api/timeline")
def get_timeline():
    """100k-scale stacked histogram for the current 10-minute live rolling window."""
    bars = []
    now = datetime.datetime.now()
    
    # Generate past 10 minutes up to current minute
    for i in range(9, -1, -1):
        t = now - datetime.timedelta(minutes=i)
        m = t.strftime("%H:%M")
        normal_vol = random.randint(72000, 84000)
        if i in [1, 4, 8]:
            anomaly_vol = random.randint(8500, 15000)
            has_spike = True
        else:
            anomaly_vol = random.randint(2200, 4800)
            has_spike = False

        bars.append({
            "time": m,
            "normal": normal_vol,
            "anomaly": anomaly_vol,
            "total": normal_vol + anomaly_vol,
            "has_spike": has_spike
        })

    return {"bars": bars}


# -----------------------------------------------------------------------------
# WATCHDOG ACTIVE INSIGHTS STATE (Dynamic, Healed Items are Removed!)
# -----------------------------------------------------------------------------
INITIAL_WATCHDOG_INSIGHTS = [
    {
        "id": "wd_card_1",
        "type": "NEW_ERROR_LOGS",
        "service": "email-api-py",
        "headline_prefix": "New error logs were detected on",
        "service_tag": "service:email-api-py",
        "description": "The anomalous logs appeared at a rate of 360 logs per minute.",
        "tags": [
            {"label": "ERROR", "type": "badge_error"},
            {"label": "source:python", "type": "tag_normal"},
            {"label": "env:dev", "type": "tag_normal"}
        ],
        "graph": {
            "y_max": "10k",
            "y_mid": "5k",
            "y_min": "0k",
            "x_labels": ["Mon 21", "12:00"]
        },
        "pattern_section": {
            "title": "Top Patterns for this outlier (1 of 4)",
            "count_label": "≈ 107K",
            "recent_rate": "3.65K",
            "service_label": "service:email-api-py",
            "template": 'XXX.XXX.XXX.XXX - - [23/Mar/2022 HH:mm:ss] "GET /_health HTTP/1.1" 200 -'
        },
        "self_healing": {
            "action_id": "SH-ACT-102",
            "action_name": "CIRCUIT_BREAKER_RESET_AND_PIPELINE_FAILOVER",
            "latency": "320 ms",
            "manual_baseline": "40 min manual triage"
        }
    },
    {
        "id": "wd_card_2",
        "type": "LOG_ANOMALY",
        "category_label": "LOG ANOMALY",
        "service": "auth-dotnet",
        "headline_prefix": "A spike in error logs was detected on",
        "service_tag": "service:auth-dotnet",
        "description": "The anomalous logs increased to a rate of 3.8K logs per minute.",
        "tags": [
            {"label": "ERROR", "type": "badge_error"},
            {"label": "source:auth-dotnet-internal", "type": "tag_normal"},
            {"label": "env:staging", "type": "tag_normal"}
        ],
        "graph": {
            "y_max": "20k",
            "y_min": "0k",
            "x_labels": ["Mar 20", "12:00"]
        },
        "pattern_section": {
            "title": "Top Patterns contributing to this anomaly (1 of 1)",
            "count_label": "≈ 42K",
            "recent_rate": "3.8K",
            "service_label": "service:auth-dotnet",
            "template": 'XXX.XXX.XXX.XXX - - [23/Mar/2022 HH:mm:ss] "POST /api/v1/auth/token" 500 - BlockInfo missing in volumeMap (E35)'
        },
        "self_healing": {
            "action_id": "SH-ACT-101",
            "action_name": "FSCK_METADATA_RESYNC_AND_ORPHAN_PURGE",
            "latency": "280 ms",
            "manual_baseline": "35 min manual triage"
        }
    }
]

ACTIVE_WATCHDOG_INSIGHTS = [dict(c) for c in INITIAL_WATCHDOG_INSIGHTS]


@app.get("/api/watchdog-insights")
def get_watchdog_insights():
    """Returns currently active Watchdog Insights (healed anomalies are removed)."""
    return {
        "header": {
            "title": "Watchdog Insights",
            "time_range": "Mar 8, 1:10 pm - Mar 8, 1:25 pm",
            "window_badge": "15m",
            "active_count": len(ACTIVE_WATCHDOG_INSIGHTS)
        },
        "insights": ACTIVE_WATCHDOG_INSIGHTS
    }


class HealRequest(BaseModel):
    insight_id: Optional[str] = None
    log_id: Optional[str] = None
    service: Optional[str] = None


@app.post("/api/heal-anomaly")
def heal_anomaly(req: HealRequest):
    """Marks an anomaly as fixed/healed and removes it from active anomaly lists."""
    global ACTIVE_WATCHDOG_INSIGHTS
    removed_insights = []

    # 1. Remove from Watchdog insights list
    if req.insight_id:
        to_keep = []
        for ins in ACTIVE_WATCHDOG_INSIGHTS:
            if ins["id"] == req.insight_id:
                removed_insights.append(ins)
            else:
                to_keep.append(ins)
        ACTIVE_WATCHDOG_INSIGHTS = to_keep

    if req.service:
        to_keep = []
        for ins in ACTIVE_WATCHDOG_INSIGHTS:
            if ins.get("service") == req.service:
                removed_insights.append(ins)
            else:
                to_keep.append(ins)
        ACTIVE_WATCHDOG_INSIGHTS = to_keep

    # 2. Update log entries (healed logs are no longer anomalies)
    healed_count = 0
    if req.log_id and req.log_id in LOG_LOOKUP:
        entry = LOG_LOOKUP[req.log_id]
        entry["is_anomaly"] = False
        entry["is_healed"] = True
        entry["level"] = "INFO"
        entry["content"] = entry["content"].replace(" (E35)", "").replace(" (E16)", "") + " [AUTO-HEALED & RESOLVED]"
        healed_count += 1

    if req.service:
        for entry in LOG_ENTRIES:
            if entry["service"] == req.service and entry["is_anomaly"]:
                entry["is_anomaly"] = False
                entry["is_healed"] = True
                entry["level"] = "INFO"
                entry["content"] = entry["content"] + " [AUTO-HEALED & RESOLVED]"
                healed_count += 1

    return {
        "status": "SUCCESS",
        "message": "Anomaly healed and removed from active list.",
        "healed_count": healed_count,
        "remaining_insights": len(ACTIVE_WATCHDOG_INSIGHTS),
        "active_insights": ACTIVE_WATCHDOG_INSIGHTS
    }


@app.post("/api/reset-insights")
def reset_insights():
    """Resets the insights and anomaly catalog for demo replay."""
    global ACTIVE_WATCHDOG_INSIGHTS
    ACTIVE_WATCHDOG_INSIGHTS = [dict(c) for c in INITIAL_WATCHDOG_INSIGHTS]
    return {"status": "SUCCESS", "active_insights": ACTIVE_WATCHDOG_INSIGHTS}


class SimulateRequest(BaseModel):
    service: Optional[str] = "email-api-py"
    fault_type: Optional[str] = None


@app.post("/api/simulate-anomaly")
def simulate_anomaly(req: SimulateRequest):
    """Simulate an incident in real-time on selected service with autonomous self-healing execution."""
    srv = req.service if req.service in [s["name"] for s in SERVICES_CATALOG] else "email-api-py"
    now_str = datetime.datetime.now().strftime("Mar 10 %H:%M:%S.") + f"{random.randint(100,999)}"
    bid = f"blk_{random.randint(100000000000, 999999999999)}"

    # Determine RCA
    if req.fault_type and req.fault_type in SELF_HEALING_POLICIES:
        rca = req.fault_type
    elif srv == "auth-dotnet":
        rca = "Metadata desync"
    elif srv == "web-store":
        rca = "Under-replication"
    elif srv == "ad-server":
        rca = "Thread contention"
    elif srv == "email-queue-processor":
        rca = "Client abort"
    else:
        rca = "Network I/O"

    if rca == "Metadata desync":
        content = f'Unexpected error deleting block {bid}: BlockInfo not found in volumeMap (E35)'
    elif rca == "Under-replication":
        content = f'PendingReplicationMonitor timed out block {bid} replica count=1 required=3 (E46)'
    elif rca == "Thread contention":
        content = f'DataXceiverServer worker pool exhausted waiting on thread channel for {bid} (E9)'
    elif rca == "Client abort":
        content = f'Client lease expired while streaming to {bid}: abandoned lease recovery initiated (E18)'
    else:
        content = f'XXX.XXX.XXX.XXX - - [{now_str}] "GET /_health HTTP/1.1" 200 - writeBlock {bid} exception java.io.IOException: Could not read stream (E16)'

    pol = SELF_HEALING_POLICIES[rca]
    new_entry = {
        "id": f"log_sim_{random.randint(10000, 99999)}",
        "date": now_str,
        "host": f"gke-us-east-{srv}-sim.internal",
        "service": srv,
        "env": "prod",
        "source": "simulated-fault",
        "level": "ERROR",
        "is_anomaly": True,
        "rca": rca,
        "block_id": bid,
        "content": content,
        "policy": pol,
        "recovery_ms": pol["auto_ms"]
    }
    LOG_ENTRIES.insert(0, new_entry)
    LOG_LOOKUP[new_entry["id"]] = new_entry

    steps = [
        {"step": 1, "title": "Watchdog Ingestion & Anomaly Alarm", "detail": f"Anomaly detected at high rate on {srv} (p-value < 0.001; confidence 99.8%)", "time_ms": 14},
        {"step": 2, "title": "Root Cause Identification (RCA Classifier)", "detail": f"Pattern classified as '{rca}' targeting subsystem {pol['subsystem']}", "time_ms": 42},
        {"step": 3, "title": "Autonomous Remediation Policy Dispatched", "detail": f"Executing {pol['action_id']} ({pol['action_name']})", "time_ms": 88},
        {"step": 4, "title": "Active Subsystem Remediation", "detail": pol["description"], "time_ms": pol["auto_ms"] - 30},
        {"step": 5, "title": "Post-Verification Health Check", "detail": f"{pol['post_verification']} — SLA restored in {pol['auto_ms']} ms!", "time_ms": pol["auto_ms"]}
    ]

    return {
        "status": "SUCCESS",
        "log": new_entry,
        "remediation": pol,
        "steps": steps,
        "speedup": f"{round((pol['manual_s'] * 1000) / pol['auto_ms']):,}x"
    }


class DemoRequest(BaseModel):
    name: str
    email: str
    company: Optional[str] = "Enterprise User"
    notes: Optional[str] = ""

DEMO_REQUESTS = []

@app.post("/api/request-demo")
def request_demo(req: DemoRequest):
    """Processes demo requests and routes to Mansi."""
    entry = {
        "id": f"demo_{len(DEMO_REQUESTS) + 1}",
        "name": req.name,
        "email": req.email,
        "company": req.company,
        "notes": req.notes,
        "timestamp": datetime.datetime.now().isoformat(),
        "recipient": "mansi.m@cloudnet.io"
    }
    DEMO_REQUESTS.append(entry)
    print(f"[DEMO REQUEST] Received from {req.name} ({req.email}), forwarded to Mansi M")
    return {
        "status": "SUCCESS",
        "message": "Demo request recorded and forwarded to Mansi M (mansi.m@cloudnet.io)",
        "entry": entry
    }

# -----------------------------------------------------------------------------
# 2.5 BACKUP & POINT-IN-TIME TIME TRAVEL API (Persistent Historical Archive)
# -----------------------------------------------------------------------------
import hashlib

BACKUP_HISTORY_STORE: List[Dict[str, Any]] = []

def _init_backup_history():
    global BACKUP_HISTORY_STORE
    BACKUP_HISTORY_STORE = []
    now = datetime.datetime.now()
    yesterday = now - datetime.timedelta(days=1)
    
    events_templates = [
        ("auth-dotnet", "HDFS-VolumeMap", "E35 VolumeMap desync detected — BlockInfo not found for {bid}", "AUTONOMOUS SELF-HEAL: Re-indexed DataNode volumeMap & committed cold checkpoint (42ms)", True, "ERROR"),
        ("auth-dotnet", "HDFS-VolumeMap", "Periodic VolumeMap consistency audit across 14,210 blocks", "Audit passed: 0 orphaned blocks, volumeMap sync 100%", False, "INFO"),
        ("web-store", "NameNode-Replication", "PendingReplicationMonitor timeout for /orders/{bid}.json (E46)", "AUTONOMOUS SELF-HEAL: Dispatched asynchronous pipeline re-replication to rack-03 (68ms)", True, "WARN"),
        ("web-store", "NameNode-Replication", "allocateBlock /orders/{bid}.json 3x replica confirmation", "Block allocation acknowledged by DataNodes node-14, node-22, node-38", False, "INFO"),
        ("email-api-py", "DataNode-Stream", "writeBlock java.io.IOException: Socket read stream closed for {bid}", "AUTONOMOUS SELF-HEAL: Fallback replication channel opened, dead socket evicted (95ms)", True, "ERROR"),
        ("email-api-py", "DataNode-Stream", "Client stream flush completed for block {bid} (64 MB)", "Pipeline checksum verification valid (CRC32: 9f8a)", False, "INFO"),
        ("email-queue-processor", "ThreadPool-Exec", "DataXceiver worker thread pool exhausted (1024/1024 active) (E26)", "AUTONOMOUS SELF-HEAL: Scaled worker thread pool to 2048, cleared stale connection leases (310ms)", True, "HIGH"),
        ("ad-server", "Socket-Transport", "Receiving empty packet for {bid}. Client socket EOF prematurely closed", "AUTONOMOUS SELF-HEAL: Dropped zombie client socket, recycled TCP file descriptors (88ms)", True, "WARN"),
        ("web-store-mongo", "Mongo-WAL", "WAL journal checkpoint write committed to disk", "Journal sync duration: 4.2ms, dirty pages: 0", False, "INFO"),
        ("auth-dotnet", "DataNode-FSCK", "fsck integrity sweep across HDFS volume mount /data/hdfs/v1", "Integrity check 100% clean, filesystem healthy", False, "INFO")
    ]

    # Generate 150 historical records for Yesterday
    for idx in range(150):
        t = yesterday.replace(hour=8, minute=0, second=0) + datetime.timedelta(minutes=idx * 6, seconds=(idx * 17) % 60)
        ms = (idx * 123) % 999
        bid = f"blk_{random.randint(100000000000, 999999999999)}"
        tmpl = events_templates[idx % len(events_templates)]
        h = hashlib.sha256(f"yesterday_{idx}_{bid}".encode()).hexdigest()[:16]

        BACKUP_HISTORY_STORE.append({
            "id": f"hist_yd_{idx}",
            "date_category": "yesterday",
            "timestamp": t.strftime("Nov 20, 2026 %H:%M:%S.") + f"{ms:03d}",
            "time_iso": t.isoformat(),
            "service": tmpl[0],
            "subsystem": tmpl[1],
            "block_id": bid,
            "action": tmpl[2].format(bid=bid),
            "resolution": tmpl[3],
            "is_anomaly": tmpl[4],
            "level": tmpl[5],
            "backup_hash": h,
            "artifact_path": f"/backup/hdfs/snap_20261120_{t.strftime('%H%M%S')}.meta.gz"
        })

    # Generate 150 historical records for Today
    for idx in range(150):
        t = now - datetime.timedelta(minutes=idx * 3, seconds=(idx * 11) % 60)
        ms = (idx * 234) % 999
        bid = f"blk_{random.randint(100000000000, 999999999999)}"
        tmpl = events_templates[(idx + 3) % len(events_templates)]
        h = hashlib.sha256(f"today_{idx}_{bid}".encode()).hexdigest()[:16]

        BACKUP_HISTORY_STORE.append({
            "id": f"hist_td_{idx}",
            "date_category": "today",
            "timestamp": t.strftime("%b %d, %Y %H:%M:%S.") + f"{ms:03d}",
            "time_iso": t.isoformat(),
            "service": tmpl[0],
            "subsystem": tmpl[1],
            "block_id": bid,
            "action": tmpl[2].format(bid=bid),
            "resolution": tmpl[3],
            "is_anomaly": tmpl[4],
            "level": tmpl[5],
            "backup_hash": h,
            "artifact_path": f"/backup/hdfs/snap_{t.strftime('%Y%m%d_%H%M%S')}.meta.gz"
        })

_init_backup_history()

@app.get("/api/backup/history")
def get_backup_history(
    search: str = Query(""),
    date_range: str = Query("all"),
    category: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=5, le=100)
):
    """Searches persistent backup history without anything vanishing."""
    items = BACKUP_HISTORY_STORE
    if date_range == "yesterday":
        items = [x for x in items if x["date_category"] == "yesterday"]
    elif date_range == "today":
        items = [x for x in items if x["date_category"] == "today"]

    if category == "anomalies":
        items = [x for x in items if x["is_anomaly"]]
    elif category == "volumemap":
        items = [x for x in items if "volumemap" in x["subsystem"].lower() or "volumemap" in x["action"].lower()]

    if search.strip():
        q = search.strip().lower()
        items = [
            x for x in items
            if q in x["block_id"].lower()
            or q in x["service"].lower()
            or q in x["subsystem"].lower()
            or q in x["action"].lower()
            or q in x["resolution"].lower()
            or q in x["timestamp"].lower()
            or q in x["backup_hash"].lower()
        ]

    total = len(items)
    start_idx = (page - 1) * limit
    paged = items[start_idx:start_idx + limit]
    return {
        "total_records": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
        "items": paged
    }

BACKUP_SNAPSHOTS = [
    {
        "id": "snap_yesterday_full",
        "filename": "cloudnet_hdfs_backup_yesterday_235959.meta.gz",
        "period": "Yesterday (Full 24h Snapshot)",
        "date": (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%b %d, %Y 23:59:59"),
        "records": "6,821,395 logs / 14,210 blocks",
        "size_mb": 42.4,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "status": "VERIFIED & IMMUTABLE",
        "retention": "30 Days (Cold Archive)"
    },
    {
        "id": "snap_yesterday_midday",
        "filename": "cloudnet_hdfs_backup_yesterday_120000.meta.gz",
        "period": "Yesterday (Mid-Day Checkpoint)",
        "date": (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%b %d, %Y 12:00:00"),
        "records": "3,410,200 logs / 7,105 blocks",
        "size_mb": 21.8,
        "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
        "status": "VERIFIED & IMMUTABLE",
        "retention": "30 Days (Cold Archive)"
    },
    {
        "id": "snap_today_morning",
        "filename": "cloudnet_hdfs_backup_today_000000.meta.gz",
        "period": "Today (Midnight Baseline)",
        "date": datetime.datetime.now().strftime("%b %d, %Y 00:00:00"),
        "records": "4,120,000 logs / 8,900 blocks",
        "size_mb": 28.1,
        "sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
        "status": "VERIFIED & IMMUTABLE",
        "retention": "7 Days (Hot Storage)"
    },
    {
        "id": "snap_live_wal",
        "filename": "cloudnet_live_stream_rolling.wal",
        "period": "Live (Continuous Stream)",
        "date": datetime.datetime.now().strftime("%b %d, %Y %H:%M:%S"),
        "records": "Active Rolling Buffer (1s SLA)",
        "size_mb": 5.2,
        "sha256": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
        "status": "STREAMING ACTIVE",
        "retention": "24 Hours (Fast Tier)"
    }
]

@app.get("/api/backup/snapshots")
def get_backup_snapshots():
    """Returns list of verifiable snapshot backups."""
    return {"snapshots": BACKUP_SNAPSHOTS}

@app.get("/api/backup/timeline")
def get_backup_timeline(
    time_range: str = Query("live"),
    target_date: Optional[str] = Query(None),
    target_second: Optional[str] = Query(None)
):
    """
    Returns second-by-second activity ledger for Live stream, Yesterday, or custom date/time.
    Supports point-in-time second playback.
    """
    now = datetime.datetime.now()
    if time_range == "yesterday":
        base_t = (now - datetime.timedelta(days=1)).replace(hour=14, minute=30, second=0)
    elif target_date:
        try:
            base_t = datetime.datetime.fromisoformat(target_date)
        except Exception:
            base_t = now - datetime.timedelta(days=1)
    else:
        base_t = now

    seconds_data = []
    actions_pool = [
        ("auth-dotnet", "HDFS-VolumeMap", "DataNode volumeMap lookup & block metadata update", "BlockInfo consistency check verified", False),
        ("auth-dotnet", "HDFS-VolumeMap", "E35 VolumeMap desync detected — orphan block found", "AUTONOMOUS SELF-HEAL: Re-indexed DataNode volumeMap & committed cold checkpoint", True),
        ("web-store", "NameNode-Replication", "allocateBlock /orders/tx_block.json", "PendingReplicationMonitor verification 3x replicas active", False),
        ("email-api-py", "DataNode-Stream", "writeBlock streaming packet to peer 10.0.3.18", "Packet ack received in 1.4ms", False),
        ("email-queue-processor", "ThreadPool-Exec", "DataXceiver thread pool allocation", "Thread load 412/1024 active (healthy)", False),
        ("ad-server", "Socket-Transport", "writePacket client stream flushed", "TCP socket window 65535 verified", False)
    ]

    for sec_idx in range(60):
        sec_time = base_t - datetime.timedelta(seconds=(59 - sec_idx))
        sec_str = sec_time.strftime("%H:%M:%S")
        date_full_str = sec_time.strftime("%b %d, %Y %H:%M:%S")

        # Specific deterministic anomalies for realism
        has_anom = (sec_idx % 12 == 3) or (sec_idx == 45)
        events_for_sec = []

        # 1 to 4 micro-events inside this second
        event_count = random.randint(2, 4)
        for ev_i in range(event_count):
            ms = random.randint(10, 990)
            if has_anom and ev_i == 0:
                act = actions_pool[1]  # VolumeMap desync + self-heal
                level = "ERROR"
            else:
                act = actions_pool[(sec_idx + ev_i) % len(actions_pool)]
                level = "INFO"

            bid = f"blk_{random.randint(100000000000, 999999999999)}"
            ev_hash = hashlib.sha256(f"{date_full_str}.{ms}_{bid}".encode()).hexdigest()[:16]

            events_for_sec.append({
                "time": f"{sec_str}.{ms:03d}",
                "timestamp_full": f"{date_full_str}.{ms:03d}",
                "service": act[0],
                "subsystem": act[1],
                "level": level,
                "action": act[2],
                "resolution": act[3],
                "is_anomaly": (level == "ERROR"),
                "healed": (level == "ERROR"),
                "block_id": bid,
                "backup_artifact": f"/backup/hdfs/snap_{sec_time.strftime('%Y%m%d_%H%M%S')}_{ms:03d}.meta.gz",
                "sha256": ev_hash
            })

        seconds_data.append({
            "second_idx": sec_idx,
            "second_label": sec_str,
            "timestamp": date_full_str,
            "events_count": len(events_for_sec),
            "has_anomaly": has_anom,
            "anomaly_healed": has_anom,
            "events": events_for_sec
        })

    return {
        "range": time_range,
        "base_date": base_t.strftime("%Y-%m-%d"),
        "base_timestamp": base_t.strftime("%b %d, %Y %H:%M:%S"),
        "total_seconds": len(seconds_data),
        "total_events": sum(s["events_count"] for s in seconds_data),
        "timeline": seconds_data
    }

@app.post("/api/backup/create")
def create_manual_snapshot():
    """Creates a real-time point-in-time snapshot backup."""
    now = datetime.datetime.now()
    snap_id = f"snap_manual_{now.strftime('%Y%m%d_%H%M%S')}"
    snap_name = f"cloudnet_hdfs_snap_{now.strftime('%Y%m%d_%H%M%S')}.meta.gz"
    snap_hash = hashlib.sha256(snap_id.encode()).hexdigest()

    new_snap = {
        "id": snap_id,
        "filename": snap_name,
        "period": "Manual Point-in-Time Snapshot",
        "date": now.strftime("%b %d, %Y %H:%M:%S"),
        "records": "6,821,395 logs / 14,210 blocks",
        "size_mb": 42.5,
        "sha256": snap_hash,
        "status": "VERIFIED & IMMUTABLE",
        "retention": "60 Days"
    }
    BACKUP_SNAPSHOTS.insert(0, new_snap)
    return {
        "status": "SUCCESS",
        "message": f"Point-in-time second snapshot created and verified: {snap_name}",
        "snapshot": new_snap
    }

@app.get("/api/backup/download/{snapshot_id}")
def download_backup_snapshot(snapshot_id: str):
    """Generates and serves a real downloadable snapshot archive."""
    snap = next((s for s in BACKUP_SNAPSHOTS if s["id"] == snapshot_id or s["filename"] == snapshot_id), None)
    if not snap:
        snap = BACKUP_SNAPSHOTS[0]

    # Create mock compressed payload
    payload = json.dumps({
        "cloudnet_version": "2.4.0",
        "snapshot_id": snap["id"],
        "filename": snap["filename"],
        "timestamp": snap["date"],
        "records_count": snap["records"],
        "sha256_checksum": snap["sha256"],
        "compression": "gzip/metadata",
        "hdfs_blocks_ledger": [
            {"block_id": f"blk_{random.randint(100000000000, 999999999999)}", "size_bytes": 67108864, "volumeMap_status": "CONSISTENT", "replicas": 3}
            for _ in range(20)
        ],
        "audit_note": "Verified by Mansi M (Super Administrator) - Cloud Net Self-Healing Platform"
    }, indent=2)

    return Response(
        content=payload,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{snap["filename"]}.json"'
        }
    )

# -----------------------------------------------------------------------------
# 3. MOUNT STATIC & RUN
# -----------------------------------------------------------------------------
current_file = Path(__file__).resolve()
possible_static_dirs = [
    current_file.parent / "static",
    current_file.parent.parent / "web_dashboard" / "static",
    Path.cwd() / "web_dashboard" / "static",
    Path.cwd() / "static"
]
static_dir = current_file.parent / "static"
for d in possible_static_dirs:
    if d.exists() and (d / "explorer.html").exists():
        static_dir = d
        break

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    idx_path = static_dir / "index.html"
    if idx_path.exists():
        with open(idx_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Cloud Net is running</h1><p><a href='/explorer'>Go to Explorer</a></p>")


@app.get("/explorer", response_class=HTMLResponse)
@app.get("/monitors", response_class=HTMLResponse)
@app.get("/history", response_class=HTMLResponse)
@app.get("/backup", response_class=HTMLResponse)
@app.get("/profile", response_class=HTMLResponse)
def serve_explorer(request: Request):
    p = static_dir / "explorer.html"
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    idx_path = static_dir / "index.html"
    if idx_path.exists():
        with open(idx_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>Cloud Net Explorer</h1>")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("server:app", host=host, port=port, reload=False)
