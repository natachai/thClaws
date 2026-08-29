# THClaws Transport Engine Roadmap

อัปเดตล่าสุด: 30 สิงหาคม 2026  
Branch: `transport-ui`  
สถานะ: วางแผนแล้ว ยังไม่เริ่มสร้าง calculation engine

## เป้าหมาย

แยก Transport UI, ตัวกลางของ THClaws และโค้ดคำนวณแบบจำลองออกจากกันอย่างชัดเจน เพื่อให้:

- React frontend ไม่รู้ตำแหน่งไฟล์ Python หรือรายละเอียดภายในของแบบจำลอง
- Transport workflow ใช้ schema ที่ไม่ผูกกับ React Flow/XYFlow
- Rust เป็นตัวกลางสำหรับ project persistence, process lifecycle และ IPC
- Transport engine เริ่มจาก Python package ที่ทดสอบได้ง่าย
- ภายหลังเปลี่ยน Python source เป็น `.pyd`, `.dll` หรือ `.exe` ได้โดยไม่ต้องเปลี่ยน Transport UI contract
- commercial model code และ license verification อยู่ภายใน engine ไม่รั่วเข้า open-source UI

## Architecture decision

โครงสร้างเป้าหมาย:

```text
THClaws Chat / Agent                 Transport Workspace
          │                                  │
          └──────── Transport Project ───────┘
                             │
                      THClaws Rust bridge
                  IPC / runner / process lifecycle
                             │
                versioned JSON Lines protocol
                             │
              thclaws_transport runner interface
                             │
             Python package วันนี้ / binary ในอนาคต
```

หลักการที่ต้องรักษา:

1. Frontend เรียกเฉพาะ stable `actionId` และ IPC command
2. Frontend ห้ามเรียก `.py`, `.pyd`, `.dll` หรือ `.exe` โดยตรง
3. Rust bridge เป็นผู้เลือกว่าจะเรียก Python package หรือ compiled engine
4. UI layout เป็นข้อมูลคนละส่วนกับ engine workflow
5. Project file ต้อง migrate จาก schema เก่าได้ ไม่ทำให้ workflow ที่บันทึกไว้หาย
6. การ validate ฝั่ง UI ช่วย feedback เร็ว แต่ engine ต้อง validate ซ้ำก่อนคำนวณจริง

## ขอบเขตของแต่ละส่วน

| ส่วน | รับผิดชอบ | ไม่ควรรับผิดชอบ |
| --- | --- | --- |
| `frontend/` | Workflow editor, parameters, validation feedback, progress และผลลัพธ์ | Python paths, process spawning, model algorithms, license secrets |
| `crates/core/` | Project persistence, IPC, runner discovery, process lifecycle, event forwarding | Transport algorithm implementation |
| `transport-engine/` | Input validation, workflow execution, model algorithms, result artifacts, future licensing | React components หรือ THClaws tab layout |

## โครงสร้าง repository เป้าหมาย

```text
thClaws/
├─ frontend/
│  └─ src/components/transport/
│     └─ ... Transport UI ...
│
├─ crates/
│  └─ core/
│     └─ src/
│        ├─ transport_project.rs
│        └─ transport_runner.rs       # เพิ่มในอนาคต
│
└─ transport-engine/
   ├─ pyproject.toml
   ├─ src/
   │  └─ thclaws_transport/
   │     ├─ __init__.py
   │     ├─ protocol.py
   │     ├─ registry.py
   │     ├─ runner.py
   │     ├─ generation/
   │     ├─ distribution/
   │     ├─ skim/
   │     ├─ modal_split/
   │     ├─ traffic_assignment/
   │     └─ transit_assignment/
   └─ tests/
```

ยังไม่ต้องสร้าง `transport-engine/` จนกว่า project schema และ runner protocol จะกำหนดเสร็จ

## Stable action IDs

Modelling actions:

- `transport.trip_generation`
- `transport.trip_distribution`
- `transport.modal_split`
- `transport.traffic_assignment`
- `transport.transit_assignment`
- `transport.skim`

Data source actions:

- `data.shapefile`
- `data.csv`
- `data.geojson`
- `data.parquet`

