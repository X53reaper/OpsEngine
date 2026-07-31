#!/usr/bin/env python3
"""Create n8n workflows via API for key automations"""
import paramiko, json

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkOTYwYzdiOS0zMDVlLTQxMTEtYjEwOC1iNDExYWFlZDQ1ZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjM0NDc4ZDMtNzVmNS00MzE5LThkNjgtNDljYmQzMDE3ZTc4IiwiaWF0IjoxNzgxODEzMTY4fQ.t9VCE4Ile-NunNS7hFtRyI-dX3gYZlqnP9T1OyHpyFg"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

def create_workflow(name, nodes, connections):
    """Create an n8n workflow via API"""
    workflow = {
        "name": name,
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1"}
    }
    payload = json.dumps(workflow).replace("'", "'\\''")
    cmd = (
        f"curl -s -X POST http://localhost:5678/api/v1/workflows "
        f"-H 'X-N8N-API-KEY: {N8N_KEY}' "
        f"-H 'Content-Type: application/json' "
        f"-d '{payload}'"
    )
    stdin, stdout, stderr = client.exec_command(cmd)
    result = stdout.read().decode().strip()
    try:
        data = json.loads(result)
        if 'id' in data:
            # Activate the workflow
            activate_cmd = (
                f"curl -s -X PATCH http://localhost:5678/api/v1/workflows/{data['id']} "
                f"-H 'X-N8N-API-KEY: {N8N_KEY}' "
                f"-H 'Content-Type: application/json' "
                f"-d '{{\"active\": true}}'"
            )
            client.exec_command(activate_cmd)
            print(f"  Created + activated: {name} (id: {data['id']})")
            return data['id']
        else:
            print(f"  Error creating {name}: {result[:200]}")
            return None
    except:
        print(f"  Error: {result[:200]}")
        return None

# Workflow 1: Webhook Receiver -> Ops Engine
print("=== Creating n8n Workflows ===\n")

nodes1 = [
    {
        "parameters": {"httpMethod": "POST", "path": "safari-zetu-webhook", "responseMode": "responseNode"},
        "id": "webhook-1",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [240, 300]
    },
    {
        "parameters": {"method": "POST", "url": "http://ops-engine:3000/webhook/safari-zetu", "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]}, "sendBody": True, "bodyParameters": {"parameters": [{"name": "event", "value": "={{ $json.body.event }}"}]}, "options": {}},
        "id": "http-1",
        "name": "Forward to Ops Engine",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [480, 300]
    },
    {
        "parameters": {"respondWith": "json", "responseBody": "={{ { \"status\": \"received\" } }}"},
        "id": "respond-1",
        "name": "Respond",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [720, 300]
    }
]
conns1 = {"Webhook": {"main": [[{"node": "Forward to Ops Engine", "type": "main", "index": 0}]]}, "Forward to Ops Engine": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]}}
create_workflow("Safari Zetu Webhook Receiver", nodes1, conns1)

# Workflow 2: Daily Content Approval Digest
nodes2 = [
    {
        "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 8 * * *"}]}},
        "id": "cron-1",
        "name": "Daily 8AM",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": [240, 300]
    },
    {
        "parameters": {"method": "GET", "url": "http://ops-engine:3000/api/content/pending", "options": {}},
        "id": "http-2",
        "name": "Get Pending Content",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [480, 300]
    },
    {
        "parameters": {"conditions": {"number": [{"value1": "={{ $json.data?.length || 0 }}", "operation": "largerEqual", "value2": 1}]}},
        "id": "if-1",
        "name": "Has Pending?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [720, 300]
    },
    {
        "parameters": {"method": "POST", "url": "http://ops-engine:3000/api/content/approve-all", "options": {}},
        "id": "http-3",
        "name": "Auto-Approve All",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [960, 200]
    },
    {
        "parameters": {"values": {"string": [{"name": "message", "value": "No pending content today"}]}, "options": {}},
        "id": "set-1",
        "name": "No Content",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [960, 400]
    }
]
conns2 = {"Daily 8AM": {"main": [[{"node": "Get Pending Content", "type": "main", "index": 0}]]}, "Get Pending Content": {"main": [[{"node": "Has Pending?", "type": "main", "index": 0}]]}, "Has Pending?": {"main": [[{"node": "Auto-Approve All", "type": "main", "index": 0}], [{"node": "No Content", "type": "main", "index": 0}]]}}
create_workflow("Daily Content Approval Digest", nodes2, conns2)

# Workflow 3: Competitor Price Monitor
nodes3 = [
    {
        "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 7 * * 1,3,5"}]}},
        "id": "cron-2",
        "name": "Mon/Wed/Fri 7AM",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": [240, 300]
    },
    {
        "parameters": {"method": "POST", "url": "http://ops-engine:3000/api/competitors/scan", "options": {}},
        "id": "http-4",
        "name": "Scan Competitors",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [480, 300]
    },
    {
        "parameters": {"method": "GET", "url": "http://ops-engine:3000/api/competitors/landscape", "options": {}},
        "id": "http-5",
        "name": "Get Landscape",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [720, 300]
    }
]
conns3 = {"Mon/Wed/Fri 7AM": {"main": [[{"node": "Scan Competitors", "type": "main", "index": 0}]]}, "Scan Competitors": {"main": [[{"node": "Get Landscape", "type": "main", "index": 0}]]}}
create_workflow("Competitor Price Monitor", nodes3, conns3)

# Workflow 4: Weekly Performance Report
nodes4 = [
    {
        "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 9 * * 1"}]}},
        "id": "cron-3",
        "name": "Monday 9AM",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": [240, 300]
    },
    {
        "parameters": {"method": "GET", "url": "http://ops-engine:3000/metrics", "options": {}},
        "id": "http-6",
        "name": "Get Metrics",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [480, 300]
    },
    {
        "parameters": {"method": "GET", "url": "http://ops-engine:3000/api/learning/analyze", "options": {}},
        "id": "http-7",
        "name": "Analyze Performance",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [720, 300]
    }
]
conns4 = {"Monday 9AM": {"main": [[{"node": "Get Metrics", "type": "main", "index": 0}]]}, "Get Metrics": {"main": [[{"node": "Analyze Performance", "type": "main", "index": 0}]]}}
create_workflow("Weekly Performance Report", nodes4, conns4)

# Workflow 5: Onboarding Nudge Campaign
nodes5 = [
    {
        "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "30 7 * * *"}]}},
        "id": "cron-4",
        "name": "Daily 7:30AM",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.2,
        "position": [240, 300]
    },
    {
        "parameters": {"method": "GET", "url": "http://ops-engine:3000/api/skills", "options": {}},
        "id": "http-8",
        "name": "Check Skills",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [480, 300]
    },
    {
        "parameters": {"method": "POST", "url": "http://ops-engine:3000/api/research", "sendBody": True, "bodyParameters": {"parameters": [{"name": "topic", "value": "safari booking trends 2026"}]}, "options": {}},
        "id": "http-9",
        "name": "Research Trend",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [720, 300]
    }
]
conns5 = {"Daily 7:30AM": {"main": [[{"node": "Check Skills", "type": "main", "index": 0}]]}, "Check Skills": {"main": [[{"node": "Research Trend", "type": "main", "index": 0}]]}}
create_workflow("Daily Research & Nudge", nodes5, conns5)

print("\n=== Done ===")
client.close()
