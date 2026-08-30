# THClaws Transport Engine Roadmap

อัปเดตล่าสุด: 31 สิงหาคม 2026

Branch: `transport-ui`

สถานะ foundation: implementation, checks/build, browser end-to-end และ native GUI launch ของงานชุดที่ 1 ผ่านแล้ว; รอ manual mouse-drag acceptance ก่อนปิด 4V

Iteration ล่าสุด: standalone **Trip Generation batch ครบ 8 ปี** 2022–2057 ทุก 5 ปี โดยใช้ DBF ของแต่ละปีและสูตรเดิม; tests 52/52, saved batch 8/8 และ artifact verification ผ่าน ไม่เชื่อม UI/Rust หรือเพิ่มโมดูลอื่น

หลักฐาน engine iteration ก่อนหน้า: package/adapter/local action runner ผ่าน tests 33/33, 2032 regression และ standalone run; full-workflow JSONL protocol/runner bridge ยัง pending

Iteration ก่อนหน้า: Result Viewer GIS/Data/Chart ใช้ shared dataset; source/tests/frontend/desktop builds, browser verification และ native GUI launch ผ่านแล้ว ยังรอ manual mouse-drag acceptance; UI Run ยัง validate-only และ Result Viewer ยังเป็น demo

## เป้าหมายและขอบเขต

แยก Transport UI, Rust bridge และ model algorithms ให้ชัดเจนตั้งแต่ต้น:

- React รู้ stable action IDs และ project contract ไม่รู้ path ภายใน Python model
- workflow data ไม่ผูกกับ React Flow/XYFlow; layout อยู่ใน `ui`
- Rust ดูแล persistence, workspace boundaries และในอนาคต process lifecycle/IPC
- `transport-engine/` เริ่มเป็น Python package `thclaws_transport` ที่ทดสอบแยกได้ โดยเริ่มจาก TG-only prototype
- ภายหลังใช้ `.pyd`, `.dll` หรือ `.exe` หลัง runner interface เดิม โดยไม่เปลี่ยน frontend contract
- commercial algorithms และ license verification อยู่ภายใน engine เท่านั้น

| ส่วน | รับผิดชอบ | ไม่รับผิดชอบ |
| --- | --- | --- |
| `frontend/` | Editor, source references, metadata, structural validation, progress/result UI | Python paths, process spawning, algorithms, license secrets |
| `crates/core/` | Safe persistence, source sandbox, IPC; future runner lifecycle/event forwarding | Transport calculations |
| `transport-engine/` | Standalone TG input adapter/calculation/local artifacts; future workflow execution/licensing | React layout และ THClaws tabs |

Chat และ Transport เป็นคนละ workspace ที่ในอนาคตเข้าถึง Transport Project เดียวกัน ไม่เพิ่ม Chat panel ใน Transport ใน milestone นี้

## Architecture target

```text
Chat / Agent                 Transport Workspace
      └──────── Transport Project ────────┘
                        │
                 THClaws Rust bridge
                        │
               versioned JSON Lines
                        │
           thclaws_transport runner interface
                        │
        Python package / compiled engine ภายหลัง
```

source ตอนนี้มี UI, project contract, persistence, source browser และ Result Viewer presentation foundation พร้อมเริ่ม standalone TG prototype แยกต่างหาก; diagram ส่วน full-workflow runner/Rust integration/Chat control ยังเป็นเป้าหมาย ไม่ใช่เส้นทางที่ UI เรียกได้แล้ว

## Bounded milestone ล่าสุด — TG all-years batch

- [x] คัดลอก inputs ที่ผู้ใช้อนุญาตจาก `planning/`, `Project/` และ reviewed eBUMpy settings โดย originals read-only: 21 files / 7,523,177 bytes ไป `local-fixtures/trip-generation-all-years/` พร้อม manifest
- [x] ตรวจ year-specific DBFs ครบ 8 คู่และ pure preflight ทุกปี: planning 1,778 zones / attraction 1,805 records; ไม่เปลี่ยน formula หรือใช้ข้อมูลปีเดียวแทนปีอื่น
- [x] Saved batch และ final tests/artifact verification — tests 52/52 (เดิม 33 + ใหม่ 19, no skips, 5.032 s), 8 completed / 0 failed; 56 artifacts / 40 CSVs ผ่าน hashes/size/fields/rows/finite values/P–A balance/sums ตาม tolerance; originals/copies 21 inputs และ TG เดิม 128 files ตรวจไม่เปลี่ยนหลังรัน

