/** Сайт руу оруулсан бичлэг — хөтчийн өөрийн тоглуулагчаар (бүтэн дэлгэц, хурд, татах зэрэг нь хамт) */
export function NewsVideo({ src, title, poster }: { src: string; title: string; poster?: string }) {
  return (
    <video
      src={src}
      poster={poster}
      title={title}
      controls
      playsInline
      // Зөвхөн эхний хэсгийг (үргэлжлэх хугацаа, эхний кадр) татна — бүтэн файлыг тоглуулах үед л
      preload="metadata"
      className="aspect-video w-full rounded-md border border-border bg-black object-contain"
    />
  );
}
