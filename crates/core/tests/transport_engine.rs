//! Focused desktop Transport bridge checks using synthetic temporary fixtures.
//! No original model source, copied datasets, or scientific calculations run here.
#![allow(dead_code)]

use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tempfile::TempDir;
use thclaws_core::{sandbox, workdir};

#[path = "../src/transport_engine.rs"]
mod transport_engine;

fn project() -> Value {
    json!({
        "schemaVersion": 2,
        "metadata": {"name": "Synthetic bridge test"},
        "workflow": {
            "nodes": [{
                "id": "generation-node",
                "actionId": "transport.trip_generation",
                "label": "Trip Generation",
                "note": "Synthetic data only",
                "details": "No real calculation is performed",
                "parameters": {"execution": {
                    "mode": "prepared-profile",
                    "profileId": "btds-baseline",
                    "year": 2032
                }},
                "outputNames": {}
            }],
            "edges": []
        },
        "ui": {"nodes": {"generation-node": {"position": {"x": 0, "y": 0}}}}
    })
}

fn validate(value: &Value) -> Result<i64, String> {
    transport_engine::validate_project(value, "generation-node")
}

#[test]
fn prepared_profile_accepts_every_supported_year() {
    for year in [2022, 2027, 2032, 2037, 2042, 2047, 2052, 2057] {
        let mut value = project();
        value["workflow"]["nodes"][0]["parameters"]["execution"]["year"] = json!(year);
        let original = value.clone();
        assert_eq!(validate(&value).unwrap(), year);
        assert_eq!(value, original, "validation must not mutate the workflow");
    }
}

#[test]
fn selected_node_must_exist_once_and_be_trip_generation() {
    assert!(transport_engine::validate_project(&project(), "missing-node").is_err());
    assert!(transport_engine::validate_project(&project(), "").is_err());
    let mut value = project();
    let duplicate = value["workflow"]["nodes"][0].clone();
    value["workflow"]["nodes"].as_array_mut().unwrap().push(duplicate);
    assert!(validate(&value).is_err(), "duplicate selected IDs are ambiguous");
    let mut value = project();
    value["workflow"]["nodes"][0]["actionId"] = json!("transport.trip_distribution");
    assert!(validate(&value).is_err());
}

#[test]
fn validation_rejects_malformed_project_structure() {
    for value in [Value::Null, json!([]), json!({}), json!({"schemaVersion": 1})] {
        assert!(validate(&value).is_err(), "accepted {value}");
    }
    for (pointer, invalid) in [
        ("/schemaVersion", json!(1)),
        ("/schemaVersion", json!("2")),
        ("/workflow", Value::Null),
        ("/workflow/nodes", json!({})),
        ("/workflow/edges", json!({})),
    ] {
        let mut value = project();
        *value.pointer_mut(pointer).unwrap() = invalid;
        assert!(validate(&value).is_err(), "accepted invalid {pointer}");
    }
}

#[test]
fn validation_requires_explicit_supported_profile_and_integer_year() {
    for invalid in [Value::Null, json!(true), json!("2032"), json!(2032.5), json!(2023), json!(1900)] {
        let mut value = project();
        value["workflow"]["nodes"][0]["parameters"]["execution"]["year"] = invalid.clone();
        assert!(validate(&value).is_err(), "accepted invalid year {invalid}");
    }
    for (key, invalid) in [("mode", json!("arbitrary-command")), ("profileId", json!("unknown"))] {
        let mut value = project();
        value["workflow"]["nodes"][0]["parameters"]["execution"][key] = invalid;
        assert!(validate(&value).is_err(), "accepted invalid {key}");
    }
    let mut value = project();
    value["workflow"]["nodes"][0]["parameters"] = json!({});
    assert!(validate(&value).is_err());
}

#[test]
fn unsupported_parameter_overrides_are_not_silently_ignored() {
    let mut value = project();
    value["workflow"]["nodes"][0]["parameters"]["calibrationOverride"] = json!(2.0);
    assert!(validate(&value).is_err());
    let mut value = project();
    value["workflow"]["nodes"][0]["parameters"]["execution"]["command"] = json!("untrusted.exe");
    assert!(validate(&value).is_err());
}