คำสั่ง `python -B scripts/run_trip_generation_all_years.py`; ผลตัวเลข/คำเตือนอยู่ใน batch `summary.md`/`summary.json` ไม่สร้างรายงานซ้ำ ตรวจด้วย `scripts/copy_trip_generation_all_years.ps1 -VerifyOnly` และ `python -B scripts/verify_trip_generation_batch.py --summary runs/<batch-id>/summary.json`

การผ่าน all-years execution ไม่ใช่ calibration/full Cube parity ไม่เปลี่ยน Task 4A/Task 5 ของต้นฉบับ และไม่ปิด full-workflow runner/Rust/GUI tasks; ไม่มี install/frontend/Rust edits ใน iteration นี้ ยังคง manual UI acceptance เดิมค้าง

รอบส่งมอบล่าสุดคือ `runs/trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4/` พร้อม `summary.md`, `summary.json` และ `verification-8ad9ee7ca2e84593b44e718315677e29.json`; run ทดสอบก่อนหน้าเก็บไว้ไม่ overwrite ปี 2032 ผ่าน golden 5 CSV hashes + totals/QA equality ส่วนอีก 7 ปีตรวจ integrity/accounting ไม่ใช่ golden comparison รายละเอียด paths อยู่ใน [TRANSPORT_STATUS.md](./TRANSPORT_STATUS.md)

## หลักฐาน milestone ก่อนหน้า — นำเข้า Trip Generation 2032

ผู้ใช้เลือกนำ real TG มาทดลองเป็น isolated package ก่อน full stub/Rust milestone จึงปรับลำดับงานโดย **ไม่ยกเลิก protocol/integration/safety gates** และไม่เอา model implementation ลง frontend/backend

- คัดลอกต้นฉบับแบบ read-only ไป `transport-engine/reference/trip-generation/`: 128 files / 30,005,543 bytes (~28.62 MiB), ยกเว้น `__pycache__`; เก็บ conflict copies แยกไม่ merge และมี SHA256 manifest
- archive review กว้างก่อนจำกัด scopeยังอยู่ใน ignored `reference/eBUMpy/`: 186 source/config/docs; initial manifest รวม 204 copy records เมื่อรวม fixture 15 และ runtime 3 ไม่ใช่การ implement โมดูลอื่น
- fixture 2032 มี 7 inputs / 952,522 bytes และ 8 historical expected files / 6,345,448 bytes; `generation/calculation.py` byte-identical กับ canonical source
- Python 3.11.9 standard library; ไม่ติดตั้ง NumPy/Pandas/SciPy/GeoPandas/OpenMatrix เพราะ TG ชุดนี้ไม่ต้องใช้ ไม่ compile binary
- destination adapter รับ explicit six input references และ `year`; optional tour rates เป็น provenance เท่านั้น ไม่มีการ auto-discover หรือเรียก legacy CLI ที่เขียนกลับ original outputs
- local single-action request ใช้ `schemaVersion`, `actionId`, `parameters`, `inputs`; รองรับ `transport.trip_generation` เท่านั้นและสร้าง unique run artifacts ใน destination ไม่ใช่ full JSONL `run_action`/`run_workflow` protocol ที่เสนอด้านล่าง
- ไม่มี frontend/Rust edits, GUI integration หรือ desktop build ใหม่; UI Run ยัง structural-validation-only และ Result Viewer ยัง demo

**Verification ของ iteration 2032:** package/adapter/runner tests ผ่าน 33/33 (no skips, 4.241 s); standalone 2032 run ผ่าน โดย CSV 5 files SHA256 เหมือน goldens ทุก byte และ totals/QA JSON เท่ากันเชิงข้อมูล; input/path/no-overwrite tests รวมการป้องกัน abbreviated workspace override ผ่าน หลังรันตรวจ TG 128 files ต้นฉบับ/สำเนา hashes ไม่เปลี่ยนพร้อม initial inventory/selected-copy verification ดู run ID/row counts ใน [TRANSPORT_STATUS.md](./TRANSPORT_STATUS.md) ไม่ใช้ UI build/test ก่อนหน้ามาแทน engine tests ไม่มี wheel/binary build หรือ dependency install

