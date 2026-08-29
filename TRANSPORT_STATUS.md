# THClaws Development Status

อัปเดตล่าสุด: 30 สิงหาคม 2026  
Branch: `transport-ui`

## ภาพรวม

THClaws baseline สำหรับ Windows build และเปิดใช้งานผ่าน desktop GUI ได้แล้ว โดยใช้ Rust desktop application และ frontend React/TypeScript ที่ถูกฝังเข้าไปใน binary ตอน build GUI

Transport workspace ถูกเพิ่มเป็น tab แยกจาก Chat ภายในหน้าต่าง THClaws เดียวกัน

ล่าสุดเพิ่มหมวด `Data` ใน Node Library เพื่อแยกแหล่งข้อมูลออกจาก modelling components

## สถานะ workspace ปัจจุบัน

### Chat

- ยังคงเป็น Chat UI เดิมของ THClaws
- ไม่มี Transport workflow, canvas หรือ GIS แสดงอยู่ใน Chat
- Transport component ยังคง mount เพื่อรักษา state แต่ถูกซ่อนและปิด interaction เมื่อไม่ได้อยู่ที่ Transport

### Transport

ประกอบด้วยสามส่วน:

1. Node Library
2. Workflow Canvas
3. GIS Viewer placeholder

Node ที่มีอยู่:

Data:

- Shapefile
- CSV
- GeoJSON
- Parquet

Modelling:

- Trip Generation
- Trip Distribution
- Modal Split
- Traffic Assignment
- Transit Assignment
- Skim

ความสามารถที่มีแล้ว:

- แสดงหมวด Data และ Modelling แยกกันใน Node Library
- แสดงชนิดข้อมูล input/output บน workflow node และ handle
- ลาก node จาก Node Library ไปยัง Workflow Canvas
- เชื่อม node ด้วย handles
- ลบ node และ edge
- ปรับ zoom, reset zoom และ fit workflow
- ปรับขนาดสาม panel ด้วย splitter
- ย่อ/ขยาย Node Library และ GIS Viewer
- ขยาย GIS Viewer แบบ maximize และ restore ด้วย Escape
- รักษา workflow state เมื่อสลับ tab
- สร้าง project ใหม่ด้วยปุ่ม New
- บันทึกและเปิด project JSON ด้วย Save/Open
- เก็บ project ใต้ `.thclaws/transport/projects/`
- ตรวจโครงสร้าง workflow, data source, missing inputs, broken edges, cycles และ data-type mismatch
- ปุ่ม Run Workflow ทำ validation และบล็อก workflow ที่มี error

ยังไม่มี:

- Transport calculation engine
- ผลลัพธ์การคำนวณ
- MapLibre หรือ QGIS
- MCP integration
- การให้ Chat สร้างหรือแก้ node โดยตรง

## Architecture ปัจจุบัน

ตอนนี้ `TransportView` เป็นเจ้าของ `TransportProject` state กลาง ซึ่งประกอบด้วย:

```ts
{
  schemaVersion: 1,
  nodes: TransportWorkflowNode[],
  edges: TransportWorkflowEdge[],
  metadata: {
    name?: string,
    baseYear?: number,
    region?: string,
    updatedAt?: string
  }
}
```

`WorkflowCanvas` เป็น controlled component ที่อ่านและแก้ไข state ผ่าน props ไม่ได้เก็บ workflow แยกจาก Transport workspace อีกชุดหนึ่ง

สถาปัตยกรรมที่เตรียมไว้สำหรับระยะถัดไป:

```text
Chat / Agent
     ↕ IPC หรือ Transport tools
Transport Project State
     ↕
Transport UI (Node Library / Workflow / GIS)
     ↕
Backend calculation engine
```

ขณะนี้ส่วน Chat และ backend ยังไม่ได้เชื่อมกับ `TransportProject` ดังนั้นข้อความใน Chat ยังไม่สามารถเพิ่มหรือรัน Transport node ได้จริง

## ไฟล์ Transport หลัก

