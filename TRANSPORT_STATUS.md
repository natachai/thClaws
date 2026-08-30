# THClaws Development Status

อัปเดตล่าสุด: 31 สิงหาคม 2026

Branch: `transport-ui`

ฐานก่อนงาน foundation ชุดที่ 1: commit `69e33e9`

## สรุป iteration ล่าสุด — Trip Generation ครบ 8 ปี

เพิ่ม standalone TG batch ปี **2022, 2027, 2032, 2037, 2042, 2047, 2052, 2057** จาก demographic/attraction inputs ของแต่ละปีจริง ไม่ใช้ DBF ปีเดียวแทนทุกปี และไม่เปลี่ยน formulas

- ผู้ใช้อนุญาต copy inputs ที่จำเป็นจาก `planning/` และ `Project/` นอก eBUMpy; originals read-only ไม่รัน original scripts
- `transport-engine/local-fixtures/trip-generation-all-years/` มี 21 inputs / 7,523,177 bytes: 16 year-specific DBFs + 3 planning coefficient files + 2 reviewed eBUMpy settings snapshots พร้อม source/hash manifest
- ทุกปี preflight ผ่าน: demographic 1,778 zones / attraction 1,805 records; final tests **52/52** ผ่าน (33 เดิม + 19 batch, no skips, 5.032 s), saved batch **8 completed / 0 failed**
- แต่ละ batch มี `summary.json`/`summary.md` ใน directory ใหม่ และแต่ละปีมี run UUID/artifacts directory ใหม่แยกกัน ไม่เขียนทับผลเก่า
- ไม่ install, ไม่แก้ frontend/Rust, ไม่ build GUI; Run Workflow ในแอปยัง validate-only, Result Viewer ยัง demo และ full-workflow bridge/calibration ยังไม่เสร็จ

รันจาก `transport-engine/`: `python -B scripts/run_trip_generation_all_years.py` แล้วตรวจ saved outputs ด้วย `python -B scripts/verify_trip_generation_batch.py --summary runs/<batch-id>/summary.json` และ originals/copies ด้วย `scripts/copy_trip_generation_all_years.ps1 -VerifyOnly` รายละเอียดใน [engine README](./transport-engine/README.md)

ผล batch ล่าสุด: [summary.md](./transport-engine/runs/trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4/summary.md) / [summary.json](./transport-engine/runs/trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4/summary.json) รวม ownership counts และคำเตือนรายปี ตรวจ 56 artifacts / 40 CSVs ผ่าน hash/size/fields/rows/finite numbers/P–A balance/sums ตาม tolerance; verification report อยู่ directory เดียวกันชื่อ `verification-8ad9ee7ca2e84593b44e718315677e29.json`

ปี 2032 เทียบ 5 CSV SHA256 ตรง goldens และ totals/QA เท่ากัน; อีก 7 ปีผ่าน integrity/accounting checks **ไม่ใช่ golden/calibration/Cube verification** Inputs 21 files originals/copies SHA256/size/mtime และ TG source/copies 128 files ตรวจหลังรันไม่เปลี่ยน Run ทดสอบก่อนหน้าเก็บไว้ไม่ overwrite; ใช้ batch `ecb56920e54b47769121e6cdf4d2e2f4` เป็นรอบส่งมอบล่าสุด ผล 2032 iteration เดิมด้านล่างคงไว้เป็น historical evidence

## หลักฐาน iteration ก่อนหน้า — standalone Trip Generation 2032

เริ่มแยก engine จริงเป็น Python package `thclaws_transport` ใน `transport-engine/` โดยนำเข้า **Trip Generation เท่านั้น** จาก eBUMpy เป็น bounded standalone prototype ไม่ใส่ algorithms ใน React/Rust และไม่เชื่อม GUI ในรอบนี้

- คัดลอก TG เต็มชุด 128 files / 30,005,543 bytes ไป `transport-engine/reference/trip-generation/` ยกเว้น caches; SHA256 manifests เก็บ provenance และ conflict copies โดยไม่ merge
- คัดลอก fixture 2032: 7 inputs / 952,522 bytes และ 8 historical expected files / 6,345,448 bytes; ผลใหม่เทียบกับ historical goldens ผ่าน
- canonical `generation/calculation.py` byte-identical; explicit-input adapter และ local single-action runner `transport.trip_generation` ลงและทดสอบแล้ว
- ใช้ Python 3.11.9 standard library; ไม่ติดตั้ง dependencies เพิ่ม ไม่ compile engine binary
- **Engine tests 33/33, 2032 regression และ standalone smoke run ผ่าน**; CSV 5 outputs SHA256 เหมือน goldens ทุก byte, totals/QA JSON เท่ากันเชิงข้อมูล รายละเอียด copy/contract/scientific warnings อยู่ใน [REVIEW_EBUMPY.md](./transport-engine/REVIEW_EBUMPY.md)

ผู้ใช้เลือกรับ real TG เข้ามาทดลองแยกก่อน full stub/Rust milestone ไม่ถือว่า full-workflow runner/JSONL/Rust bridge เสร็จ ไม่มี frontend/backend edits หรือ GUI build ใหม่ใน iteration นี้ งาน backend persistence/source browser เดิมยังอยู่

**UI Run Workflow ยัง validate-only และ Result Viewer ยังเป็น demo** ไม่สามารถกด Run ใน Transport แล้วเรียก prototype นี้ได้ ยังต้องออกแบบ mapping ของ TG inputs, artifact contract และเชื่อม Rust ใน milestone ถัดไป