Scientific scope: reproduce frozen legacy outputs ไม่เท่ากับ calibration/full Cube parity; historical fixture มี age mismatch >5% 1 zone และ Furness column residual 1.360739 หลัง 5 iterations ต้องรายงาน warnings ไม่เปลี่ยนสูตรเพื่อให้ผลดูสมบูรณ์ Task 4A/Task 5 ของ original model ยังคงเป็น gate ที่งาน TG-only นี้ไม่ได้แก้ รายละเอียด [REVIEW_EBUMPY.md](./transport-engine/REVIEW_EBUMPY.md)

## สิ่งที่ทำในงานชุดที่ 1

รวม schema, migration, port registry และ Canvas/validation adapter เป็น **milestone เดียว** เพราะเปลี่ยน schema โดยไม่ปรับ consumers พร้อมกันจะทำให้แอปใช้ project ไม่ได้

- schema v2 แยก `workflow` / `ui`
- stable action IDs และ named multi-port structural definitions
- legacy v1 migration พร้อมเก็บ unknown/ambiguous connections สำหรับซ่อม
- New/Open/Save/Save As Copy พร้อมป้องกัน overwrite และสำรอง bytes เดิม
- Data Library เปลี่ยนเป็น Create new data → Import data from source → เลือกไฟล์/format/data type
- แต่ละ block แก้ name, note, details และ output names ได้
- input selector นำ named output จาก block อื่นมาใช้ต่อได้

ในงานชุดที่ 1 ยังไม่ทำ: file-content parsing, parameter/calculation engine, MapLibre, MCP, Chat tools, binary compilation หรือ licensing; standalone TG adapter/calculation เริ่มใน milestone ใหม่ข้างต้น ไม่ใช่ความสามารถของ Data source UI

## Result Viewer presentation milestone — iteration หลังงานชุดที่ 1

เปลี่ยน panel ขวาจาก GISViewer เป็น **ResultViewer** พร้อม GIS / Data / Chart tabs โดยไม่เปลี่ยน Node Library, Workflow Canvas, App.tsx, backend หรือ package dependencies เพิ่มใน iteration นี้

### หลักการที่ลงใน source แล้ว

- ใช้ shared `TransportResultDataset` object เดียวสำหรับทุก representation ไม่สร้าง dataset คนละชุดในแต่ละ tab
- dataset มี `id`, `name`, `origin`, generic `fields`/`rows` ที่มี stable IDs, optional `sourceNodeId`/`sourcePortId` และ optional GeoJSON geometry พร้อม row linkage
- `TransportView` ถือ presentation state ผ่าน `useResultViewer`; default view คือ GIS
- future action เรียก `openResult(dataset, view)` เพื่อเลือกผล/มุมมองและเปิด panel โดยไม่ขึ้นกับ node เฉพาะชนิด; ยังไม่เชื่อมกับ execution/node output จริง
- ResultViewer เป็น controlled component; GISView/DataView/ChartView ยังคง mounted ระหว่างเปลี่ยนแท็บ/collapse/maximize และซ่อน inactive view ด้วย display/inert
- initial demo แยกไว้ใน `demoTransportResult.ts` ไม่ใส่ลง workflow JSON และไม่ persist เป็นผลคำนวณ
- DataView เป็น generic read-only table จาก fields/rows; ไม่ hardcode schema Trip Generation ใน renderer และไม่อ่าน CSV/Excel
- GISView ยังเป็น placeholder; ChartView เป็น placeholder พร้อมคำอธิบาย Bar/Line/Scatter/Histogram ที่ไม่ใช่ fake controls เนื่องจากยังไม่มี chart library และห้ามเพิ่ม dependency ในรอบนี้
- layout collapse/maximize/resize เดิมคงไว้ พร้อมจับ pre-maximize scroll ก่อนเปลี่ยน layout/state, reset/restore scroll และ inert cover สำหรับ panel ที่ถูก maximize บัง
- Result Viewer หยุด Delete/Backspace propagation เพื่อป้องกัน selected canvas node ถูกลบขณะโฟกัสอ่าน result; ไม่เปลี่ยน Chat behavior

demo 3 rows ใช้ค่าที่ผู้ใช้ให้มาและติดป้าย **demo, not model output**; TAZ `001`–`003` เก็บเป็น string ไม่แปลงเป็น number ไม่สร้าง node/geometry ปลอม

### Checklist และ verification ของ Result Viewer