ชื่อที่ UI แสดง เช่น `Trip Generation` เปลี่ยนได้ในอนาคต แต่ `actionId` ที่บันทึกใน project และส่งเข้า engine ต้องคงที่ หรือมี migration ที่ชัดเจน

## Transport Project schema เป้าหมาย

### ปัญหาของ schema v1 ปัจจุบัน

`TransportProject` ปัจจุบันเก็บ `Node` และ `Edge` ของ `@xyflow/react` โดยตรง และใช้ `transportType` แบบ `trip-generation` หรือ `data-csv` จึงยังผูก engine data เข้ากับ UI library

ก่อนเริ่ม engine ต้องเปลี่ยนเป็น schema v2 และรองรับการอ่าน schema v1 เดิม

### หลักการของ schema v2

- `workflow` เก็บข้อมูลที่ engine เข้าใจได้
- `ui` เก็บตำแหน่ง node, viewport และข้อมูลการแสดงผล
- edge อ้างถึง `nodeId` และ `portId` โดยตรง
- node ใช้ stable `actionId`
- parameter และ data source configuration เป็น JSON-serializable
- parser ต้อง reject ข้อมูลผิดรูปแบบด้วย error ที่อ่านเข้าใจได้

ตัวอย่างเบื้องต้น:

```json
{
  "schemaVersion": 2,
  "metadata": {
    "name": "Bangkok Base Model",
    "baseYear": 2025
  },
  "workflow": {
    "nodes": [
      {
        "id": "node-1",
        "actionId": "transport.trip_generation",
        "parameters": {}
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": { "nodeId": "data-1", "portId": "table" },
        "target": { "nodeId": "node-1", "portId": "socioeconomic_data" }
      }
    ]
  },
  "ui": {
    "nodes": {
      "node-1": { "position": { "x": 100, "y": 200 } }
    }
  }
}
```

ตัวอย่างนี้เป็น design target; field สุดท้ายต้องถูกล็อกด้วย fixtures และ tests ก่อนนำไปใช้จริง

## Input/output port contract

node จริงต้องรองรับมากกว่าหนึ่ง input/output ตัวอย่างเช่น Traffic Assignment อาจต้องรับ OD matrix, network, capacity, free-flow time และ parameters แยกกัน

แต่ละ action จึงควรมี definition คล้าย:

```json
{
  "actionId": "transport.traffic_assignment",
  "inputs": [
    { "id": "demand", "dataType": "matrix.od", "required": true },
    { "id": "network", "dataType": "network.road", "required": true }
  ],
  "outputs": [
    { "id": "link_flows", "dataType": "table.link_flows" }
  ]
}
```

UI และ engine สามารถมี registry คนละ implementation ได้ แต่ต้องใช้ contract/version เดียวกัน และ engine เป็นผู้ตัดสินสุดท้ายว่าข้อมูลพร้อมรันหรือไม่

## Runner protocol

ระยะแรกให้ Rust เรียก:

```powershell
python -m thclaws_transport.runner
```

ภายหลัง Rust เปลี่ยนไปเรียก:

```powershell
thclaws-transport.exe
```

ทั้งสองแบบต้องสื่อสารด้วย JSON Lines protocol เดียวกันผ่าน standard input/output

ตัวอย่าง request:

```json
{"protocolVersion":1,"type":"run_action","runId":"run-123","actionId":"transport.trip_generation","parameters":{},"inputs":{}}
```

ตัวอย่าง events:

```json
{"protocolVersion":1,"type":"started","runId":"run-123"}
{"protocolVersion":1,"type":"progress","runId":"run-123","progress":0.5,"message":"Calculating productions"}
{"protocolVersion":1,"type":"completed","runId":"run-123","outputs":{}}
```

กรณีผิดพลาดต้องส่ง structured `failed` event ที่มี error code และข้อความ ไม่ส่ง traceback ดิบให้ frontend

## Foundation build checklist

งานชุดนี้ต้องเสร็จก่อนนำ model algorithm จริงเข้ามา

- [ ] **1. สร้าง engine-neutral project schema v2**
  อ้างอิง: `Transport Project schema เป้าหมาย`
  สิ่งที่จะทำ: แยก `workflow` ออกจาก `ui`, เปลี่ยน node เป็น stable `actionId` และไม่ import XYFlow type ใน engine-neutral model
  เกณฑ์ผ่าน: project JSON ไม่มี React Flow-specific fields ใน `workflow` และ Transport UI ยังแสดง workflow เดิมได้
  ตรวจสอบ: TypeScript tests/fixtures และ `cd frontend; npm run build`