## สรุป iteration ก่อนหน้า — Result Viewer

เปลี่ยน panel ขวาจาก GIS Viewer เป็น **Result Viewer** ที่มี GIS / Data / Chart โดยใช้ dataset เดียวกันทั้งสามมุมมอง ไม่ผูกกับ node ชนิดใดโดยเฉพาะ

Source, TypeScript/lint, tests 38/38, frontend/desktop builds, browser checks และ native GUI launch ของ iteration นี้ผ่านแล้ว ยังเหลือ manual mouse-drag acceptance ตามตาราง Verification ด้านล่าง **ไม่ใช้ผล GUI/build จากงานชุดที่ 1 มาแทนผลรอบใหม่**

## สรุปงานชุดที่ 1

กำลังส่งมอบ Transport Project foundation: schema v2, migration v1, named input/output ports, Create new data, รายละเอียดแต่ละ block และ safe Save/Open โดยคง Chat กับ Transport เป็นคนละ workspace

**หลักฐานงานชุดที่ 1:** implementation, automated checks, frontend/desktop build, browser end-to-end checks และ native GUI launch ของงานชุดที่ 1 ผ่านแล้ว ยังเหลือ manual acceptance ของ mouse drag ตามส่วน Verification งานชุดที่ 1 ด้านล่าง จึงยังไม่ปิด verification ทั้ง milestone

ปุ่ม **Run Workflow** ตรวจโครงสร้างเท่านั้น ไม่ได้คำนวณหรือสร้างผลลัพธ์จริงในแอป แม้ตอนนี้เริ่มทำ standalone TG engine แยกแล้ว งานชุดที่ 1 และ Result Viewer ยังไม่ได้เชื่อม execution

## Workspace และ UI ปัจจุบัน

### Chat

- เป็น Chat UI เดิม ไม่ได้เพิ่ม Transport panel เข้า Chat
- Transport root ซ่อนทั้งภาพและ interaction เมื่อ inactive โดยเก็บ component/project state ไว้
- dialog ของ Transport อยู่ภายใน Transport root ไม่ใช้ portal หรือ fixed/global overlay
- Chat/Agent ยังไม่สามารถอ่าน แก้ หรือรัน Transport Project ผ่าน tools ได้

### Transport

ยังมีสาม panel ใน layout เดิม: Node Library, Workflow Canvas และ Result Viewer ซึ่งมี GIS / Data / Chart tabs:

- splitter ปรับขนาด panel, collapse/restore, workflow focus และ Result Viewer maximize/restore
- canvas รองรับ drag/connect/delete, zoom และ fit workflow
- model nodes: Trip Generation, Trip Distribution, Modal Split, Traffic Assignment, Transit Assignment, Skim
- ไม่เพิ่ม Input Data แบบเดิมกลับมา

#### สร้าง Data block

1. Node Library หมวด Data → **Create new data**
2. เลือก **Import data from source**
3. เลือก source file ใน workspace ปัจจุบัน
4. เลือก format: Shapefile, CSV, GeoJSON หรือ Parquet
5. เลือก modelling data type และตั้งชื่อ data block
6. กด **Create data block**

ข้อจำกัดที่ตั้งใจไว้ใน milestone นี้:

- เก็บ **source reference เท่านั้น**: absolute file path, format และ logical data type
- ยังไม่ parse/copy/import เนื้อหาข้อมูล ไม่ตรวจคอลัมน์หรือ CRS และไม่คำนวณ
- browser จำกัดขอบเขตตาม workspace sandbox; ไม่ใช่ file picker สำหรับทุก directory ในเครื่อง
- ไม่รองรับ URL, database หรือ cloud source ในรอบนี้
- Shapefile เลือก `.shp`; ต้องเก็บ companion files ไว้ด้วยกัน แต่ยังไม่ตรวจ `.dbf`/`.shx` ให้
- logical data type เป็นข้อมูลที่ผู้ใช้ระบุ ไม่ใช่ผลตรวจเนื้อหาไฟล์

#### Inputs, outputs และรายละเอียด block

- แต่ละ block มี **Block details** สำหรับแก้ชื่อ, Note และ Details
- node มีหลาย named input/output ports ตามชนิดโมดูล
- ตั้งชื่อ output ได้; block อื่นเลือก output นี้เป็น input ผ่าน dropdown หรือเชื่อม handles บน canvas
- dropdown เสนอเฉพาะ output จาก block อื่นที่ data type เข้ากันได้
- input หนึ่ง port รับหนึ่ง binding; output เดียวใช้ร่วมกันได้หลาย downstream blocks
- การเชื่อมใหม่ป้องกัน self-connection, incompatible ports และ cycle
- connection เก่าที่ผิดชนิดหรือแปลง port ไม่ได้ยังถูกเก็บไว้และแสดงปัญหา ไม่ลบ/เดาให้เงียบ ๆ
- output ของ model เป็น **planned reference** ยังไม่ใช่ผลคำนวณ
- เปลี่ยนชื่อ/note/details/output name แล้วต้องกด Save เพื่อเขียน project ลง disk

## Result Viewer architecture

