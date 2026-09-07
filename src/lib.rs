use zed_extension_api::{self as zed, LanguageServerId, Result};

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
        let server = r"C:\Users\JohnP\Desktop\zed-pawn\server\pawn-language-server.js";

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server.to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(PawnExtension);