- [x] **RV1. Shared result contract + generic presentation state** — dataset/view state และ openResult API ไม่ผูกกับ model node
- [x] **RV2. ResultViewer + GIS/Data/Chart components** — controlled tabs, mounted representations, null/empty states, read-only Data และ honest GIS/Chart placeholders
- [x] **RV3. Explicit demo + result tests** — exact supplied 3-row dataset, stable row/field IDs, formatting และ reducer behavior; Transport tests รวมผ่าน 38/38 (ใหม่ 10)
- [x] **RV4. Frontend validation** — TypeScript/lint ผ่าน; frontend build 2,590 modules, dist 4,117.65 kB / gzip 1,590.35 kB
- [ ] **RV-V. Desktop/browser/native acceptance — ผ่านบางส่วน** — desktop release build ผ่านใน 2 นาที 04 วินาทีด้วย temporary target, executable ต้นทาง/ที่คัดลอกกลับ repository SHA256 ตรงกัน; browser จาก binary เดียวกันผ่าน defaultGIS, exact read-only demo 3rows/5fields, Chart placeholder, 3 mounted/1 visible, Data scroll retention, keyboard tabs, Delete/Backspace isolation, collapse/maximize/Escape, keyboard splitters/width restore, compact/short-window containment และ Chat/Files isolation; native GUI launch ผ่าน PID38024/window `thClaws` แต่ยังรอ manual mouse resize/drag จึงไม่ปิด acceptance ทั้งหมด

หลักฐานรอบล่าสุด: `--serve --port 18766` ใน `target/result-viewer-e2e`; compact scroll restore กลับใกล้เดิม `374 → 370` px ไม่ใช่ pixel-exact restore และสาเหตุส่วนต่างยังไม่ยืนยัน (อาจเป็น layout/focus clamping); pointer-drag call ไม่ทำให้ divider เปลี่ยนจึงยังไม่ถือว่าทดสอบ mouse drag ผ่านและไม่สรุปว่าเป็น app bug รายละเอียด/ค่า SHA256 และคำสั่ง native launch อยู่ใน Result Viewer verification ของ STATUS

source ใหม่ 7 ไฟล์: `ResultViewer.tsx`, `GISView.tsx`, `DataView.tsx`, `ChartView.tsx`, `transportResultTypes.ts`, `demoTransportResult.ts`, `useResultViewer.ts`; tests ใหม่ 2 ไฟล์: `transportResults.test.ts`, `transportResultState.test.ts`; แก้ TransportView และเอกสาร 2 ไฟล์ และนำ GISViewer เดิมออกหลังแยกหน้าที่ ไม่เพิ่มหรือ revert backend changes ของงานชุดก่อน

milestone นี้เป็น **presentation foundation เท่านั้น** ไม่ทำให้ model execution, input parsing, real GIS rendering, chart rendering หรือ artifact loading เสร็จ งาน integration จาก engine artifacts ยังอยู่ใน roadmap ภายหลัง และ 4V manual mouse acceptance เดิมยังคงค้าง

## Stable action IDs

| Modelling | Data source |
| --- | --- |
| `transport.trip_generation` | `data.shapefile` |
| `transport.trip_distribution` | `data.csv` |
| `transport.modal_split` | `data.geojson` |
| `transport.traffic_assignment` | `data.parquet` |
| `transport.transit_assignment` | |
| `transport.skim` | |

UI label เปลี่ยนได้โดยไม่เปลี่ยน `actionId`; หากเปลี่ยน ID ต้องมี migration

## Project schema v2 ที่ใช้ใน editor

node เก็บ `id`, `actionId`, `label`, `note`, `details`, `parameters`, optional `source` และ `outputNames`

edge อ้าง `{ nodeId, portId }` ทั้ง source/target ส่วน `ui.nodes` เก็บตำแหน่งและ `ui.viewport` เก็บ pan/zoom ไม่ส่ง XYFlow runtime fields เข้า workflow

ตัวอย่างนี้มี source node ครบ ไม่ใช่ edge ที่อ้างถึง node ซึ่งไม่ได้ประกาศ:

