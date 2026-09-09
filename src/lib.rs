use std::env;

use zed_extension_api::{self as zed, DownloadedFileType, LanguageServerId, Result};

const SERVER_URL_PREFIX: &str = "https://github.com/JohnPeriaX/svgzed-vscode-pawn/releases/download/";
const SERVER_FILE: &str = "pawn-language-server.js";
const ASTYLE_WASM_FILE: &str = "libastyle.wasm";
struct PawnExtension;

impl zed::Extension for PawnExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let worktree_bundle = std::path::Path::new(&worktree.root_path())
            .join("dist")
            .join("zed-pawn");
        let extension_dir = env::current_dir()
            .map_err(|error| format!("failed to get extension working directory: {error}"))?;
        let installed_bundle = extension_dir.join("dist").join("zed-pawn");

        // Prefer the opened project's freshly built bundle, then the bundle
        // included inside the installed extension. Only download as a final
        // fallback when neither local bundle exists.
        for bundle_dir in [&worktree_bundle, &installed_bundle] {
            let server_path = bundle_dir.join(SERVER_FILE);
            let wasm_path = bundle_dir.join(ASTYLE_WASM_FILE);
            if server_path.exists() && wasm_path.exists() {
                return Ok(zed::Command {
                    command: zed::node_binary_path()?,
                    args: vec![server_path.to_string_lossy().into_owned(), "--stdio".to_string()],
                    env: Default::default(),
                });
            }
        }

        let server_path = extension_dir.join(SERVER_FILE);
        let version = env!("CARGO_PKG_VERSION");
        let server_url = format!("{}v{}/{}", SERVER_URL_PREFIX, version, SERVER_FILE);
        let wasm_path = extension_dir.join(ASTYLE_WASM_FILE);
        let astyle_wasm_url = format!("{}v{}/{}", SERVER_URL_PREFIX, version, ASTYLE_WASM_FILE);
        if !server_path.exists() {
            zed::download_file(&server_url, SERVER_FILE, DownloadedFileType::Uncompressed)?;
        }
        if !wasm_path.exists() {
            zed::download_file(&astyle_wasm_url, ASTYLE_WASM_FILE, DownloadedFileType::Uncompressed)?;
        }

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path.to_string_lossy().into_owned(), "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(PawnExtension);
