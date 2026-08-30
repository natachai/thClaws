# THClaws Transport Engine — Trip Generation prototype

รุ่น `0.1.0.dev1` — ทดลองนำ **Trip Generation ของ eBUMpy** มาเป็น package แยกจาก THClaws UI เท่านั้น ไม่ใช่การย้ายทั้ง Bangkok model

## Iteration ล่าสุด — TG ครบ 8 ปี

รองรับ batch ปี **2022, 2027, 2032, 2037, 2042, 2047, 2052, 2057** โดยแต่ละปีใช้ demographic/attraction DBF ของปีนั้น ไม่เปลี่ยนเพียงค่า `year` บนข้อมูล 2032 เดิม ผู้ใช้อนุญาตให้คัดลอก inputs ที่จำเป็นจาก `planning/` และ `Project/` นอก eBUMpy แล้ว; originals ยังคง read-only ไม่ execute/import code หรือเขียนกลับ

สำเนาอยู่ใน `local-fixtures/trip-generation-all-years/`: 21 files / 7,523,177 bytes ประกอบด้วย DBFs รายปี 16 files, planning coefficients 3 files และ eBUMpy settings snapshot ที่ review แล้ว 2 files ทุกปีมี planning 1,778 zones / attraction 1,805 records; source/hash provenance อยู่ใน `copy-manifest.json` สูตรคำนวณเดิมไม่เปลี่ยน

จาก `transport-engine/`:

```powershell
python -B .\scripts\run_trip_generation_all_years.py
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\copy_trip_generation_all_years.ps1 -VerifyOnly
python -B .\scripts\verify_trip_generation_batch.py --summary 'runs/<batch-id>/summary.json'
```

แทน `<batch-id>` ด้วย directory จากผล batch จริง แต่ละครั้งสร้าง batch directory ใหม่พร้อม `summary.json`/`summary.md`; แต่ละปียังมี run UUID และ artifacts directory ใหม่ของตัวเองใต้ `runs/` ไม่เขียนทับ run เดิม คำสั่ง verify ตรวจชุดที่บันทึกไว้และสร้าง verification report ใหม่ ไม่สั่งคำนวณซ้ำ

**ผล all-years:** tests **52/52** ผ่าน (เดิม 33 + batch ใหม่ 19, no skips, 5.032 s); saved batch **8 completed / 0 failed** ผลล่าสุดอยู่ใน [summary.md](./runs/trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4/summary.md) และ [summary.json](./runs/trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4/summary.json) ซึ่งรวม ownership counts/คำเตือนแยกปี

ตรวจ 56 artifacts รวม 40 CSVs ผ่าน hashes/size/field order/row counts/finite numbers/segment P–A balance และ sums ตาม tolerance; [verification report](./runs/trip-generation-batch-ecb56920e54b47769121e6cdf4d2e2f4/verification-8ad9ee7ca2e84593b44e718315677e29.json) เก็บผลตรวจไว้ ปี 2032 ยังเทียบ 5 CSV SHA256 ตรง goldens และ totals/QA เท่ากัน; **อีก 7 ปีตรวจ integrity/accounting เท่านั้น ไม่ได้เทียบ golden/calibration/Cube parity**

ตรวจ originals/copies ของ inputs ทั้ง 21 files SHA256/size/mtime ไม่เปลี่ยน และ TG source/copies เดิม 128 files ผ่านหลังรัน batch เก็บ run ทดสอบก่อนหน้าไว้ไม่ overwrite; ใช้ batch `ecb56920e54b47769121e6cdf4d2e2f4` ข้างต้นเป็นรอบส่งมอบล่าสุด

ไม่มี dependency install, binary compile, frontend/Rust edits หรือ GUI integration; UI Run ยังคง validate-only และ Result Viewer ยัง demo หลักฐาน 2032 iteration ก่อนหน้าเก็บไว้ด้านล่าง

## ขอบเขตและความปลอดภัย

