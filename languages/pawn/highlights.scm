; Pawn uses the same highlight capture vocabulary as Zed's C/C++ grammar.
; Colors come entirely from the active Zed theme.

(identifier) @variable

; C/C++-style constants plus common Pawn constants/macros.
((identifier) @constant
 (#match? @constant "^([A-Z][A-Z\\d_]*|INVALID_[A-Za-z0-9_]*)$"))

; C/C++ keywords plus Pawn declaration keywords.
[
  "break" "case" "const" "continue" "default" "do" "else"
  "for" "if" "return" "sizeof" "static" "switch" "while"
  "new" "stock" "public" "native" "forward" "enum" "char"
  "state" "assert" "goto" "exit" "sleep" "hook" "task"
  "ptask" "function" "func"
] @keyword

; Pawn preprocessor directives follow the same keyword capture as C/C++.
[
  "#define" "#elif" "#else" "#endif" "#if" "#ifdef"
  "#ifndef" "#include" "#pragma" "#undef"
] @keyword
(preproc_directive) @keyword

; Operators use the standard C/C++ captures.
[
  "--" "-" "-=" "->" "=" "!=" "*" "&" "&&" "+" "++"
  "+=" "<" "==" ">" ">=" "<=" "||" "/" "%" "!" "|" "^" "~"
] @operator

; Delimiters and punctuation follow the C/C++ palette.
["." ";" "{" "}" "(" ")" "[" "]" "," ":"] @delimiter

(string_literal) @string
(system_lib_string) @string
(char_literal) @number
(number_literal) @number

(null) @constant

(field_identifier) @property
(statement_identifier) @label
(type_identifier) @type
(primitive_type) @type
(sized_type_specifier) @type

; Common Pawn tags and built-in types use the theme's type color.
((identifier) @type
 (#match? @type "^(Float|bool|Tag|Text|Menu|PlayerText|Text3D|DB|DBResult|File|Key|FileType|String)$"))

; Pawn callback/native/stock calls use the same function capture as C/C++.
(call_expression
  function: (identifier) @function)
(call_expression
  function: (field_expression
    field: (field_identifier) @function))
(function_declarator
  declarator: (identifier) @function)
(preproc_function_def
  name: (identifier) @function)

(comment) @comment