- `TransportView` เป็นเจ้าของ presentation state ผ่าน `useResultViewer`: current dataset และ selected view ซึ่งเริ่มต้นที่ `gis`
- `ResultViewer` รับ dataset/view ผ่าน props; GISView, DataView และ ChartView ใช้ dataset object เดียวกัน ไม่มี fetch หรือ demo state ของตัวเอง
- ทุก view ยังคง mounted เมื่อสลับแท็บ, collapse หรือ maximize; inactive view ใช้ `display: none` และ `inert` จึงไม่รับ interaction
- `openResult(dataset, view)` เปลี่ยน dataset/view และเปิดเผย panel ได้ เป็นจุดเชื่อมสำหรับ future node actions โดยไม่ผูก Result Viewer กับ Trip Generation หรือ node เฉพาะชนิด
- output dataset แยกจาก `TransportProject` JSON: demo/selected result ไม่ถูก Save ลง workflow และไม่ได้อ้างว่ามี model run แล้ว
- compact maximize จับ scroll position **ก่อนเปลี่ยน layout/state** เพื่อไม่ให้ grid reflow clamp ค่าไปก่อน, reset scroll เพื่อแสดง panel เต็มพื้นที่ แล้ว restore scroll เมื่อออกจาก maximize; panel ที่ถูกบังเป็น `inert`
- Result Viewer หยุดการส่งต่อ Delete/Backspace เพื่อไม่ให้ keyboard handler ของ canvas ลบ node ที่เลือกอยู่ขณะผู้ใช้โฟกัสอ่านผลใน Data/Result Viewer โดยไม่เปลี่ยนพฤติกรรม Chat
- ใช้ theme เดิม ไม่เพิ่ม design system, chart dependency หรือ backend

### Shared result contract

`TransportResultDataset` รองรับ:

- `id`, `name`, `origin: "demo" | "model"`
- optional `sourceNodeId` / `sourcePortId` สำหรับเชื่อมผลจริงในอนาคต
- `fields`: stable field ID, label, string/number/boolean type และ optional unit
- `rows`: stable row ID และ `values` ที่ใช้ field IDs เป็น keys
- optional GeoJSON `geometry` พร้อม `rowIdProperty` สำหรับเชื่อม feature กับ row ID และ optional CRS

geometry contract ยังไม่ใช่ GIS renderer หรือ GeoJSON validation ที่ทำงานแล้ว ไม่มีการคำนวณผลใน contract นี้

### สิ่งที่แต่ละ view แสดงตอนนี้

- **GIS:** placeholder เดิมสำหรับ road networks, zones, skim results และ assignment outputs; ยังไม่มี MapLibre/QGIS
- **Data:** generic read-only table สร้าง columns จาก fields และ rows จาก shared dataset ไม่ hardcode node/TAZ schema ภายใน renderer; รองรับ null/empty state
- **Chart:** placeholder เท่านั้น มีคำอธิบาย Bar/Line/Scatter/Histogram แบบไม่ใช่ปุ่ม ไม่มี chart ที่ render หรือการคำนวณ เนื่องจากยังไม่มี chart library ใน dependencies และรอบนี้ไม่เพิ่ม dependency

ไม่มี CSV/Excel loading, file parsing, table editing, export หรือผลคำนวณจริงใน Result Viewer รอบนี้ แยกจาก Create new data ซึ่งเก็บเพียง source reference อยู่แล้ว

initial demo ชื่อ `Trip generation by zone (demo)` แยกไว้ใน `demoTransportResult.ts` และติดป้าย demo ชัดเจน ไม่สร้าง source node หรือ geometry ปลอม:

| TAZ | Population | Employment | Production | Attraction |
| --- | ---: | ---: | ---: | ---: |
| 001 | 12,430 | 8,240 | 4,821 | 3,921 |
| 002 | 9,821 | 11,302 | 3,824 | 5,127 |
| 003 | 18,231 | 7,921 | 6,120 | 4,011 |

ข้อมูลเป็นตัวอย่างที่ให้มา ไม่ใช่การอ่านไฟล์หรือ output ของ Run Workflow; TAZ เก็บเป็น string เพื่อคงเลขศูนย์นำหน้า และ row IDs เป็น `taz-001`, `taz-002`, `taz-003`

## Project architecture

`TransportView` ประกอบ UI และใช้ `useTransportProject` ดูแล project state, editing, persistence IPC และ validation กลาง

schema v2 แยก engine data ออกจาก React Flow:

```text
{
  schemaVersion: 2,
  metadata: { name, baseYear?, region?, updatedAt? },
  workflow: {
    nodes: [{ id, actionId, label, note, details, parameters, source?, outputNames }],
    edges: [{ id, source: { nodeId, portId }, target: { nodeId, portId } }]
  },
  ui: {
    nodes: { [nodeId]: { position: { x, y } } },
    viewport?: { x, y, zoom }
  }
}
```

- `transportTypes.ts` เป็น engine-neutral contract ไม่ import React/XYFlow types
- `transportFlow.ts` เป็น adapter ระหว่าง project schema กับ XYFlow
- ใช้ stable action IDs เช่น `transport.trip_generation`, `transport.traffic_assignment`, `data.csv`
- `parameters` เป็น JSON object สำหรับรองรับอนาคต; **parameter schema และ algorithm contracts ยังไม่ใช่ข้อกำหนด final ของ engine**
- input/output registry ปัจจุบันเป็น structural editor contract ไม่ใช่คำรับรองว่า workflow พร้อมคำนวณจริง

source reference ตัวอย่าง:

```json
{
  "kind": "file",
  "path": "C:/Users/natachai/Dropbox/thClaws-transport-dev/thClaws/data/socioeconomic.csv",
  "format": "csv",
  "dataType": "table.socioeconomic"
}
```

