; Pawn intentionally uses the standard Zed/C capture vocabulary.
; This lets existing C-oriented themes provide the colors without a custom theme.

(comment) @comment
(string_literal) @string
(number_literal) @number
(char_literal) @string

(primitive_type) @type
(type_identifier) @type

(function_definition
  declarator: (function_declarator
    declarator: (identifier) @function))

(call_expression
  function: (identifier) @function)

(preproc_include) @keyword
(preproc_def) @keyword
(preproc_call) @keyword

; Pawn control flow and declarations are represented by C grammar identifiers.
(identifier) @variable

((identifier) @keyword
  (#match? @keyword "^(if|else|for|while|do|switch|case|default|return|break|continue|goto|exit|sleep|state|assert|sizeof|tagof|foreach)$"))

((identifier) @keyword
  (#match? @keyword "^(new|stock|public|native|forward|const|static|enum|char|void|hook|task|ptask|function|func)$"))

((identifier) @constant
  (#match? @constant "^(true|false|TRUE|FALSE|INVALID_.*)$"))

; Pawn tags such as Float:health. The identifier is kept type-like so C themes
; render it using their existing type palette.
((identifier) @type
  (#match? @type "^(Float|bool|Tag|Text|Menu|PlayerText|Text3D|DB|DBResult|File|Key|FileType)$"))

["+" "-" "*" "/" "%" "=" "==" "!=" "<" ">" "<=" ">=" "&&" "||" "!" "&" "|" "^" "~" "++" "--"] @operator

["{" "}" "(" ")" "[" "]" ";" "," ":"] @punctuation
