fn main() {
    // Tauri normally embeds the Windows app manifest as a resource of the app binary only.
    // The unit-test harness links the same code (tray, dialogs → Common Controls v6) and would
    // fail to start with STATUS_ENTRYPOINT_NOT_FOUND without it. So we embed one manifest via
    // the linker for every binary instead, and tell tauri-build not to add its own.
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri-build");

    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let manifest = std::path::Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
