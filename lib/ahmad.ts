// «Ахмад» — ахмад дайчид, ахмад алба хаагчдын түүхэн зураг, дурсамж (сайтын /ahmad). Админ «Ахмад» эрх олгосон
// хүн пост бичиж, хянагч зөвшөөрсний дараа нийтэд гарна; нэвтэрсэн хүн зүрх дарна. Server болон client аль алинд.

export const AHMAD_LIMITS = {
  text: 1000,
  images: 10,
  // Нэг хүн өдөрт (24 цагт) бичих постын дээд тоо
  perDay: 10,
} as const;

/** Зургийн он — ангийн түүхээс (1921) өнөөдрийг хүртэл */
export const AHMAD_YEAR_MIN = 1921;

export const AHMAD_PER_PAGE = 20;

/** Clerk-ийн publicMetadata-д админы олгосон «Ахмад» эрх */
export function hasAhmadFlag(publicMetadata: unknown): boolean {
  return Boolean(publicMetadata && (publicMetadata as { ahmad?: unknown }).ahmad === true);
}

export type AhmadPostView = {
  id: string;
  authorName: string;
  text: string;
  year: number | null;
  images: string[];
  status: "pending" | "published" | "rejected";
  createdAt: string;
  publishedAt: string | null;
  hearts: number;
  hearted: boolean;
  // Энэ хүний өөрийн пост (устгаж болно)
  mine: boolean;
};