#[test]
fn prepared_profile_refuses_to_ignore_connected_inputs() {
    let mut value = project();
    value["workflow"]["nodes"].as_array_mut().unwrap().push(json!({
        "id": "data-node", "actionId": "data.csv", "label": "Data",
        "note": "", "details": "", "parameters": {}, "outputNames": {},
        "source": {"kind": "file", "path": "synthetic.csv", "format": "csv", "dataType": "table.socioeconomic"}
    }));
    value["workflow"]["edges"] = json!([{
        "id": "edge-1", "source": {"nodeId": "data-node", "portId": "data"},
        "target": {"nodeId": "generation-node", "portId": "socioeconomic_data"}
    }]);
    assert!(validate(&value).is_err());
}

#[test]
fn relative_artifact_resolves_inside_explicit_root() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().canonicalize().unwrap();
    fs::create_dir(root.join("results")).unwrap();
    let expected = root.join("results").join("safe.csv");
    fs::write(&expected, "synthetic").unwrap();
    let before = fs::read(&expected).unwrap();
    let got = transport_engine::bounded_relative(&root, "results/safe.csv").unwrap();
    assert_eq!(got, expected.canonicalize().unwrap());
    assert_eq!(fs::read(&expected).unwrap(), before);
}

#[test]
fn relative_artifact_rejects_escape_and_absolute_forms() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().canonicalize().unwrap();
    fs::write(root.join("safe.csv"), "synthetic").unwrap();
    for relative in [
        "", "../outside.csv", "results/../../outside.csv", "..\\outside.csv",
        "C:\\outside.csv", "C:outside.csv", "/outside.csv", "\\\\server\\share\\outside.csv",
        "safe.csv:stream", "safe.csv\0",
    ] {
        assert!(transport_engine::bounded_relative(&root, relative).is_err(), "accepted {relative:?}");
    }
    assert!(transport_engine::bounded_relative(&root, root.join("safe.csv").to_str().unwrap()).is_err());
}

#[test]
fn relative_artifact_rejects_missing_files_and_directories() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path().canonicalize().unwrap();
    fs::create_dir(root.join("directory")).unwrap();
    assert!(transport_engine::bounded_relative(&root, "missing.csv").is_err());
    assert!(transport_engine::bounded_relative(&root, "directory").is_err());
}

#[test]
fn relative_artifact_rejects_symlink_escape_when_available() {
    let fixture = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let root = fixture.path().canonicalize().unwrap();
    let target = outside.path().join("outside.csv");
    fs::write(&target, "outside synthetic fixture").unwrap();
    let link = root.join("escape.csv");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&target, &link).unwrap();
    #[cfg(windows)]
    if let Err(error) = std::os::windows::fs::symlink_file(&target, &link) {
        if error.raw_os_error() == Some(1314) || error.kind() == std::io::ErrorKind::PermissionDenied {
            eprintln!("SKIP symlink fixture: Windows symbolic-link privilege unavailable ({error})");
            return;
        }
        panic!("create synthetic symlink: {error}");
    }
    assert!(transport_engine::bounded_relative(&root, "escape.csv").is_err());
    assert_eq!(fs::read_to_string(target).unwrap(), "outside synthetic fixture");
}

fn csv_headers(prefix: &str) -> Vec<String> {
    let mut fields = vec!["ZONE".to_string()];
    for purpose in ["HBW", "HBE", "HBO", "NHB"] {
        for vehicle in ["OVEH", "MC", "PC", "MULTI"] {
            fields.push(format!("{prefix}_{purpose}_{vehicle}"));
        }
    }
    fields
}

fn csv_row(zone: &str, number: &str) -> String {
    format!("{zone},{}\n", vec![number; 16].join(","))
}

fn csv_fixture(prefix: &str, rows: &str) -> (TempDir, PathBuf) {
    let fixture = tempfile::tempdir().unwrap();
    let path = fixture.path().join("synthetic.csv");
    fs::write(&path, format!("{}\n{rows}", csv_headers(prefix).join(","))).unwrap();
    (fixture, path)
}

fn preview(path: &Path, port: &str) -> Result<Value, String> {
    transport_engine::preview_csv(path, "trip-generation-synthetic", "generation-node", port)
}

