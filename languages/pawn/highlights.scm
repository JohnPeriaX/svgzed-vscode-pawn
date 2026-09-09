; Pawn / SA-MP highlighting on top of tree-sitter-c.
; Capture names intentionally use Zed's standard theme vocabulary.

(identifier) @variable

((identifier) @constant
  (#match? @constant "^([A-Z][A-Z\\d_]*|INVALID_[A-Za-z0-9_]*)$"))

; Core Pawn control keywords.
"break" @keyword
"case" @keyword
"const" @keyword
"continue" @keyword
"default" @keyword
"do" @keyword
"else" @keyword
"enum" @keyword
"extern" @keyword
"for" @keyword
"if" @keyword
"inline" @keyword
"return" @keyword
"sizeof" @keyword
"static" @keyword
"struct" @keyword
"switch" @keyword
"typedef" @keyword
"union" @keyword
"volatile" @keyword
"while" @keyword

((identifier) @keyword
  (#match? @keyword "^(new|stock|public|native|forward|hook|task|ptask|function|func|state|assert|goto|exit|sleep|foreach|tagof|char|void)$"))

; SA-MP / Pawn common tags and types.
((identifier) @type
  (#match? @type "^(Float|bool|Tag|Text|Menu|PlayerText|Text3D|DB|DBResult|File|Key|FileType|String)$"))

; Preprocessor.
"#define" @keyword
"#elif" @keyword
"#else" @keyword
"#endif" @keyword
"#if" @keyword
"#ifdef" @keyword
"#ifndef" @keyword
"#include" @keyword
(preproc_directive) @keyword

; Operators and delimiters.
"--" @operator
"-" @operator
"-=" @operator
"->" @operator
"=" @operator
"!=" @operator
"*" @operator
"&" @operator
"&&" @operator
"+" @operator
"++" @operator
"+=" @operator
"<" @operator
"==" @operator
">" @operator
">=" @operator
"<=" @operator
"||" @operator
"/" @operator
"%" @operator
"!" @operator
"|" @operator
"^" @operator
"~" @operator
"." @delimiter
";" @delimiter

(string_literal) @string
(system_lib_string) @string
(null) @constant
(number_literal) @number
(char_literal) @number
(field_identifier) @property
(statement_identifier) @label
(type_identifier) @type
(primitive_type) @type
(sized_type_specifier) @type

; Function definitions and calls.
(call_expression
  function: (identifier) @function)
(call_expression
  function: (field_expression
    field: (field_identifier) @function))
(function_declarator
  declarator: (identifier) @function)
(preproc_function_def
  name: (identifier) @function)

; Pawn task comments. Standard Zed capture classes provide distinct theme colors.
((comment) @keyword
  (#match? @keyword "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*TODO\\b"))
((comment) @error
  (#match? @error "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*(FIXME|XXX|WTF|BUG)\\b"))
((comment) @warning
  (#match? @warning "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*(REVIEW|HACK|TBD)\\b"))
((comment) @type
  (#match? @type "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*(NOTE|NB)\\b"))
((comment) @constant
  (#match? @constant "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*IDEA\\b"))
((comment) @string
  (#match? @string "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*DONE\\b"))
((comment) @comment
  (#not-match? @comment "(?i)^[[:space:]]*(//|/\\*)[[:space:]]*(TODO|FIXME|XXX|WTF|BUG|REVIEW|HACK|TBD|NOTE|NB|IDEA|DONE)\\b"))

; SA-MP color literals such as "{FFFFFF}" and "{FF8800AA}".
; Tree-sitter-c exposes strings as one node, so color-aware strings receive
; a constant capture while the VS Code adapter provides a real color picker.
((string_literal) @constant
  (#match? @constant "\\{[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?\\}"))

; SA-MP hex color constants. Pawn/SA-MP commonly uses RGBA ordering,
; for example 0xFF0000FF is opaque red and 0x00FF00FF is opaque green.
((number_literal) @constant
  (#match? @constant "^0[xX][0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$"))

; Common SA-MP color macros/constants.
((identifier) @constant
  (#match? @constant "^COLOR_[A-Za-z0-9_]+$"))