- [ ] **2. เพิ่ม migration จาก schema v1 ไป v2**
  อ้างอิง: `ปัญหาของ schema v1 ปัจจุบัน`
  สิ่งที่จะทำ: map `trip-generation` และ `data-csv` แบบเดิมเป็น namespaced IDs พร้อมย้ายตำแหน่ง node ไป `ui`
  เกณฑ์ผ่าน: เปิด project v1 เดิมแล้วได้ project v2 ที่ node, edge และตำแหน่งครบ โดยไม่แก้ไฟล์ต้นฉบับจนกว่าผู้ใช้จะ Save
  ตรวจสอบ: fixture migration test สำหรับ data nodes และ modelling nodes ทุกชนิด

- [ ] **3. กำหนด multi-port action registry**
  อ้างอิง: `Input/output port contract`
  สิ่งที่จะทำ: กำหนด port ID, data type, required/optional และ parameter schema ของทุก node ปัจจุบัน
  เกณฑ์ผ่าน: validator แยก missing port, incompatible data type และ unconnected required input ได้
  ตรวจสอบ: unit tests ของ registry และ validation edge cases

- [ ] **4. ปรับ Workflow Canvas ให้เป็น UI adapter**
  อ้างอิง: `ขอบเขตของแต่ละส่วน`
  สิ่งที่จะทำ: แปลง engine-neutral nodes/edges เป็น XYFlow props และส่ง UI edits กลับเข้า project state
  เกณฑ์ผ่าน: drag, connect, delete, zoom, Save/Open และ tab state preservation ยังทำงานเหมือนเดิม
  ตรวจสอบ: `npm run lint`, `npm run build` และ manual tab-switch test

- [ ] **5. สร้าง Python package scaffold**
  อ้างอิง: `โครงสร้าง repository เป้าหมาย`
  สิ่งที่จะทำ: เพิ่ม `transport-engine/pyproject.toml`, `src/thclaws_transport/` และ tests โดยยังไม่ใส่ proprietary algorithms
  เกณฑ์ผ่าน: package import ได้และมี metadata/version ชัดเจน
  ตรวจสอบ: จาก `transport-engine` รัน `python -m pytest`

- [ ] **6. ล็อก protocol models และ JSON Lines codec**
  อ้างอิง: `Runner protocol`
  สิ่งที่จะทำ: สร้าง request/event models, protocol version, error codes และ JSONL encoder/decoder
  เกณฑ์ผ่าน: valid messages round-trip ได้, invalid version/message ถูก reject อย่างปลอดภัย
  ตรวจสอบ: Python protocol unit tests พร้อม golden JSON fixtures

- [ ] **7. สร้าง action registry และ runner entry point**
  อ้างอิง: `Stable action IDs`
  สิ่งที่จะทำ: map `actionId` ไป callable ผ่าน registry และสร้าง `python -m thclaws_transport.runner` โดยไม่ expose internal module paths
  เกณฑ์ผ่าน: unknown action ส่ง `failed` event; stub action ส่ง `started` และ `completed` ตาม protocol
  ตรวจสอบ: runner subprocess smoke test

- [ ] **8. เพิ่ม Rust transport runner bridge**
  อ้างอิง: `Architecture decision`
  สิ่งที่จะทำ: เพิ่ม `transport_runner.rs` สำหรับค้นหา engine, spawn process, ส่ง request, อ่าน events, timeout และ cleanup
  เกณฑ์ผ่าน: Rust สลับ Python runner กับ test executable ได้โดย frontend contract ไม่เปลี่ยน
  ตรวจสอบ: Rust integration tests และ `cargo build --release --features gui --bin thclaws`

- [ ] **9. เพิ่ม execution IPC และ Run state ใน UI**
  อ้างอิง: `Runner protocol`
  สิ่งที่จะทำ: เพิ่ม `transport_run_workflow`, started/progress/completed/failed events และ UI state สำหรับ idle/running/succeeded/failed
  เกณฑ์ผ่าน: Run ถูกบล็อกเมื่อ validation fail, progress แสดงได้ และไม่สามารถเริ่ม run ซ้อนโดยไม่ตั้งใจ
  ตรวจสอบ: frontend checks, Rust build และ manual development GUI test

