// Монгол бичгийн (MGL) горимын нийтлэг тодорхойлолт — server болон client аль алинд ашиглана

export type Script = "mn" | "mgl";

// Сонгосон горимыг хадгалах cookie (MN — кирилл, MGL — монгол бичиг)
export const SCRIPT_COOKIE = "script";

// Монгол бичгийн фонт (Bolorsoft — Classical Mongolian Dashtseden). globals.css-ийн @font-face-тэй ижил хаяг.
// Файл 1 жил cache-лэгддэг (next.config.ts) тул фонтыг сольвол файлын нэрийг өөрчилнө.
export const MGL_FONT_URL = "/fonts/dashtseden-5.91.ttf";