path ในตัวอย่างเป็นตัวอย่างเท่านั้น ต้องเลือกไฟล์จริงใน workspace ของผู้ใช้

## Migration และการบันทึกอย่างปลอดภัย

- อ่าน schema v1 แล้ว migrate เป็น v2 **ใน memory**; ไม่แก้ไฟล์ต้นฉบับจากการ Open
- ย้ายตำแหน่ง node ไป `ui.nodes`, แปลง legacy IDs เป็น namespaced action IDs
- แปลง legacy handles เฉพาะเมื่อระบุ port ได้ชัดเจน; ข้อมูลกำกวมหรือ unknown action/port ถูกเก็บพร้อมคำเตือนสำหรับซ่อม
- Save ครั้งแรกหลัง migrate สร้าง **v2 copy ใหม่** โดยเก็บไฟล์ v1 เดิมไว้
- Save project เดิมใช้ stable file ID ไม่เอาชื่อที่แสดงไปเดาว่าจะเขียนทับไฟล์ใด
- **Save As Copy** สร้าง ID ใหม่ แม้ชื่อ project เหมือนกัน
- ก่อน update ไฟล์เดิม สร้าง backup ของ bytes เดิมใต้ `.thclaws/transport/projects/backups/`
- เขียนไฟล์ชั่วคราวใน directory เดียวกัน, flush แล้ว replace; ไม่ลบไฟล์เก่าก่อนเขียนใหม่
- new save ใช้ no-clobber เพื่อไม่เขียนทับไฟล์ชื่อชน
- ถ้า backup หรือ replacement ล้มเหลว ให้รายงาน error และเก็บไฟล์เดิมไว้
- รองรับ request IDs เพื่อแยก Transport IPC ออกจาก Files และไม่ให้ response เก่าทับ edits ใหม่

project files ยังอยู่ใต้ `.thclaws/transport/projects/` ใน workspace ปัจจุบัน

## Backend เชื่อมอะไรแล้วบ้าง

เชื่อมแล้ว:

- `transport_project_list`, `transport_project_save`, `transport_project_load`
- `transport_data_sources` สำหรับ browse source file references ภายใต้ sandbox

ยังไม่เชื่อม:

- UI → standalone Python engine / Rust execution bridge (TG prototype แยกอยู่ใน `transport-engine/`)
- run/progress/result events
- Chat control, GIS results, MapLibre/QGIS, MCP

ดังนั้นคำว่า “backend ยังไม่เชื่อม” ไม่ถูกต้องทั้งหมด: persistence และ source browser เชื่อม Rust แล้ว แต่ **UI ยังไม่เชื่อม calculation execution และ Chat tools ยังไม่มี**

## Verification — standalone TG 2032 iteration ก่อนหน้า

| รายการ | สถานะรอบนี้ |
| --- | --- |
| Original eBUMpy source | Read-only; ไม่ execute/import/เขียน cache หรือแก้ต้นฉบับ |
| Full TG snapshot | 128 files, SHA256 manifest; canonical formula copy เหมือนเดิมทุก byte |
| Broad review archive ก่อนจำกัด scope | 186 source/config/docs + 15 fixture + 3 runtime = 204 selected copy records; อยู่ใน ignored reference ไม่ใช่การ implement โมดูลอื่น |
| Destination package/adapter/action runner tests | ผ่าน `python -B scripts/test_engine.py`: 33/33, no skips, 4.241 s |
| 2032 output regression + invalid-input/path/no-overwrite tests | ผ่าน: CSV 5 files SHA256 ตรง goldens และ totals/QA JSON semantic equality; ปฏิเสธ abbreviated workspace override ด้วย |
| Standalone run/artifacts | ผ่าน run `trip-generation-416ef99a71ba4a1eb2c1df1d07976dd8` (~1.5 s): P/A/zonal 1,778 rows ต่อ table, long 28,448, age-long 85,344 |
| Original/copy verification หลังรัน | TG 128 files ต้นฉบับ/สำเนา SHA256 ไม่เปลี่ยน; initial inventory 3,249 entries metadata และ selected 204 hashes ไม่เปลี่ยน |
| Package wheel/binary build | ไม่ได้ทำ; source package import/run ผ่านโดยไม่ install, Python 3.11.9/setuptools 65.5.0 มีแล้ว แต่ wheel ไม่มี |
| Frontend/Rust/GUI checks ของ iteration นี้ | ไม่ได้รันใหม่ — ไม่เปลี่ยน UI/backend; หลักฐาน build ก่อนหน้าแยกด้านล่าง |

Historical TG fixture มี 1,778 zones, age mismatch เกิน 5% 1 zone และ Furness max column residual 1.360739 หลัง 5 iterations; runner แสดง warnings พร้อม legacy blank-to-zero 60 survey/540 seed cells และ tour input ที่ไม่ได้ใช้คำนวณ ไม่แก้สูตรเพื่อซ่อนข้อจำกัด Reproduce output เดิมได้ไม่เท่ากับ scientific calibration หรือ full Cube parity ผ่าน Task 4A/Task 5 ของต้นฉบับยังไม่ถูกปิดโดยงานนี้

คำสั่งจาก `transport-engine/`: `python -B scripts/test_engine.py` และ `python -B scripts/run_trip_generation.py` รันเฉพาะ destination copies ดูคำสั่ง/contract ใน [engine README](./transport-engine/README.md)

## ไฟล์หลัก