- ต้นฉบับ `C:\Users\natachai\Dropbox\2_bangkokModel\BTDS\BTDModel_FN_V10\eBUMpy` ใช้อ่าน/คัดลอกเท่านั้น ไม่ import หรือรัน script จาก path นี้
- คัดลอก Trip Generation ครบ 128 ไฟล์ / 30,005,543 bytes รวม script, input snapshots, historical outputs, tests และ conflict copies ยกเว้น `__pycache__`
- สำเนาครบอยู่ใน `reference/trip-generation/`; ไม่ merge conflicted copies และไม่รัน legacy CLI ที่มี default paths ไปยังต้นฉบับ
- `calculation.py`, `csv_tools.py`, `dbf_reader.py` ใน package เป็นสำเนา byte-identical ของไฟล์ canonical เดิม สูตร/coefficients/Furness iterations ไม่เปลี่ยน
- adapter ใหม่ตรวจ input และเรียก pure calculation; runner ใหม่เขียนเฉพาะ directory ใหม่ใต้ `runs/` ไม่เขียนทับ run เดิม
- ไม่มีการแก้ frontend/Rust, ติดตั้ง dependency, compile binary หรือเปิดใช้โมดูลอื่นในรอบนี้
- `reference/`, `local-fixtures/`, `runs/` ถูก Git ignore: เก็บอยู่ในเครื่องนี้ แต่จะไม่ติดไปกับ clone/commit ใหม่ ต้องสำรองแยก
- ยังไม่อนุญาต/ตรวจสอบสิทธิ์การเผยแพร่ model code หรือข้อมูล ชุดนี้สำหรับทดลองในเครื่อง ไม่ได้ publish package

## รันทดลองได้ทันที ไม่ต้อง install

ใช้ Python 3.11 ขึ้นไป ตัวคำนวณ Trip Generation และ tests ใช้ standard library เท่านั้น ไม่ต้อง NumPy/pandas/GeoPandas

PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\natachai\Dropbox\thClaws-transport-dev\thClaws\transport-engine'
python -B .\scripts\test_engine.py
python -B .\scripts\run_trip_generation.py
```

คำสั่งหลังรันข้อมูล **ปี 2032** จากสำเนา `local-fixtures/trip-generation-2032/inputs/` ไม่ใช่ข้อมูลปีอื่นหรือ workflow ปัจจุบันใน GUI

หากต้องการอ่านสรุปใน PowerShell:

```powershell
$tgResult = python -B .\scripts\run_trip_generation.py | ConvertFrom-Json
$tgResult | Select-Object status, runId, scientificStatus
$tgResult.warnings
$tgResult.artifacts | Select-Object portId, path, rows
```

แต่ละการเรียกจะสร้าง run ใหม่ คำสั่งตัวอย่างทั้งสองแบบจึงสร้างคนละ run ถ้ารันทั้งคู่

เปลี่ยน input โดยสร้าง request JSON ใหม่ตาม `examples/trip-generation-2032.json` แล้ว:

```powershell
python -B .\scripts\run_trip_generation.py --request .\examples\my-trip-generation.json
```

ไฟล์ `my-trip-generation.json` เป็นชื่ออธิบาย ยังไม่ได้สร้างให้ ต้องใช้ paths แบบ relative ภายใน `transport-engine/` เท่านั้น ห้าม absolute path, `..`, Windows stream path หรือ symlink/junction ออกนอก workspace ตัว launcher ไม่อนุญาต override `--workspace`

## Package / contract

```python
from thclaws_transport.generation import run

