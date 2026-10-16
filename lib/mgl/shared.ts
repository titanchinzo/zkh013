// Монгол бичгийн (MGL) горимын нийтлэг тодорхойлолт — server болон client аль алинд ашиглана

export type Script = "mn" | "mgl";

// Сонгосон горимыг хадгалах cookie (MN — кирилл, MGL — монгол бичиг)
export const SCRIPT_COOKIE = "script";

const MONGOLIAN_ZERO = 0x1810; // ᠐ — монгол цифрүүд ᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙ дараалсан
// Холбоос, и-мэйл доторх тоог хөрвүүлбэл эвдэрнэ — хэвээр үлдээнэ
const LATIN_TOKENS = /((?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi;

/**
 * Тоог монгол цифрээр бичнэ (1929 → ᠑᠙᠒᠙). Босоо бичвэрт латин тоо хажуу тийшээ хэвтэж харагддаг,
 * монгол цифр харин бусад үсгийн адил босоо урсана. Kimo-гийн Convert-Numbers-тэй ижил үр дүн.
 */
export function mglDigits(text: string): string {
  return text
    .split(LATIN_TOKENS)
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(/[0-9]/g, (digit) => String.fromCharCode(MONGOLIAN_ZERO + Number(digit)))
    )
    .join("");
}

/** Огноо: 2026.10.16 → ᠒᠐᠒᠖᠂᠑᠐᠂᠑᠖ (Kimo-гийн адил цэгийн оронд монгол таслал) */
export function mglDate(formatted: string): string {
  return mglDigits(formatted.replace(/\./g, "᠂"));
}

// Монгол бичгийн фонт (Bolorsoft — Classical Mongolian Dashtseden). globals.css-ийн @font-face-тэй ижил хаяг.
// Файл 1 жил cache-лэгддэг (next.config.ts) тул фонтыг сольвол файлын нэрийг өөрчилнө.
export const MGL_FONT_URL = "/fonts/dashtseden-5.91.ttf";