#[test]
fn csv_preview_preserves_zone_identity_numeric_values_and_provenance() {
    let (_fixture, path) = csv_fixture("P", &format!("{}{}", csv_row("001", "12.25"), csv_row("002", "0")));
    let before = fs::read(&path).unwrap();
    let dataset = preview(&path, "productions").unwrap();
    assert_eq!(dataset["origin"], "model");
    assert_eq!(dataset["sourceNodeId"], "generation-node");
    assert_eq!(dataset["sourcePortId"], "productions");
    assert_eq!(dataset["fields"][0]["id"], "ZONE");
    assert_eq!(dataset["fields"][0]["type"], "string");
    assert_eq!(dataset["fields"][1]["type"], "number");
    assert_eq!(dataset["rows"][0]["values"]["ZONE"], "001");
    assert_eq!(dataset["rows"][0]["values"]["P_HBW_OVEH"], 12.25);
    assert_eq!(dataset["rows"][1]["values"]["P_HBW_OVEH"], 0.0);
    assert_ne!(dataset["rows"][0]["id"], dataset["rows"][1]["id"]);
    let fields: Vec<&str> = dataset["fields"].as_array().unwrap().iter().map(|field| field["id"].as_str().unwrap()).collect();
    assert_eq!(fields, csv_headers("P"));
    assert!(dataset.get("geometry").is_none(), "do not invent GIS features");
    assert_eq!(fs::read(&path).unwrap(), before, "preview must not write result data");
    assert_eq!(preview(&path, "productions").unwrap(), dataset, "IDs must be deterministic");
}

#[test]
fn attractions_preview_uses_attraction_columns_and_output_port() {
    let (_fixture, path) = csv_fixture("A", &csv_row("498", "1.5"));
    let dataset = preview(&path, "attractions").unwrap();
    assert_eq!(dataset["sourcePortId"], "attractions");
    assert_eq!(dataset["rows"][0]["values"]["A_HBW_OVEH"], 1.5);
    assert_eq!(dataset["fields"].as_array().unwrap().len(), 17);
    assert!(preview(&path, "productions").is_err(), "wrong port columns must fail");
    assert!(preview(&path, "age_segments").is_err(), "only supported previews are allowed");
}

#[test]
fn csv_preview_rejects_invalid_headers_and_record_widths() {
    for mutation in 0..4 {
        let (_fixture, path) = csv_fixture("P", &csv_row("001", "1"));
        let mut headers = csv_headers("P");
        match mutation {
            0 => headers[0] = "NOT_ZONE".into(),
            1 => headers[2] = headers[1].clone(),
            2 => headers.swap(1, 2),
            _ => { headers.pop(); }
        }
        fs::write(&path, format!("{}\n{}", headers.join(","), csv_row("001", "1"))).unwrap();
        assert!(preview(&path, "productions").is_err(), "accepted invalid headers {mutation}");
    }
    for row in ["001,1\n".to_string(), format!("{},1\n", csv_row("001", "1").trim())] {
        let (_fixture, path) = csv_fixture("P", &row);
        assert!(preview(&path, "productions").is_err(), "accepted wrong-width record");
    }
}

#[test]
fn csv_preview_rejects_nonfinite_and_invalid_numeric_cells() {
    for number in ["NaN", "inf", "-Infinity", "1e999", "not-a-number", ""] {
        let (_fixture, path) = csv_fixture("P", &csv_row("001", number));
        assert!(preview(&path, "productions").is_err(), "accepted {number:?}");
    }
}

#[test]
fn csv_preview_rejects_empty_and_duplicate_zone_identifiers() {
    for rows in [csv_row("", "1"), format!("{}{}", csv_row("001", "1"), csv_row("001", "2"))] {
        let (_fixture, path) = csv_fixture("P", &rows);
        assert!(preview(&path, "productions").is_err());
    }
}

#[test]
fn csv_preview_rejects_empty_files_and_header_only_results() {
    let (_fixture, path) = csv_fixture("P", "");
    assert!(preview(&path, "productions").is_err());
    fs::write(&path, "").unwrap();
    assert!(preview(&path, "productions").is_err());
}

#[test]
fn csv_preview_rejects_oversized_files_before_parsing() {
    let (_fixture, path) = csv_fixture("P", &csv_row("001", "1"));
    fs::OpenOptions::new().write(true).open(&path).unwrap().set_len(5 * 1024 * 1024 + 1).unwrap();
    assert!(preview(&path, "productions").is_err());
}