```json
{
  "schemaVersion": 2,
  "metadata": { "name": "Bangkok Base Model", "baseYear": 2025 },
  "workflow": {
    "nodes": [
      {
        "id": "data-1",
        "actionId": "data.csv",
        "label": "Base-year socioeconomic data",
        "note": "Source reference; not yet parsed",
        "details": "Example only: select a real file in the workspace.",
        "parameters": {},
        "source": {
          "kind": "file",
          "path": "C:/TransportWorkspace/data/socioeconomic.csv",
          "format": "csv",
          "dataType": "table.socioeconomic"
        },
        "outputNames": { "data": "Socioeconomic input" }
      },
      {
        "id": "generation-1",
        "actionId": "transport.trip_generation",
        "label": "Base-year trip generation",
        "note": "",
        "details": "",
        "parameters": {},
        "outputNames": { "productions": "Base-year productions" }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": { "nodeId": "data-1", "portId": "data" },
        "target": { "nodeId": "generation-1", "portId": "socioeconomic_data" }
      }
    ]
  },
  "ui": {
    "nodes": {
      "data-1": { "position": { "x": 40, "y": 80 } },
      "generation-1": { "position": { "x": 380, "y": 80 } }
    },
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

source path เป็นตัวอย่าง ไม่รับรองว่ามีไฟล์นั้นอยู่ `parameters: {}` ยังไม่ใช่ชุด parameters ที่พอรัน algorithm จริงได้

### Migration และ Save policy

1. เปิด v1 แล้ว migrate เฉพาะใน memory
2. map legacy action IDs และย้ายตำแหน่งไป `ui.nodes`
3. ใช้ explicit legacy port mapping; ถ้าไม่แน่ใจให้เก็บ connection เดิมพร้อม diagnostic ไม่เดาและไม่ลบ edge
4. เก็บ unknown node configuration เพื่อให้ตรวจ/ซ่อมได้ ไม่ drop ข้อมูลที่ไม่รู้จัก
5. Save ครั้งแรกหลัง migrate ต้องสร้าง v2 copy ใหม่ เก็บ v1 เดิมไว้
6. Save ปกติอัปเดตด้วย stable file ID และ backup bytes เดิมก่อน replacement
7. Save As Copy สร้าง unique ID ใหม่; display name ที่ชนกันไม่ควรทำให้ project อื่นถูกเขียนทับ
8. ทดสอบการ backup/replacement ล้มเหลวและ Windows file lock ว่าต้นฉบับยังอยู่

unknown/unmapped graph ที่ parser เก็บได้ยังต้อง fail structural validation ก่อน Run จนกว่าผู้ใช้แก้ ไม่ถือว่า migration แก้ความหมายของ workflow ให้แล้ว

## Data source และ input/output contract

### Data source UI

Create new data → Import data from source → เลือก workspace file → format → modelling data type → ชื่อ block

- formats: `.shp`, `.csv`, `.geojson`, `.parquet`
- logical data types: socioeconomic table, zones, trip ends, OD matrix, skim matrix, road/transit network, road/transit flows
- data block output port ID คือ `data`; type มาจาก `source.dataType`
- ไม่ให้เลือก `any` เป็น type ของ source ใหม่; legacy source ที่ยังไม่มี type ต้องให้ผู้ใช้กำหนด
- จำกัด path ด้วย workspace sandbox ใช้ IPC `transport_data_sources` แยกจาก shared Files messages
- ช่วงนี้เก็บ path/reference ไม่ parse/import เนื้อหา, ไม่ตรวจ CRS/columns, ไม่เรียก calculations

### Named port registry

ตัวอย่าง Traffic Assignment ใน source ปัจจุบัน:

```json
{
  "actionId": "transport.traffic_assignment",
  "inputs": [
    { "id": "demand", "label": "Road demand", "dataType": "matrix.od", "required": true },
    { "id": "network", "label": "Road network", "dataType": "network.road", "required": true }
  ],
  "outputs": [
    { "id": "link_flows", "label": "Road link flows", "dataType": "table.link_flows" },
    { "id": "skim", "label": "Skim matrix", "dataType": "matrix.skim" }
  ]
}
```

output หนึ่ง port เป็น input ของหลาย block ได้; input แต่ละ port มี binding เดียวผ่าน edge การเปลี่ยน output display name ไม่เปลี่ยน port ID

Block details ให้ตั้งชื่อ block/note/details/output names และเลือก compatible upstream output โดยไม่เอา model configuration ไปผูกกับ component-local state

**ขอบเขต contract:** registry นี้เพียงพอสำหรับ structural editor และ migration แต่ required/optional ports, capacities/free-flow-time representation และ parameter schemas ของ algorithm จริงต้องยืนยันด้วย model specification/regression data ก่อน engine milestone ไม่ถือว่าล็อก scientific model แล้ว

## Full-workflow runner protocol — proposed, ยังไม่ implement

แยกจาก local TG single-action prototype ที่ทดสอบแล้ว: prototype ไม่รับ project graph, ไม่มี DAG scheduling/JSONL node events และยังไม่มี Rust caller ตัวอย่างด้านล่างเป็น contract proposal ไม่ใช่ request ที่ส่งให้ prototype แล้วรันได้

Rust จะเรียก `python -m thclaws_transport.runner` ในระยะแรก และเปลี่ยนเป็น `thclaws-transport.exe` ภายหลังโดยใช้ JSON Lines stdin/stdout protocol เดิม

ต้องรองรับ **ทั้ง action และ workflow** ไม่ใช่มีแต่ `run_action` แต่ให้ UI เรียก `transport_run_workflow` โดยไม่มี request รูปแบบรองรับ

### Requests ที่ต้องกำหนด

- `run_action`: `protocolVersion`, `runId`, `nodeId`, `actionId`, parameters และ resolved input artifact references
- `run_workflow`: `protocolVersion`, `runId`, `projectSchemaVersion`, immutable `workflow` snapshot และ execution context ที่ Rust อนุญาต
- ไม่ส่ง `ui.nodes`/viewport ให้ execution engine
- runner เป็นเจ้าของ DAG scheduling และ artifact resolution; React ไม่เรียงหรือคำนวณ model steps เอง

ตัวอย่าง action request (artifact เป็น reference ไม่ใช่ matrix bytes ใน JSON):

```json
{
  "protocolVersion": 1,
  "type": "run_action",
  "runId": "run-123",
  "nodeId": "generation-1",
  "actionId": "transport.trip_generation",
  "parameters": {},
  "inputs": {
    "socioeconomic_data": {
      "artifactId": "source-1",
      "dataType": "table.socioeconomic",
      "format": "csv",
      "path": "data/socioeconomic.csv"
    }
  }
}
```

workflow request ต้องบรรจุ `workflow.nodes`/`workflow.edges` จาก snapshot ที่ผ่าน schema validation เช่น workflow ในตัวอย่าง v2 ด้านบน พร้อม context:

```json
{
  "protocolVersion": 1,
  "type": "run_workflow",
  "runId": "run-123",
  "projectSchemaVersion": 2,
  "workflow": { "nodes": [], "edges": [] },
  "execution": {
    "workspaceRoot": "C:/TransportWorkspace",
    "outputDirectory": ".thclaws/transport/runs/run-123"
  }
}
```

โครง request ว่างนี้มีไว้แสดง fields เท่านั้น; executor ต้อง reject empty workflow ไม่ถือว่า run สำเร็จ ปกติ caller ใส่ snapshot จริงแทน arrays ว่าง

### Events และ artifacts

ต้องมี started/progress/completed/failed ระดับ workflow และระดับ node โดย events มี `runId`; node events มี `nodeId` เพิ่ม เช่น:

```json
{"protocolVersion":1,"type":"started","runId":"run-123"}
{"protocolVersion":1,"type":"node_started","runId":"run-123","nodeId":"generation-1"}
{"protocolVersion":1,"type":"progress","runId":"run-123","nodeId":"generation-1","progress":0.5,"message":"Calculating productions"}
{"protocolVersion":1,"type":"node_completed","runId":"run-123","nodeId":"generation-1","outputs":{"productions":{"artifactId":"a-123","dataType":"table.trip_ends","format":"parquet","path":".thclaws/transport/runs/run-123/productions.parquet"}}}
{"protocolVersion":1,"type":"completed","runId":"run-123","artifactIds":["a-123"]}
```

- downstream `inputs[portId]` resolve จาก upstream `outputs[portId]` โดย runner ตาม edges
- manifest ควรเก็บ artifact ID, producer node/port, data type, format, path และ metadata ที่จำเป็น เช่น units/CRS/shape
- paths resolve ภายใน workspace/output roots ที่อนุญาต; source import ต้องผ่าน engine validation ใหม่
- structured `failed` มี error code/message และ nodeId ถ้ามี ไม่ส่ง raw traceback เป็น UI error
- กำหนด timeout, cancellation, duplicate run IDs, partial artifacts และ terminal-event semantics พร้อม tests ก่อนล็อก protocol
- stdout สงวนให้ JSONL events; diagnostic logging ไป stderr
- ตัวอย่างนี้เป็น proposal ยังไม่มี full-workflow JSONL runner หรือ execution IPC; standalone TG local runner/artifacts อยู่คนละขั้นและยังไม่ถูกส่งเข้าแอป

## Foundation build checklist

เครื่องหมาย `[x]` ใน tasks 1–4 หมายถึง **implementation ลงแล้ว** ไม่ใช่การรับรองว่า verification ทุกข้อผ่าน การปิด milestone ต้องดู Verification ใน [TRANSPORT_STATUS.md](./TRANSPORT_STATUS.md)

- [x] **1. Engine-neutral schema v2 และ stable action IDs** — `workflow/ui` แยกกัน, metadata/note/details/output names เป็น JSON; ไม่ import XYFlow ใน domain types
- [x] **2. Migration v1 → v2 และ safe Save/Open** — map IDs/ports อย่างชัดเจน, เก็บ unknown edges, first migration save เป็น copy; stable IDs, backups, staged replacement และ Save As Copy
- [x] **3. Structural multi-port registry และ validation** — named ports, compatible binding, required input, broken/unmapped edge, duplicate input และ cycle checks; algorithm parameter schema ยังไม่ final
- [x] **4. Canvas/state adapter พร้อม Data/Details UI** — controlled XYFlow, source reference wizard, reusable outputs/input selectors, names/notes/details; preserve tab state และ scoped overlays
- [ ] **4V. ปิด verification งานชุดที่ 1 — ผ่านบางส่วน ยังรอ manual acceptance** — ผ่าน fixtures/tests, TypeScript/lint, frontend/desktop builds, native GUI launch และ browser `--serve` จาก binary เดียวกัน: CSV/data details, input/output bindings, Save/update-backup/Save As/Open, migration-copy โดย v1 hash ไม่เปลี่ยน, repeated tab-switch/no-leak, GIS maximize/Escape, keyboard splitters และ compact 900px; ยังต้องยืนยัน mouse drag nodes/connections/splitters ใน native GUI จึงไม่ทำเครื่องหมาย complete ในตอนนี้
- [x] **5. สร้าง Python source-package scaffold** — `transport-engine/pyproject.toml`, `src/thclaws_transport/`, version metadata และ package tests ลงแล้วพร้อม copied TG ตาม scope ที่ผู้ใช้ปรับ; tests 33/33 ผ่าน ไม่ได้หมายถึง wheel/binary build หรือ full-workflow integration
- [ ] **6. ล็อก protocol models/JSONL codec** — ทั้ง `run_action`/`run_workflow`, per-node events, artifacts, versions/errors/cancellation; golden fixtures และ invalid-message tests
- [ ] **7. สร้าง registry และ runner entrypoint — เริ่มบางส่วน** — local prototype dispatch `transport.trip_generation` action เดียวและ reject action อื่น; ยังต้องทำ versioned full-workflow protocol/registry และ stub integration tests ไม่ถือว่า task runner ทั้งหมดเสร็จ
- [ ] **8. เพิ่ม Rust runner bridge** — engine discovery, subprocess lifecycle, input/output codec, timeout/cleanup, safe execution paths; Python กับ test executable ใช้ contract เดียวกัน
- [ ] **9. Execution IPC และ Run state** — `transport_run_workflow` และ correlated events; idle/running/succeeded/failed; กัน run ซ้อนและตอบ UI เฉพาะ Transport
- [ ] **10. Workflow executor ภายใน engine** — validate DAG, dependency ordering, resolve artifacts, node progress, failure/cancellation policy; test synthetic multi-node workflows
- [ ] **11. End-to-end stub run** — saved project → GUI → Rust → Python → events/results UI; Windows smoke test, tab isolation, no direct Python call ใน React
- [ ] **12. Packaging abstraction contract tests** — เปลี่ยน Python runner เป็น compiled test executable โดยไม่แก้ project/action IDs/frontend IPC

ผู้ใช้ปรับลำดับให้ standalone TG จริงเข้ามาทดสอบใน task 5/บางส่วนของ 7 ก่อน; task 6 และส่วนที่เหลือของ 7 ยังต้องตกลง messages/golden fixtures ก่อนผูก UI Run กับ process จริง ไม่ปิด tasks 8–12 จากผล local TG run

## Repository ปัจจุบันและ target สำหรับ integration milestone

```text
thClaws/
├─ frontend/src/components/transport/
├─ crates/core/src/
│  ├─ transport_project.rs
│  └─ transport_runner.rs       # อนาคต
└─ transport-engine/            # เริ่ม TG-only prototype แล้ว
   ├─ pyproject.toml
   ├─ REVIEW_EBUMPY.md
   ├─ reference/                # ignored read-only copies + manifests
   ├─ local-fixtures/           # ignored TG2032 input/expected copies
   ├─ src/thclaws_transport/
   │  ├─ __init__.py
   │  ├─ runner.py             # local single-action ไม่ใช่ full JSONL workflow
   │  └─ generation/           # copied formula + explicit-input adapter
   └─ tests/
