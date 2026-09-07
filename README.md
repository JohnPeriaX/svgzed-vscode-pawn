# Pawn for Zed

Pawn language support for Zed, built from the existing open.mp / SA-MP Pawn tooling ecosystem.

## What is implemented

- `.pwn`, `.inc`, `.pawn`, and `.p` language detection.
- Tree-sitter-backed parsing using the stable `tree-sitter-c` grammar as the first parser layer.
- Pawn-specific highlighting queries using standard Zed captures such as `@keyword`, `@function`, `@type`, `@string`, `@number`, `@comment`, `@variable`, `@operator`, and `@punctuation`.
- Language-provided tasks for `pawncc` and `sampctl`.
- A bundled Node-based Pawn language server derived from `openmultiplayer/vscode-pawn`.
- Completion, hover, signature help, and go-to-definition from the existing Pawn parser.

## Why the C grammar

This is deliberate for the first milestone. Zed themes already have strong C-family styling, and the Pawn syntax is close enough to C that it gives us a useful, fast parser while we build a Pawn-specific grammar.

The highlight queries do not define colors. They use Zed's normal capture names so the active theme decides the palette.

## Build tasks

The extension contributes these tasks:

- `Pawn: Build current file` using `pawncc` from PATH.
- `Pawn: Build with sampctl`.
- `Pawn: Build sampctl profile dev`.
- `Pawn: Build sampctl profile release`.

For a custom compiler path or custom arguments, copy the task into the project's `.zed/tasks.json` and change `command` and `args`. Zed also supports `ZED_FILE`, `ZED_WORKTREE_ROOT`, and related task variables.

## Source reference

The language-server implementation is based on `openmultiplayer/vscode-pawn` in `vscode-pawn-master` supplied for this project. The original project provides the Pawn syntax definition and the parser used for completion, hover, signatures, and definitions.

## Next milestone

Replace the C parser layer with a real `tree-sitter-pawn` grammar while keeping the same Zed capture vocabulary. Then add compiler-aware diagnostics and explicit Pawn build/compile configuration so `pawncc` and `sampctl` can be selected independently.