- `frontend/src/components/TransportView.tsx` — layout, panel sizing, maximize state และ project state
- `frontend/src/components/transport/NodeLibrary.tsx` — รายการ node และ drag source
- `frontend/src/components/transport/WorkflowCanvas.tsx` — React Flow canvas และ workflow editing
- `frontend/src/components/transport/GISViewer.tsx` — GIS placeholder
- `frontend/src/components/transport/PanelSplitter.tsx` — draggable splitter
- `frontend/src/components/transport/TransportNode.tsx` — custom workflow node rendering
- `frontend/src/components/transport/TransportProjectToolbar.tsx` — New/Open/Save/Validate/Run controls
- `frontend/src/components/transport/TransportValidationPanel.tsx` — validation result panel
- `frontend/src/components/transport/transportTypes.ts` — node types และ Transport Project model
- `frontend/src/components/transport/transportValidation.ts` — workflow validation rules
- `frontend/src/App.tsx` — tab union, tab registration และ lifecycle mounting
- `crates/core/src/transport_project.rs` — workspace-local JSON persistence
- `crates/core/src/ipc.rs` — Transport project list/save/load IPC

Rust/backend รองรับเฉพาะการบันทึกและโหลด Transport Project แล้ว แต่ยังไม่มี calculation engine

## การตรวจสอบล่าสุด

ผ่านแล้ว:

- TypeScript project check
- Transport-scoped ESLint
- Frontend production build
- Rust desktop GUI release build
- Save/Open project แบบ end-to-end ใน temporary workspace
- validation และ Run-blocked state สำหรับ workflow ที่ไม่สมบูรณ์
- เปิด development GUI บน Windows
- สลับ Chat → Transport → Chat
- สลับ Files → Transport → Files
- สลับ Transport → Chat → Transport

## คำสั่ง Build

จาก root ของ repository:

```powershell
cd C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws
cd frontend
npm run build
cd ..
& 'C:\Users\natachai\.cargo\bin\cargo.exe' build --release --features gui --bin thclaws
```

## คำสั่งเปิด Development GUI

ใช้ binary ใน repository target directory เพื่อไม่แตะต้อง THClaws ที่ติดตั้งอยู่เดิม:

```powershell
Start-Process `
  -FilePath 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\target\release\thclaws.exe' `
  -ArgumentList '--gui' `
  -WorkingDirectory 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws'
```

## Warnings ที่ยังมีอยู่

เป็น warnings เดิมของ repository ไม่ได้เกิดจาก Transport state change:

- Cargo workspace ใช้ resolver 1 โดย default
- unused import ใน `crates/core/src/providers/agent_sdk.rs`
- dead code `binary_on_path`
- dead code `DAEMON_LABEL`
- Vite แจ้งว่า `inlineDynamicImports` deprecated และแนะนำ `codeSplitting: false`

## Working tree

Branch ปัจจุบันคือ `transport-ui`

ไฟล์ที่มีการเปลี่ยนแปลงใน working tree ณ เวลาจัดทำเอกสาร:

- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/src/components/TransportView.tsx`
- `frontend/src/components/transport/NodeLibrary.tsx`
- `frontend/src/components/transport/WorkflowCanvas.tsx`
- `frontend/src/components/transport/TransportNode.tsx`
- `frontend/src/components/transport/TransportProjectToolbar.tsx`
- `frontend/src/components/transport/TransportValidationPanel.tsx`
- `frontend/src/components/transport/transportTypes.ts`
- `frontend/src/components/transport/transportValidation.ts`
- `crates/core/src/transport_project.rs`
- `crates/core/src/ipc.rs`
- `crates/core/src/lib.rs`

ไฟล์เหล่านี้ยังไม่ได้ commit ในเอกสารฉบับนี้

## งานถัดไปที่แนะนำ

1. กำหนด parameter schema ของแต่ละ modelling node
2. เพิ่ม backend execution contract (`started/progress/completed/failed`)
3. พัฒนา calculation engine ทีละโมดูล
4. เชื่อมผลลัพธ์เข้ากับ GIS Viewer
5. เพิ่ม IPC/tool ให้ Chat อ่านและแก้ Transport Project
6. เพิ่ม MCP หลัง project และ execution contract เสถียร