# inputs เป็น mapping ของชื่อด้านล่างไปยัง pathlib.Path ของสำเนาที่ต้องการอ่าน
result = run(inputs, year=2032)
productions = result.artifacts.production_wide_rows
attractions = result.artifacts.attraction_wide_rows
```

API นี้มีเมื่อ `src/` อยู่บน Python import path; scripts ที่ให้มาจัดการให้โดยไม่ต้อง install API ระดับ calculation อ่าน input แต่ไม่เขียน output ส่วน runner รับผิดชอบ workspace boundary/artifacts

Stable action ID: `transport.trip_generation` ตอนนี้ runner รองรับเพียง action นี้ และปฏิเสธ action/parameters ที่ไม่รู้จัก ไม่ dispatch arbitrary Python files

| Input key | สำเนาปี 2032 | หน้าที่ |
| --- | --- | --- |
| `demographic_dbf` | `BTDS planning data 2032 V2.dbf` | 1,778 โซน: population, ages, ownership, region, area/MRT |
| `attraction_dbf` | `ATTR_MOD.DBF` | 1,805 records: employment, schools, commercial attributes; คำนวณบน demographic zones |
| `survey_trip_rate_csv` | `Trip Rate_BTDS2565_SURVEY.csv` | Trip rates ตาม purpose/age/ownership |
| `seed_csv` | `BTDS_SEED_CH_NEW.CSV` | Age × ownership seed สำหรับ Furness |
| `density_adjustment_csv` | `ADJTAB.CSV` | Density adjustment factors |
| `year_adjustment_csv` | `BTDS_YEARADJUST.CSV` | ต้องมีปีที่ร้องขอ ไม่ fallback เงียบ |
| `tour_trip_rate_csv` (optional) | `Trip Rate_BTDS2565_TOUR.csv` | เก็บ provenance/counts เท่านั้น **สูตรเดิมไม่ได้ใช้คำนวณ** |

Six required inputs นี้เป็น contract ที่พบจาก script จริง ไม่ใช่การรับรองว่า ports ใน Transport UI ถูกปรับให้ตรงแล้ว การเปลี่ยน UI bindings/schema เป็นงานถัดไป

ตัว runner ใช้ local JSON request schema version 1 และตอบ JSON result ครั้งเดียว ยังไม่ใช่ protocol `run_workflow`/streaming progress/cancel/timeout สำหรับ Rust

## ผลลัพธ์

แต่ละ run อยู่ที่ `runs/trip-generation-<unique-id>/`:

- `TGPRO_ALL.csv`: productions 1,778 rows × 16 purpose/ownership segments
- `TGATT_ALL.csv`: balanced attractions จำนวนโซน/segments เดียวกัน
- `trip_generation_zone_results.csv`: zonal diagnostics
- `trip_generation_long.csv`: 28,448 zone/segment rows
- `trip_generation_age_long.csv`: 85,344 age/segment rows
- `trip_generation_totals.json`: segment totals, balance factors, Furness residuals
- `trip_generation_qa.json`: input/QA diagnostics
- `result.json`: completion manifest, input/output SHA256, artifact paths, counts, warnings

`result.json` จะปรากฏหลังเขียนผลครบเท่านั้น หากเขียนล้มเหลวจะเก็บ partial directory ไว้ตรวจสอบ ไม่รายงานว่า completed และไม่ลบ/เขียนทับข้อมูลเก่า

## การเทียบผลและข้อจำกัดเชิงแบบจำลอง

Regression ใช้ input/output คู่เดิม `yr2032_phase5_3_baseline_tg_reproduction` จากสำเนา เปรียบเทียบ 5 CSV tables และ totals/QA กับ golden outputs ทั้งชุด ไม่ใช่เพียงตรวจว่ารันไม่ error

Baseline เดิมมี **age-total mismatch >5% จำนวน 1 โซน** และ **maximum Furness column residual 1.360739** ต้องแสดง warning ไม่แก้สูตรเพื่อทำให้ warning หาย ตาราง seed/rates มีช่องว่างบางรูปแบบที่สูตรเดิมตีความเป็นศูนย์; adapter เก็บพฤติกรรมที่ระบุไว้และแจ้งเตือน

การ reproduce ผลเดิมผ่าน ไม่ได้แปลว่า calibrated แล้ว, ไม่มี input issues, เทียบ Cube ครบ หรือเหมาะกับทุกพื้นที่/ปี ส่วนนี้ยังเป็น `experimental-legacy-reproduction-not-calibration`

สถานะการทดสอบจริงและรายละเอียดการ review อยู่ใน `REVIEW_EBUMPY.md`

ตรวจล่าสุด 31 สิงหาคม 2026: **33/33 tests ผ่าน ไม่มี skip**, totals/QA ตรงกับ golden และ CSV ที่ runner เขียนจริงทั้ง 5 ไฟล์มี SHA256 ตรงกับผลเดิมทุกไฟล์ ผล run ที่ตรวจอยู่ใน `runs/trip-generation-416ef99a71ba4a1eb2c1df1d07976dd8/` ตรวจต้นฉบับ TG ทั้ง 128 ไฟล์หลังรันแล้ว bytes/ขนาด/last-write time ไม่เปลี่ยน

## ตรวจว่าต้นฉบับและสำเนาไม่เปลี่ยน

จาก directory นี้:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\copy_trip_generation.ps1 -VerifyOnly
```

เปรียบเทียบ SHA256, ขนาด และ last-write time ของ Trip Generation ทั้ง 128 ไฟล์กับ manifest ก่อนคัดลอก และ SHA256 ของสำเนาครบ ไม่เขียนอะไรในต้นฉบับ รายงานอยู่ใน `reference/trip-generation-verification.json`

`copy_ebumpy_reference.ps1` เป็น script ของการสำรวจเบื้องต้นก่อนผู้ใช้จำกัดขอบเขต: เก็บ source/config/docs บางส่วนของโมดูลอื่นเป็น reference ที่ไม่รันแล้ว ไม่มีการสร้าง adapter ของโมดูลอื่น ใช้ `-VerifyOnly` ได้แต่ไม่ต้องรัน copy ซ้ำ

## ยังรันจากปุ่มใน THClaws ไม่ได้

**Run Workflow ใน Transport ยังเป็น validation-only และ Result Viewer ยังเป็น demo** งานนี้ทำให้ TG รันแยกจาก source tree ได้ก่อน งานถัดไปคือยืนยัน ports/parameters จาก model จริง แล้วเชื่อม Rust runner + input artifacts + Result Viewer โดยไม่เปลี่ยนสูตรคำนวณ
