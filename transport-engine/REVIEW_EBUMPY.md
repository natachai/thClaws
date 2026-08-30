# eBUMpy review — Trip Generation standalone milestone

อัปเดต: 31 สิงหาคม 2026

เพิ่มเติม iteration TG all-years: ผู้ใช้อนุญาต copy year-specific inputs จาก `planning/` และ `Project/` นอก eBUMpy พร้อม reviewed settings รวม 21 files / 7,523,177 bytes; originals read-only และสูตร TG ไม่เปลี่ยน ปี 2022/2027/2032/2037/2042/2047/2052/2057 รันผ่าน 8/8, tests 52/52 (5.032 s), 56 artifacts / 40 CSVs ผ่าน integrity/accounting checks และ originals/copies ไม่เปลี่ยนหลังรัน รอบส่งมอบ `trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4` มี summary/verification ดู [README.md](./README.md) ปี 2032 golden hashes/totals/QA ยังตรง; อีก 7 ปีไม่ได้ golden/calibration/Cube verification หลักฐาน single-year 2032 ด้านล่างเป็นผล iteration ก่อนหน้า

## ขอบเขตและสถานะ

รอบนี้นำเข้า **Trip Generation เท่านั้น** เป็น standalone Python package `thclaws_transport` ภายใต้ `transport-engine/` โดยใช้ action ID `transport.trip_generation` ไม่ย้าย model algorithms เข้า React หรือ Rust

Source snapshot, package, explicit-input adapter และ single-action runner ลงแล้ว: **tests 33/33 ผ่าน และ standalone run เทียบผล 2032 ผ่าน** แต่ไม่ถือว่า model ทั้งระบบเสร็จหรือ calibration ผ่าน

- ไม่แก้ frontend, Rust/backend หรือปุ่ม Run ใน iteration นี้
- UI **Run Workflow ยังตรวจโครงสร้างเท่านั้น**; Result Viewer ยังแสดง demo เดิม ไม่ได้อ่านผลจาก prototype นี้
- ยังไม่ทำ full-workflow executor, JSONL event protocol, Rust bridge, Chat/MCP หรือ compile binary
- ไม่ติดตั้ง dependencies เพิ่ม; runtime ที่ตรวจพบคือ Python 3.11.9 และ TG ชุดนี้ใช้ standard library; setuptools 65.5.0 มีแล้ว แต่ไม่มี wheel และยังไม่ build wheel/package binary

## การรักษาต้นฉบับและหลักฐาน copy

ต้นฉบับที่อ่านเท่านั้น:

`C:\Users\natachai\Dropbox\2_bangkokModel\BTDS\BTDModel_FN_V10\eBUMpy`

ไม่ execute/import original Python, ไม่สร้าง `__pycache__`, ไม่เรียก legacy CLI และไม่เขียนกลับ source/input/output เดิม หลังรัน prototype ตรวจ original TG ทั้ง 128 files และ destination copies SHA256 ไม่เปลี่ยน พร้อมตรวจ initial inventory/selected hashes อีกครั้ง

| สำเนาใน destination | ขอบเขต |
| --- | --- |
| `reference/trip-generation/` | TG เต็มชุด ยกเว้น `__pycache__`: 128 files / 30,005,543 bytes (~28.62 MiB); เก็บ scripts, inputs, historical outputs และ conflict copies แยกตามชื่อเดิม |
| `reference/trip-generation-manifest.json`, `reference/trip-generation-verification.json` | รายการ path/size/time/SHA256 สำหรับ snapshot TG; ตรวจ bytes ต้นทาง/ปลายทางครบ 128 files อีกครั้งหลังรัน โดยไม่ merge conflict |
| `reference/eBUMpy/` | archive จากการ review กว้างก่อนผู้ใช้จำกัด scope: source/config/docs 186 files (~1.58 MiB), รวม conflict copies 29 files; **ไม่ใช่การ implement โมดูลอื่น** |
| `reference/copy-manifest.json`, `reference/verification.json` | copy records ชุดแรก 204 รายการ = archive 186 + fixture 15 + runtime 3; metadata inventory 3,249 files ไม่เปลี่ยน และ selected-copy hashes ตรวจแล้ว |
| `local-fixtures/trip-generation-2032/inputs/` | 7 inputs / 952,522 bytes |
| `local-fixtures/trip-generation-2032/expected/` | 8 historical expected files / 6,345,448 bytes สำหรับ regression ไม่ใช่ผลที่ prototype เพิ่งคำนวณ |