- `transport-engine/REVIEW_EBUMPY.md` — review, source-copy provenance และขอบเขต standalone TG
- `transport-engine/src/thclaws_transport/generation/` — copied calculation และ destination input adapter; 2032 regression ผ่าน
- `transport-engine/src/thclaws_transport/runner.py` — local single-action runner ไม่ใช่ full-workflow JSONL/Rust integration

- `frontend/src/components/TransportView.tsx` — composition, layout และ scoped dialogs
- `frontend/src/components/transport/ResultViewer.tsx` — common result header, controlled GIS/Data/Chart tabs และ mounted-view lifecycle
- `frontend/src/components/transport/GISView.tsx` — spatial representation placeholder
- `frontend/src/components/transport/DataView.tsx` — generic read-only result table
- `frontend/src/components/transport/ChartView.tsx` — chart placeholder โดยไม่เพิ่ม chart dependency
- `frontend/src/components/transport/transportResultTypes.ts` — shared result dataset contract และ display formatter
- `frontend/src/components/transport/demoTransportResult.ts` — explicit demo dataset แยกจาก workflow
- `frontend/src/components/transport/useResultViewer.ts` — presentation reducer และ `openResult(dataset, view)`
- `frontend/src/components/transport/useTransportProject.ts` — project editing/state และ persistence IPC
- `frontend/src/components/transport/transportConfirm.ts` — ยืนยันก่อนทิ้ง unsaved changes ผ่าน native desktop/browser ตามแพลตฟอร์ม
- `frontend/src/components/transport/NodeLibrary.tsx` — Create new data และ modelling components
- `frontend/src/components/transport/CreateDataDialog.tsx` — source reference wizard
- `frontend/src/components/transport/TransportNodeDetails.tsx` — block notes/details, named outputs และ input bindings
- `frontend/src/components/transport/WorkflowCanvas.tsx` — controlled XYFlow canvas
- `frontend/src/components/transport/TransportNode.tsx` — block rendering และ named handles
- `frontend/src/components/transport/transportTypes.ts` — schema v2 และ structural port registry
- `frontend/src/components/transport/transportProject.ts` — parser และ legacy migration
- `frontend/src/components/transport/transportFlow.ts` — XYFlow adapter
- `frontend/src/components/transport/transportValidation.ts` — structural validation
- `frontend/src/components/transport/TransportProjectToolbar.tsx` — New/Open/Save/Save As Copy/Validate/Run
- `crates/core/src/transport_project.rs` — loss-resistant workspace JSON persistence
- `crates/core/tests/transport_project.rs` — Windows-compatible dedicated persistence tests
- `crates/core/src/ipc.rs` — project และ source-browser IPC

## ขอบเขตไฟล์ที่เปลี่ยนใน Result Viewer iteration

สร้าง source files 7 ไฟล์ใต้ `frontend/src/components/transport/`: `ResultViewer.tsx`, `GISView.tsx`, `DataView.tsx`, `ChartView.tsx`, `transportResultTypes.ts`, `demoTransportResult.ts`, `useResultViewer.ts`

สร้าง tests 2 ไฟล์: `frontend/tests/transportResults.test.ts`, `frontend/tests/transportResultState.test.ts`

แก้ไข `frontend/src/components/TransportView.tsx` และเอกสาร `TRANSPORT_STATUS.md`, `TRANSPORT_ENGINE_ROADMAP.md`; นำ `frontend/src/components/transport/GISViewer.tsx` เดิมออกเพราะแยกหน้าที่เป็น ResultViewer + GISView แล้ว ไม่ได้เอา GIS representation ออก

เทียบกับจุดเริ่ม Result Viewer iteration: **ไม่มี backend, App.tsx, NodeLibrary.tsx, WorkflowCanvas.tsx หรือ package.json เปลี่ยนเพิ่ม** โดยตรวจ hashes ไว้ ทั้งนี้ Rust persistence/source-browser changes ของงานชุดที่ 1 ยังคงอยู่ ไม่ได้ลบหรือ revert

## Verification — Result Viewer iteration ก่อนหน้า

| รายการ | สถานะ iteration นี้ |
| --- | --- |
| Transport tests: `npm run test:transport` | ผ่าน 38/38: ชุดเดิม 28 และ result dataset/state ใหม่ 10 |
| TypeScript project check | ผ่าน |
| Transport-scoped ESLint | ผ่าน |
| Frontend production build | ผ่าน; 2,590 modules, dist 4,117.65 kB / gzip 1,590.35 kB |
| Desktop GUI release build | ผ่านใน 2 นาที 04 วินาที ด้วย temporary target directory; executable คัดลอกกลับ repository และ SHA256 ตรงกัน |
| GIS/Data/Chart switching และ shared-dataset display | ผ่านใน browser จาก binary รอบนี้: ทั้งสาม views mounted โดยมองเห็นครั้งละหนึ่ง view |
| Default GIS / keyboard tabs / preserved view state | ผ่านใน browser รวม Home key และ Data scroll retention |
| Collapse/maximize/Escape/keyboard splitters และ compact scroll restore | ผ่านใน browser ตามรายละเอียดด้านล่าง; ไม่ใช่ mouse-drag verification |
| Chat/Files isolation และ inactive Result Viewer interaction | ผ่านใน browser รวม Delete/Backspace ขณะโฟกัส Data ไม่ลบ selected canvas node |
| Browser console | ไม่พบ warnings/errors ระหว่างชุดตรวจ Result Viewer |
| Native development GUI launch รอบ Result Viewer | ผ่าน: repository executable, PID 38024, Exited=False, window title `thClaws` หลังเปิด 5 วินาที; ไม่มี startup panic ใน log ที่ตรวจ |
| Manual mouse drag ของ workspace | ยังไม่ยืนยันจากงานชุดที่ 1 และยังไม่ถือว่าผ่านใน iteration นี้ |

