import { NewsGallery } from "@/components/news-gallery";
import { HeartButton } from "@/components/ahmad/heart-button";
import { DeletePostButton } from "@/components/ahmad/delete-post-button";
import type { AhmadPostView } from "@/lib/ahmad";
import { formatShortDate } from "@/lib/news";
import { mglDate, mglDigits } from "@/lib/mgl/shared";
import type { Translate } from "@/lib/mgl/server";

// «Ахмад» постын карт — MN (Twitter маягийн) ба MGL (босоо) хувилбар

type CardProps = {
  post: AhmadPostView;
  signedIn: boolean;
  canDelete: boolean;
};

/** Нэрний эхний үсэг (цолыг алгасна): "д/а Б.Болд" → "Б" */
function initial(name: string) {
  const word = name.split(/\s+/).find((w) => w && !w.includes("/")) ?? name;
  return word.charAt(0).toUpperCase() || "А";
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-lg font-bold text-primary"
      aria-hidden
    >
      {initial(name)}
    </span>
  );
}

function StatusBadge({ status }: { status: AhmadPostView["status"] }) {
  if (status === "published") return null;
  return status === "pending" ? (
    <span className="shrink-0 rounded-full bg-yellow-400/15 px-2 py-0.5 text-xs font-semibold text-yellow-400">Хянагдаж буй</span>
  ) : (
    <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">Буцаагдсан</span>
  );
}

export function AhmadPostCard({ post, signedIn, canDelete }: CardProps) {
  const date = new Date(post.publishedAt ?? post.createdAt);
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={`${post.authorName} — пост`}>
      <header className="flex items-start gap-3">
        <Avatar name={post.authorName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{post.authorName}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={date.toISOString()}>{formatShortDate(date)}</time>
            {post.year && <span className="text-primary"> · {post.year} оны зураг</span>}
          </p>
        </div>
        <StatusBadge status={post.status} />
      </header>
      {post.text && <p className="whitespace-pre-line break-words text-foreground/90">{post.text}</p>}
      {post.images.length > 0 && <NewsGallery images={post.images} title={post.authorName} />}
      {(post.status === "published" || canDelete) && (
        <footer className="flex items-center justify-between gap-3">
          {post.status === "published" ? (
            <HeartButton postId={post.id} count={post.hearts} hearted={post.hearted} signedIn={signedIn} />
          ) : (
            <span />
          )}
          {canDelete && <DeletePostButton postId={post.id} />}
        </footer>
      )}
    </article>
  );
}

/** Монгол бичгийн горимд: нэр, огноо, он, дурсамж босоо баганаар; зураг, зүрх доор нь */
export function AhmadPostCardMgl({ post, signedIn, t }: { post: AhmadPostView; signedIn: boolean; t: Translate }) {
  const date = new Date(post.publishedAt ?? post.createdAt);
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-row items-start gap-4 overflow-x-auto pb-1">
        <Avatar name={post.authorName} />
        <p className="mgl-v shrink-0 font-semibold text-foreground">{post.authorName}</p>
        <time dateTime={date.toISOString()} className="mgl-v shrink-0 text-sm text-muted-foreground">
          {mglDate(formatShortDate(date))}
        </time>
        {post.year && (
          <span className="mgl-v shrink-0 text-sm text-primary">
            {mglDigits(String(post.year))} {t("оны зураг")}
          </span>
        )}
        {post.text && <p className="mgl-v h-72 shrink-0 whitespace-pre-line text-foreground/90">{post.text}</p>}
      </div>
      {post.images.length > 0 && <NewsGallery images={post.images} title={post.authorName} vertical />}
      <HeartButton postId={post.id} count={post.hearts} hearted={post.hearted} signedIn={signedIn} vertical />
    </article>
  );
}