ต้นฉบับทั้งหมดประมาณ 23.572 GiB; ไม่ได้ hash เนื้อหาทุกไฟล์ใน tree นั้น การตรวจ metadata ทั้ง inventory ไม่เท่ากับ full-tree byte verification พบ conflict files ทั้ง tree 47 files แต่ไม่ได้ merge หรือตัดสินว่าทุก conflict ใช้แทน canonical ได้

`reference/`, `local-fixtures/`, `runs/` ถูก ignore เพื่อไม่รวม private source/data หรือ run outputs ใน release โดยอัตโนมัติ ไม่ใช่กลไก license protection ของ runtime algorithms

Canonical `generation/calculation.py` คัดลอกแบบ byte-identical; SHA256:

`9B2A0FD88B9BEFBC460F7B07A76DD36A335D1FF0910DC64CA3E4955BAF99CFB8`

สูตรและ coefficients ในไฟล์นี้ไม่ถูกเปลี่ยนเพื่อให้ tests ผ่าน การตรวจ regression ใหม่แยกจากการตรวจ copy hash; `transport-engine/.gitattributes` ปิด Git text normalization สำหรับ copied `calculation.py`, `csv_tools.py`, `dbf_reader.py` เพื่อรักษา bytes/line endings เดิมด้วย

## Trip Generation contract

Adapter รับไฟล์ที่ caller ระบุอย่างชัดเจน ไม่ค้นหา legacy workspace หรือเดา input จากชื่อ scenario:

| Input key | Fixture 2032 | บทบาท |
| --- | --- | --- |
| `demographic_dbf` | `BTDS planning data 2032 V2.dbf` | demographic/age/vehicle ownership ราย zone |
| `attraction_dbf` | `ATTR_MOD.DBF` | attraction-model attributes |
| `survey_trip_rate_csv` | `Trip Rate_BTDS2565_SURVEY.csv` | survey trip-rate coefficients |
| `seed_csv` | `BTDS_SEED_CH_NEW.CSV` | age/vehicle cross-classification seed |
| `density_adjustment_csv` | `ADJTAB.CSV` | density adjustments |
| `year_adjustment_csv` | `BTDS_YEARADJUST.CSV` | year adjustments; `year` ต้องระบุแยก |
| `tour_trip_rate_csv` (optional) | `Trip Rate_BTDS2565_TOUR.csv` | provenance เท่านั้น ไม่ใช่ coefficient ที่สูตร TG รอบนี้ใช้ |

Python adapter API ที่ทดสอบแล้ว:

```python
run(inputs: Mapping[str, Path], *, year: int) -> GenerationResult
```

`GenerationResult` แยก calculation artifacts, QA, warnings และ counts ออกจาก filesystem writing ส่วน local runner รับ request schema v1 ของ **single action**: `schemaVersion`, `actionId`, `parameters: {year}`, `inputs` ซึ่งเป็น workspace-relative file paths ไม่ใช่ Transport Project schema v2 และไม่ใช่ proposed JSONL `run_workflow` protocol

Runner จำกัด action เดียวและ input keys ที่รู้จัก, resolve paths ภายใน explicit destination workspace, ตรวจ input hashes และสร้าง `runs/trip-generation-<unique-id>/` ใหม่ ไม่ใช้ legacy output directory ไม่เขียนทับ run เก่า; `result.json` เป็น completion marker เขียนหลัง artifacts ส่วน failed partial run เก็บไว้พร้อม diagnostic ไม่แอบอ้างว่าสำเร็จ รายละเอียดและคำสั่งที่ใช้จริงดู [README.md](./README.md)

ผลที่ runner เตรียม publish:

- CSV: `TGPRO_ALL.csv`, `TGATT_ALL.csv`, `trip_generation_zone_results.csv`, `trip_generation_long.csv`, `trip_generation_age_long.csv`
- JSON: totals, QA และ `result.json` ที่รวม input provenance, artifact paths/hashes, warnings และ scientific status
- fixture `trip_generation_input_summary.json` เป็น historical provenance สำหรับอ้างอิง ไม่ได้หมายความว่า runner ต้องสร้างไฟล์ทุกชื่อของ legacy CLI ซ้ำ