- [ ] **10. สร้าง workflow executor แบบไม่ผูก algorithm**
  อ้างอิง: `Transport Project schema เป้าหมาย`
  สิ่งที่จะทำ: ตรวจ DAG, เรียง node ตาม dependency, resolve input artifacts และหยุดเมื่อ node ล้มเหลว
  เกณฑ์ผ่าน: synthetic workflow หลาย node รันตามลำดับและส่ง progress รวมได้
  ตรวจสอบ: Python integration tests สำหรับ success, cycle, missing input และ node failure

- [ ] **11. ทำ end-to-end reference run ด้วย stub engine**
  อ้างอิง: `Foundation build checklist`
  สิ่งที่จะทำ: รัน saved project จาก development GUI ผ่าน Rust ไป Python stub แล้วส่ง result กลับ UI
  เกณฑ์ผ่าน: ไม่มี direct Python call ใน React, state ยังอยู่เมื่อสลับ tab และ result/error แสดงเฉพาะ Transport workspace
  ตรวจสอบ: Chat → Transport → Chat, Files → Transport → Files และ Transport run smoke test บน Windows

- [ ] **12. ล็อก packaging abstraction ก่อนใส่ algorithm จริง**
  อ้างอิง: `Architecture decision`
  สิ่งที่จะทำ: กำหนด engine discovery/config และ contract test ที่ใช้ได้ทั้ง Python package กับ compiled executable
  เกณฑ์ผ่าน: เปลี่ยน runner implementation โดยไม่แก้ action IDs, project schema หรือ frontend IPC
  ตรวจสอบ: รัน contract test suite กับ Python runner และ test executable

## Model implementation milestones

เริ่มส่วนนี้เมื่อ Foundation checklist ผ่านแล้ว และมี algorithm specification, sample input และ expected output สำหรับแต่ละโมดูล

- [ ] Data adapters: Shapefile, CSV, GeoJSON และ Parquet
- [ ] Trip Generation พร้อม parameter schema และ regression dataset
- [ ] Trip Distribution พร้อม matrix validation
- [ ] Modal Split พร้อม utility/choice parameter contract
- [ ] Skim พร้อม network input/output contract
- [ ] Traffic Assignment พร้อม convergence/progress reporting
- [ ] Transit Assignment พร้อม transit network contract
- [ ] Result artifact manifest สำหรับ table, matrix, network และ GIS layers
- [ ] GIS Viewer integration สำหรับผลลัพธ์ที่ engine ส่งกลับ
- [ ] Chat/Agent tools สำหรับอ่าน แก้ validate และ run Transport Project
- [ ] MCP integration หลัง project/execution APIs เสถียร
- [ ] Binary packaging และ license verification ภายใน engine เท่านั้น

ทุกโมดูลต้องมีอย่างน้อย:

- parameter และ port schema
- deterministic test fixture หรือ tolerance ที่กำหนดชัดเจน
- input validation และ structured error
- progress reporting สำหรับงานที่ใช้เวลานาน
- output artifact metadata
- regression test เทียบ expected result

## งานถัดไปเมื่อกลับมาพัฒนา

เริ่มที่ **Foundation task 1–2 เท่านั้น**:

1. ออกแบบและเพิ่ม Transport Project schema v2
2. เพิ่ม migration v1 → v2 พร้อม fixtures
3. รัน frontend checks และทดสอบ Save/Open workflow เดิม

ยังไม่ควรสร้าง calculation algorithm, MapLibre, MCP, binary packaging หรือ licensing ในรอบนี้

## Definition of done ก่อนเริ่ม model code

- Project schema v2 และ v1 migration ผ่าน tests
- stable action IDs และ multi-port contracts ถูกล็อก
- Python runner protocol มี version และ contract tests
- Rust bridge รัน stub engine และส่ง progress/error กลับ UI ได้
- development GUI รัน workflow ตัวอย่างแบบ end-to-end ได้
- React ไม่มี Python path หรือ engine implementation detail
- เปลี่ยน Python runner เป็น compiled test executable ได้โดยไม่แก้ frontend