```

`protocol.py`, general registry/workflow executor และ adapters ของ distribution/skim/modal split/traffic assignment/transit assignment ยังเป็นงานอนาคต ไม่มี implementation ใหม่ของโมดูลเหล่านั้นในรอบนี้

## Model implementation milestones

เริ่ม standalone TG ตาม scope ที่ผู้ใช้อนุมัติพร้อม copied inputs/expected outputs แล้ว; การเชื่อม algorithm เข้าสู่ UI/full workflow ยังต้องผ่าน runner/stub contract และยืนยัน specification ของแต่ละโมดูลก่อน:

- [ ] File/data adapters: CSV, Shapefile, GeoJSON, Parquet พร้อม content/schema/CRS validation
- [x] Trip Generation standalone prototype — copied formula/fixture, explicit-input adapter/local runner และ 2032 regression/safety tests ผ่าน; ไม่มี GUI integration
- [ ] Trip Generation scientific acceptance และ UI executable contract — calibration/port mapping/integration ยังไม่เสร็จ ไม่ปิดจาก historical reproduction
- [ ] Trip Distribution พร้อม matrix validation
- [ ] Modal Split พร้อม utility/choice contract
- [ ] Skim พร้อม network contract
- [ ] Traffic Assignment พร้อม convergence/progress
- [ ] Transit Assignment พร้อม transit-network contract
- [ ] Result manifest สำหรับ table, matrix, network และ GIS layers
- [ ] GIS integration จาก artifacts ที่ engine ส่งกลับ
- [ ] Chat tools: read/edit/validate/run Transport Project
- [ ] MCP หลัง project/execution APIs เสถียร
- [ ] Binary packaging และ engine-side license verification

ทุก algorithm ต้องมี parameter/port schema, deterministic fixtures หรือ tolerance, structured errors, output metadata และ regression tests ห้ามทำ placeholder calculation ให้ดูเหมือนรันแบบจำลองจริงสำเร็จ

## งานถัดไปเมื่อกลับมาพัฒนา

1. รักษา TG-only tests 52/52, 2032 golden regression และ all-years integrity/accounting/path/no-overwrite checks เป็น gate โดยใช้ destination copies เท่านั้น ไม่ขยายไปโมดูลอื่น
2. ทบทวน scientific warnings และ executable TG input/output contract กับผู้ใช้; input keys ของ prototype ยังไม่ใช่ port mapping final ของ UI
3. ปิดส่วนที่เหลือของ RV-V/4V: manual mouse resize/drag ใน native GUI; build/browser/native launch เดิมผ่านแต่ไม่ได้ทดสอบซ้ำใน standalone TG iteration
4. ไม่ทำ schema tasks 1–2 ซ้ำ: ทำ full protocol + registry/stub integration ส่วนที่เหลือของ tasks 5–7 แล้วเชื่อม Rust/UI Run ตาม tasks 8–12
5. ผลจริงค่อยเข้าสู่ Result Viewer ผ่าน artifact/shared dataset contract หลัง integration verification ไม่ใช้ demo แทนผลคำนวณ

Definition of done ก่อนเชื่อม algorithm จริงให้ UI/full workflow ใช้งาน: v2/migration tests ผ่าน, safe Save/Open ผ่าน, named port contract ยืนยันกับโมดูล, runner protocol versioned, Rust→stub end-to-end ผ่าน และไม่มี Python implementation detail ใน React การคัดลอก TG มาทดลองใน isolated package ตอนนี้ไม่ใช่การข้าม gates เหล่านี้และไม่รับรอง production/calibration readiness