พอร์ต UI ปัจจุบันเป็น structural contract แบบทั่วไป ยังไม่ map input keys ทั้งหกนี้เป็น executable configuration ห้ามถือว่าต่อ socioeconomic Data block เพียงอันเดียวแล้วรัน TG นี้จาก UI ได้ทันที

## สูตรและ scientific limitations

หลักฐาน static ใน canonical TG `calculation.py` (ต้นฉบับและสำเนาเหมือนกัน):

- lines 6–18: 4 purposes `HBW/HBE/HBO/NHB`, 4 published vehicle segments `VEH0/MC/CAR/MULTI`, internal ownership classes และ MRT factors
- lines 20–48: attraction coefficients อยู่ใน calculation source ไม่ใช่ parameters ที่ UI ปรับได้แล้ว
- lines 88–145: age/ownership Furness ทำ **5 iterations** ตามลำดับ legacy/Cube ที่ระบุใน source ไม่ได้ iterate จน tolerance ใหม่
- line 242 เป็นต้นไป: `calculate_trip_generation` คืน in-memory artifacts; legacy wrapper ต่างหากที่ค้น paths และเขียน files
- legacy `trip_generation.py:25,53–68,106–109`: wrapper ใช้ workspace-derived paths, เขียน fixed output names และ copy input snapshot จึงไม่เรียก wrapper นี้ตรง ๆ จาก THClaws

Historical fixture 2032 มี 1,778 zones และ 16 purpose/vehicle segments ผล QA ระบุ age-total mismatch เกิน 5% **1 zone**, ownership mismatch **0 zones**; Furness max row residual **0.0**, max column residual **1.360739** หลัง 5 iterations

ดังนั้น adapter ต้องรายงานข้อจำกัดอย่างเปิดเผย ไม่ปรับ formula/iterations หรือปกปิด warning เพื่ออ้างว่า balanced ทุกมิติ การ reproduce ตัวเลขเดิมได้หมายถึง **regression compatibility กับ fixture ที่เลือก** ไม่ได้พิสูจน์ calibration, parameter transfer ทุกปี, observed-data fit หรือ full Cube parity

Input loaders validate required fields/keys, numeric values, year และ zone correspondence ก่อนคำนวณ และแยก legacy-data warnings ออกจาก fatal schema errors: fixture มี survey numeric blanks 60 cells และ seed blanks 540 cells ที่เป็นรูปแบบ legacy เฉพาะซึ่งเก็บ zero interpretation พร้อม warning ไม่ยอมรับ blank required field แบบอื่น, nonfinite numbers, truncated files หรือ duplicate keys โดยเงียบ ๆ optional tour rates ไม่ถูกใช้คำนวณและมี warning แจ้ง

## Authoritative phase ของต้นฉบับและโมดูลที่เลื่อนไว้

ใช้ `00_HANDOFF.md:7–25` และ `CURRENT_TASK_STATUS_1_TO_16.md:16–20` ใน source เป็น current handoff: source ระบุ tasks 1–4 accepted ภายในขอบเขต Level-2 parity เดิม แต่ **Task 4A phase mapping/GTFS QA ยังเป็น mandatory gate** และ Task 5 IVPVT/IVPT/XCHOICE semantics รอหลัง 4A ไม่ใช่ใบอนุญาตเปลี่ยน modal coefficients

`00_HANDOFF.md:59–80` ระบุ mapping inconsistency ของ stop 336 กับ legacy nodes 9941/9420 ซึ่งกระทบ future packages 2037–2057 เก็บ canonical/conflicted documents แยก ไม่ merge findings ให้ดูเหมือน gate นี้ผ่านแล้ว TG-only prototype ไม่แก้หรือปิด tasks เหล่านี้

