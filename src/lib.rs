use zed_extension_api::{self as zed, DownloadedFileType, LanguageServerId, Result};

const SERVER_URL: &str = "https://github.com/JohnPeriaX/svgzed-vscode-pawn/releases/download/v0.1.1/pawn-language-server.js";
const SERVER_FILE: &str = "pawn-language-server.js";

struct PawnExtension;

impl zed::Extension for PawnExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        zed::download_file(SERVER_URL, SERVER_FILE, DownloadedFileType::Uncompressed)?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![SERVER_FILE.to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(PawnExtension);