### Result Viewer browser evidence — binary รอบใหม่

ทดสอบ binary เดียวกับ desktop build ผ่าน `--serve --port 18766` ใน isolated workspace `target/result-viewer-e2e`:

- เริ่มที่ GIS, Data แสดงข้อมูลตัวอย่างตรงทั้ง 3 rows / 5 fields แบบ read-only, Chart เป็น placeholder ตามขอบเขต
- GIS/Data/Chart ทั้งสาม panels คงอยู่ใน DOM แต่เห็นครั้งละหนึ่ง panel; เปลี่ยน tabs แล้ว Data scroll `top=70`, `left=50` คงเดิม
- เลือก canvas node แล้วโฟกัส Data: กด Delete และ Backspace node ยังอยู่; keyboard tab navigation รวม Home ทำงาน
- keyboard resize ผ่านทั้งสอง splitters; Result width เปลี่ยนจาก `303.1875` เป็น `335.203125` px และกลับมาเท่ากับ `335.203125` px หลัง maximize/restore ใน GIS, Data และ Chart; maximize กว้าง `1040` px ใน viewport ที่ตรวจ
- collapse → maximize Chart → Escape กลับสู่ collapsed state; expand อีกครั้งยังเป็น Chart และเก็บ width เดิม
- workflow focus → Expand Result คืน Node Library และ layout ที่เกี่ยวข้อง
- สลับ Chat/Files/Transport หลายครั้ง: ไม่มี Result Viewer, canvas หรือ result table ปรากฏใน Chat/Files
- compact viewport 900px มี document width 900px; Result maximize เต็มพื้นที่ `660 × 450` px และ reset scroll เป็น 0 เมื่อ maximize
- compact restore กลับใกล้ scroll เดิม: `374 → 370` px **ไม่อ้างว่า restore pixel-exact**; สาเหตุของส่วนต่างยังไม่ยืนยัน อาจเกี่ยวกับ layout/focus clamping
- หน้าต่างสั้น `1280 × 480` px: Result maximize สูง `294` px เท่ากับ workspace height 294px และ document height ยัง 480px
- browser console ไม่พบ warning/error ในรอบตรวจนี้

pointer-drag call คืนค่าแต่ divider ไม่เปลี่ยนตำแหน่ง จึง **ยังไม่ยืนยัน mouse resize/drag** และยังสรุปไม่ได้ว่าเป็น app bug ต้องตรวจด้วยเมาส์ใน native GUI ต่อ โดยไม่ใช้ผล keyboard resize มาแทน

SHA256 ของ release executable รอบ Result Viewer หลังคัดลอกจาก temporary target กลับ `target/release/thclaws.exe`: `97C5B7B9DE00C823D5BE2F2AA9C3ECA662BEE921CE7F085B5104858F4A748AD2` โดยต้นทางและปลายทางตรงกัน

### Native GUI — Result Viewer build ล่าสุด

เปิดเฉพาะ development executable ใน repository และยืนยัน PID `38024`, `Exited=False`, window title `thClaws` หลัง 5 วินาที ไม่ได้ install หรือ overwrite installation เดิม

คำสั่งเปิดที่ใช้ โดยตั้ง `THCLAWS_GUI_DETACHED=1` เฉพาะตอน launch เพื่อใช้ process ตรงพร้อมเก็บ logs แล้วคืน environment ของ shell ใน `finally`:

```powershell
$previousGuiDetached = $env:THCLAWS_GUI_DETACHED
try {
  $env:THCLAWS_GUI_DETACHED = '1'
  Start-Process `
    -FilePath 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\release\thclaws.exe' `
    -ArgumentList '--gui' `
    -WorkingDirectory 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws' `
    -WindowStyle Normal `
    -RedirectStandardOutput 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\result-viewer-e2e\gui.stdout.log' `
    -RedirectStandardError 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\result-viewer-e2e\gui.stderr.log' `
    -PassThru
} finally {
  $env:THCLAWS_GUI_DETACHED = $previousGuiDetached
}
```

startup ยังมีคำเตือนเดิมเรื่อง installed executable อีกแห่งบน PATH และการข้าม corrupt lines ใน session history เดิม ไม่ได้แก้/ล้างข้อมูลเหล่านั้น และไม่พบ panic ใน log ที่ตรวจ

ปิดเฉพาะ test server PID `38252` หลังตรวจ path และ command line ว่าตรงกับ development executable `--serve --port 18766`; ไม่หยุด installation เดิม และเปิด native development GUI ไว้ให้ตรวจด้วยเมาส์ต่อ การ launch สำเร็จไม่เท่ากับผ่าน manual mouse acceptance

## Verification — หลักฐานงานชุดที่ 1 ก่อน Result Viewer

แยกสถานะ implementation ออกจาก verification ให้ชัดเจน:

| รายการ | ผลที่ยืนยันในงานชุดที่ 1 |
| --- | --- |
| CreateDataDialog / TransportNodeDetails scoped ESLint | ผ่าน |
| Dedicated Rust persistence suite: `cargo test --features gui --test transport_project` | ผ่าน 8/8; ไม่ใช่ full Rust unit suite |
| Project/migration/port/validation fixtures: `npm run test:transport` | ผ่าน 28/28 รวม duplicate-ID guards |
| TypeScript project check / Transport-scoped lint ทั้งชุด | ผ่าน |
| Frontend production build | ผ่าน; 2,584 modules |
| Desktop GUI release build | ผ่านด้วย temporary target directory; คัดลอก executable กลับ repository และตรวจ SHA256 ตรงกัน |
| Create data / details / bindings / Save/Open / migration-copy | ผ่านใน browser ผ่าน `--serve` ของ binary เดียวกัน; รายละเอียดด้านล่าง |
| Repeated Chat/Files switching และ no-Transport-leak regression | ผ่านใน browser; nodes/edges ที่มองเห็นใน inactive tabs เท่ากับศูนย์ |
| GIS maximize / Escape restore | ผ่านใน browser รวม screenshot ตรวจพื้นที่ maximize |
| Splitter resize ด้วย keyboard | ผ่านทั้งสอง splitters ใน browser |
| Compact viewport 900px | ผ่าน; document width เท่ากับ 900px และซ่อน splitters |
| Mouse drag: nodes / splitters | ยังไม่ยืนยัน; ต้อง manual check ใน native GUI |
| Run บน valid graph | แสดงชัดว่า engine ยังไม่ implement และไม่เริ่มคำนวณ |
| Browser console | ไม่พบ warnings/errors ระหว่างชุดทดสอบ |
| Native development GUI launch ของ binary รอบนี้ | เปิดสำเร็จ: process จาก repository มีหน้าต่าง `thClaws`; ยังไม่เท่ากับ manual mouse-drag acceptance |

### Browser end-to-end — binary งานชุดที่ 1

ทดสอบ `--serve` จาก executable เดียวกับ desktop build ใน isolated workspace `target/transport-ui-e2e` ไม่ใช้ project งานจริง:

- Create new data จาก CSV source reference, ตั้งชื่อ block, กรอก Note ภาษาไทยและ Details ภาษาอังกฤษ แล้วเปิดกลับมาตรวจครบ
- ตั้งชื่อ output และเลือก input bindings: Data → Trip Generation และ output ของ Generation สอง ports แยกไปสอง inputs ของ Distribution รวม 3 nodes / 3 edges
- Save ใหม่, Save update พร้อม backup, Save As Copy ได้ ID ใหม่, Open คืน names/notes/details/connections และ viewport
- เปิด v1 `Legacy-Review`, migrate แล้ว Save เป็น v2 copy ใหม่ที่มี 2 nodes / 1 edge; SHA256 ของไฟล์ v1 ต้นฉบับก่อนและหลังเท่ากัน: `1461FC30B6B73A4A20ABF43E8F1C51203C89D6215A87100316CFA90997DAE452`
- สลับ Chat/Files/Transport ซ้ำ: ไม่มี Transport nodes/edges ปรากฏขณะ inactive, modal state คงอยู่เมื่อกลับ Transport และกด Delete ใน Chat ไม่เปลี่ยน workflow
- GIS maximize แสดงครอบคลุม workspace และ Escape restore ได้
- resize splitters ด้วย keyboard ผ่านทั้งสองฝั่ง และตรวจ compact viewport โดยไม่มีแนวนอนล้น

**ข้อจำกัดการยืนยัน:** browser pointer-drag calls คืนค่าแล้วแต่ตำแหน่งไม่เปลี่ยน จึงยังไม่ถือว่าทดสอบ mouse drag ผ่าน และยังไม่เพียงพอจะสรุปว่าเป็น bug ของแอป ต้องลองลาก node/เชื่อม handles/ลาก splitters ด้วยเมาส์ใน native GUI ก่อนปิด 4V

ข้อจำกัด tests เดิม: full library unit-test build บน Windows เคยติด `std::os::unix` ใน `crates/core/src/multi_tenant/registry.rs` ภายใต้ test configuration จึงไม่ควรอ้างว่า full Rust tests ผ่านจากผล GUI build หรือ dedicated test suite เท่านั้น งานชุดนี้ไม่แก้ unrelated test code เพื่อเลี่ยงปัญหานั้น

### หลักฐานจากรอบก่อน — ไม่ใช่ผลของ source ชุดนี้

baseline ก่อน schema-v2 เคย build และเปิด development GUI ได้ แต่ผลในตารางด้านบนเป็นการตรวจ source รอบนี้แยกต่างหาก

## คำสั่งสำหรับตรวจและ build

จาก `frontend/`:

```powershell
npm run test:transport
npx tsc -b
npx eslint src/components/TransportView.tsx src/components/transport
npm run build
```

จาก repository root:

```powershell
cargo test --features gui --test transport_project
cargo fmt --all -- --check
cargo build --release --features gui --bin thclaws
```

คำสั่ง release build ที่สำเร็จในงานชุดที่ 1 และนำมาใช้ build Result Viewer iteration ต่อ ใช้ target directory ชั่วคราวเพื่อหลีกเลี่ยง file-sharing lock ใน directory เดิม:

```powershell
& 'C:\Users\natachai\.cargo\bin\cargo.exe' build --release --features gui --bin thclaws --target-dir 'C:\Users\natachai\AppData\Local\Temp\thclaws-transport-build-20260830'
```

ทั้งงานชุดที่ 1 และ Result Viewer iteration ใช้วิธีนี้: ผลลัพธ์ `C:\Users\natachai\AppData\Local\Temp\thclaws-transport-build-20260830\release\thclaws.exe` คัดลอกกลับ `target/release/thclaws.exe` ใน repository แล้วตรวจ SHA256 ต้นทาง/ปลายทางตรงกัน ไม่ได้เปลี่ยน source/config เพื่อ bypass compile error; hash และหลักฐาน browser/native launch ของ Result Viewer รอบล่าสุดอยู่ใน verification ด้านบน

ไม่ต้อง install หรือ overwrite THClaws ที่ติดตั้งอยู่เดิม; development executable คือ `target/release/thclaws.exe`

## คำสั่งเปิด Development GUI หลัง build ผ่าน — พร้อมหลักฐาน launch งานชุดที่ 1

```powershell
Start-Process `
  -FilePath 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\release\thclaws.exe' `
  -ArgumentList '--gui' `
  -WorkingDirectory 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws' `
  -WindowStyle Normal