| โมดูลนอก scope | ข้อจำกัดสำคัญจาก static review — ไม่มี adapter ใหม่ในรอบนี้ |
| --- | --- |
| Trip Distribution | มี legacy implementation/หลักฐาน parity บาง phase แต่ full-model calibration และการยืนยัน interface/fixture ของ THClaws เป็นงานแยก; ไม่ทำ distribution adapter ตอนนี้ |
| Modal Split | ใช้ NumPy/optional OpenMatrix; legacy parameter paths อ้าง `MSplit/` นอก eBUMpy และ manifests อาจชี้ absolute original paths (`model.py:37–52,138–155`); nested-choice semantics ยังรอ Task 5 (`282–295`) |
| Cost/Fare | station-number proxy ไม่ใช่ route fare จริง (`station_fare_matrix.py:130–181`); inferred GTFS fares ไม่ใช่ official acceptance; scenario path handling ต้องตรวจใหม่ก่อนเอา wrapper มาใช้ (`scenario_builder.py:240–243`) |
| Road/PT Skim | ต้องมี network/GTFS และ NumPy/Pandas/SciPy/GeoPandas ตามโมดูล; private road skim คำนวณ shortest path แต่ละ metric แยก (`private_road_skim.py:197`), ไม่ใช่ route เดียวทุก component; ห้ามเรียก generated-output cleanup/default paths โดยไม่ review |
| Traffic Assignment | folder ต้นฉบับยังไม่มี implementation ให้ package |
| Transit Assignment | deterministic assignment แบบไม่มี capacity/crowding/equilibrium, status `HOLD_FOR_CALIBRATION`; zero/unreachable demand และ stdout progress ต้องแก้ใน milestone ของมันก่อนใช้ structured runner |

Environment ยังไม่มี NumPy, Pandas, SciPy, GeoPandas หรือ OpenMatrix แต่ **ไม่ใช่ blocker ของ TG stdlib prototype** และไม่ติดตั้งเพื่องานโมดูลที่อยู่นอก scope

## Verification gate และงานถัดไป

| รายการ | สถานะตอนเขียน review |
| --- | --- |
| Static review โดยไม่ execute original | เสร็จ |
| TG snapshot/hash และ selected-copy verification | เสร็จตาม manifests ข้างต้น |
| Package/adapter/runner tests บน destination | ผ่าน `python -B scripts/test_engine.py`: 33/33, no skips, 4.241 s |
| 2032 regression เทียบ copied expected outputs | ผ่าน: written CSV ทั้ง 5 SHA256 เหมือน historical goldens ทุก byte; totals/QA JSON semantic equality ผ่าน |
| Invalid-input/path-boundary/no-overwrite checks | ผ่านใน suite รวม launcher ปฏิเสธ abbreviated `--work`/`--workspa` ก่อน execution เพื่อไม่ให้ override fixed workspace |
| Standalone action smoke run + artifact checks | ผ่าน: `trip-generation-416ef99a71ba4a1eb2c1df1d07976dd8`, ประมาณ 1.5 s; P/A/zonal 1,778 rows ต่อ table, long 28,448, age-long 85,344 |
| Original/copy checks หลังรัน | TG 128 original files + copies SHA256 ไม่เปลี่ยน; initial inventory 3,249 entries names/size/mtime ไม่เปลี่ยน และ selected 204 hashes ตรวจผ่าน |
| Wheel/binary build และ publish | ไม่ได้ทำ; ไม่ติดตั้ง wheel/dependencies เพิ่ม ไม่มีการ publish code/data |
| Frontend/Rust/GUI build ของ milestone นี้ | ไม่ได้ทำและไม่จำเป็นต่อ standalone-only scope; ไม่ใช้ build UI รอบก่อนมาอ้างเป็นผล engine |
| Full workflow JSONL/Rust bridge/GUI execution | ยังไม่ implement |

คำสั่งที่ใช้จาก `transport-engine/`: `python -B scripts/test_engine.py` และ `python -B scripts/run_trip_generation.py` โดย launcher ล็อก workspace เป็น destination package tree; สคริปต์ copy/verification อ่าน original เท่านั้น ไม่รัน original model

ข้อขัดข้องระหว่างเตรียม snapshot: initial broad-copy script คัดลอกครบแล้วแต่ขั้นสรุป `Measure-Object` ล้มเหลว แก้เฉพาะ summary และตรวจ 204 copied hashes ผ่าน จากนั้น full TG copy script เสร็จและ verification หลังรันผ่าน ไม่ใช่การแก้ model formula

ลำดับถัดไป: review warnings/contract กับเจ้าของแบบจำลอง → ออกแบบ full-workflow protocol และ Rust bridge → เชื่อม UI ด้วย artifact references เท่านั้น โดยเก็บ 2032 regression + safety suite เป็น gate การนำสูตรจริงเข้า isolated package ก่อน stub milestone เป็นการปรับลำดับที่ผู้ใช้เลือก ไม่ใช่การข้าม integration/safety gates สำหรับใช้งาน production
