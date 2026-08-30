//! Focused persistence checks without compiling unrelated library unit tests
//! (some legacy unit-test modules still import Unix-only APIs on Windows).
#![allow(dead_code)]

use thclaws_core::{sandbox, workdir};

#[path = "../src/transport_project.rs"]
mod transport_project;