```

ตรวจรอบนี้: launch ปกติสร้าง detached child ตาม source แต่ process ปิดภายหลังโดยยังไม่ทราบว่าเกิดจากการปิดหน้าต่างหรือ startup failure จึงลองเปิดพร้อมเก็บ log โดยตั้ง `THCLAWS_GUI_DETACHED=1` เฉพาะ process launch (ข้ามการ respawn ซึ่ง source รองรับอยู่แล้ว) และคืน environment ของ shell หลังสั่งเปิด ไม่แก้ source/config ถาวร

คำสั่งเปิดครั้งที่ยืนยันหน้าต่างได้ ใช้ executable/arguments/working directory ข้างต้น พร้อม `-RedirectStandardOutput 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\transport-ui-e2e\gui.stdout.log'` และ `-RedirectStandardError 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\transport-ui-e2e\gui.stderr.log'` ผลตรวจได้ process ID `38588`, `Exited=False`, window title `thClaws` ไม่มี startup panic ใน log ที่อ่าน

ปิดเฉพาะ `--serve --port 18765` test server ที่สร้างในรอบนี้แล้ว ไม่หยุดหรือเปลี่ยน installation เดิม

## Warnings เดิมที่ต้องติดตาม

- Cargo workspace ใช้ resolver 1 โดย default
- unused Windows `CommandExt` import ใน `crates/core/src/providers/agent_sdk.rs`
- dead code `binary_on_path` และ `DAEMON_LABEL`
- Vite: `inlineDynamicImports` deprecated
- full Rust library test build บน Windows มี Unix-specific test code เดิมตามที่ระบุข้างต้น

ข้อจำกัด environment ที่บันทึกจากงานชุดที่ 1:

- Vite ใน sandbox เคยติด `spawn EPERM`; คำสั่ง build เดิมผ่านเมื่อได้รับอนุญาตให้รันนอก sandbox ไม่ได้แก้ config/source เพื่อข้าม error
- Rust release rebuild ติด Windows file-sharing violation (`os error 32`) ซ้ำตอนลบ temporary archive ใน `target/release/deps`; build ผ่านด้วย temporary `--target-dir` ตามคำสั่งด้านบน เป็น build-artifact lock ไม่ใช่ source compile error ไม่ได้ลบ cache หรือหยุด Dropbox
- Git แจ้ง LF → CRLF ตาม Windows line-ending policy; `git diff --check` และ `cargo fmt --all -- --check` ผ่าน
- Native startup เตือนว่ามี installation เดิมอีกแห่งบน PATH; รอบนี้เปิด executable ด้วย absolute path และไม่ลบ/แก้ installation เดิม
- Native startup รายงานข้าม corrupt lines ใน session history เดิมบางไฟล์; ไม่ได้แก้ไขหรือล้างข้อมูลเหล่านั้น และไม่ใช่ error ของ Transport project

## Working tree และงานต่อไป

งานสะสมชุดที่ 1 มี frontend, persistence/source-browser Rust, tests และเอกสาร รวม release-profile development build ส่วน Result Viewer iteration เพิ่มเฉพาะ frontend/tests/docs ตามรายการด้านบน; iteration ล่าสุดเพิ่ม standalone TG ภายใต้ `transport-engine/` และเอกสาร ไม่แก้ UI/backend เพิ่ม ไม่สร้าง installer/เผยแพร่ release และไม่แตะ installation เดิม

Roadmap ฉบับเต็ม: [TRANSPORT_ENGINE_ROADMAP.md](./TRANSPORT_ENGINE_ROADMAP.md)

1. รักษา standalone TG tests/regression/safety suite ที่ผ่านแล้วเป็น gate; ใช้ destination copies เท่านั้น ไม่ขยายไปโมดูลอื่นโดยอัตโนมัติ
2. ยืนยัน scientific warnings และ TG input/output contract กับผู้ใช้; ไม่ถือว่า historical reproduction เป็น calibration
3. ทำ manual mouse resize/drag acceptance ที่ค้างของ Result Viewer และ foundation 4V; หลักฐาน native launch/build/browser เดิมยังคงแยกไว้ ไม่ได้รันซ้ำใน TG iteration
4. ล็อก full runner protocol ทั้ง `run_action`/`run_workflow`, node progress/errors/artifacts แล้วสร้าง Rust bridge; single-action prototype ไม่ทำให้ tasks เหล่านี้เสร็จ
5. ทดสอบ end-to-end ด้วย stub/fixtures ก่อนเชื่อม real TG ให้ UI Run เรียกใช้งาน ไม่เพิ่มโมดูลอื่นโดยอัตโนมัติ
6. GIS output จริง, Chat control, MCP และ binary packaging เป็น milestone หลังจาก execution contract เสถียร
