import { useMemo, useState } from "react";
import { CalendarDays, Film, LibraryBig, Trash2, Tv } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BookCover } from "@/components/book-cover";
import { DepthLink } from "@/components/depth-link";
import { LoginDialog } from "@/components/login-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  useRemoveWatchedItem,
  watchedItemsQueryOptions,
  type WatchedItem,
} from "@/lib/watched-queries";
import {
  formatWatchedDay,
  formatWatchedMonth,
  getWatchedMonthKey,
} from "@/lib/watched-dates";

interface TimelineGroup {
  key: string;
  label: string;
  items: WatchedItem[];
}

function watchedItemUrl(item: WatchedItem) {
  return item.item_type === "book" ? `/book/${item.item_id}` : `/movie/${item.item_id}`;
}

function mediaKindLabel(item: WatchedItem) {
  if (item.media_kind === "book") return "书籍";
  if (item.media_kind === "tv") return "电视剧";
  return "电影";
}

function MediaKindIcon({ item }: { item: WatchedItem }) {
  if (item.media_kind === "book") return <LibraryBig className="size-3.5" />;
  if (item.media_kind === "tv") return <Tv className="size-3.5" />;
  return <Film className="size-3.5" />;
}

function groupWatchedItems(items: WatchedItem[]): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();

  for (const item of items) {
    const key = getWatchedMonthKey(item.watched_on);
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        key,
        label: formatWatchedMonth(item.watched_on),
        items: [item],
      });
    }
  }

  return [...groups.values()];
}

export function HistoryPage() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [loginOpen, setLoginOpen] = useState(false);
  const { data: watchedItems = [], isLoading } = useQuery(watchedItemsQueryOptions(userId));
  const groups = useMemo(() => groupWatchedItems(watchedItems), [watchedItems]);

  if (loading) {
    return <HistorySkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8">
        <section className="w-full rounded-lg border border-border-edge bg-surface p-8 text-center shadow-warm-sm">
          <h1 className="font-display text-3xl font-medium">看过历史</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            登录后可以记录书、电影和电视剧的看过日期，并在这里按时间回看。
          </p>
          <Button className="mt-6" onClick={() => setLoginOpen(true)}>
            <CalendarDays data-icon="inline-start" />
            登录后查看
          </Button>
        </section>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">Watched</p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-tight sm:text-5xl">
          看过历史
        </h1>
      </header>

      {isLoading ? (
        <HistorySkeleton compact />
      ) : watchedItems.length === 0 ? (
        <section className="rounded-lg border border-border-edge bg-surface p-8 text-center shadow-warm-sm">
          <p className="text-sm text-muted-foreground">
            还没有看过记录。在作品详情页点击“看过”即可添加。
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-10 pb-16">
          {groups.map((group) => (
            <TimelineMonth key={group.key} group={group} />
          ))}
        </div>
      )}
    </main>
  );
}

function TimelineMonth({ group }: { group: TimelineGroup }) {
  return (
    <section className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-8">
      <div className="pt-1">
        <p className="sticky top-5 font-display text-xl font-medium leading-tight sm:text-2xl">
          {group.label}
        </p>
      </div>
      <div className="flex flex-col gap-4 border-l border-border-edge pl-4 sm:pl-6">
        {group.items.map((item) => (
          <TimelineItem key={`${item.item_type}-${item.item_id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function TimelineItem({ item }: { item: WatchedItem }) {
  const removeMutation = useRemoveWatchedItem();

  function handleRemove() {
    removeMutation.mutate({ itemId: item.item_id, itemType: item.item_type });
  }

  return (
    <article className="relative rounded-lg border border-border-edge bg-surface p-3 shadow-warm-sm transition-shadow hover:shadow-warm-md sm:p-4">
      <span className="absolute top-5 -left-[1.35rem] size-2.5 rounded-full border border-background bg-primary sm:-left-[1.85rem]" />
      <div className="flex gap-3 sm:gap-4">
        <DepthLink
          to={watchedItemUrl(item)}
          className="block aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-20"
        >
          <BookCover
            src={item.item_cover_url}
            title={item.item_title}
            className="rounded-lg"
            loading="lazy"
          />
        </DepthLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5">
              <MediaKindIcon item={item} />
              {mediaKindLabel(item)}
            </Badge>
            <Badge variant="secondary">{formatWatchedDay(item.watched_on)}</Badge>
          </div>
          <DepthLink to={watchedItemUrl(item)} className="group mt-2 block">
            <h2 className="line-clamp-2 font-display text-xl font-medium leading-tight group-hover:text-primary sm:text-2xl">
              {item.item_title}
            </h2>
          </DepthLink>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={removeMutation.isPending}
              onClick={handleRemove}
            >
              <Trash2 data-icon="inline-start" />
              {removeMutation.isPending ? "移除中..." : "移除记录"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function HistorySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10">
      {!compact ? (
        <header className="mb-10">
          <Skeleton className="h-4 w-28 rounded-full bg-skeleton" />
          <Skeleton className="mt-4 h-12 w-48 rounded-full bg-skeleton" />
        </header>
      ) : null}
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-8">
        <div>
          <Skeleton className="h-8 w-16 rounded-full bg-skeleton" />
        </div>
        <div className="flex flex-col gap-4 border-l border-border-edge pl-4 sm:pl-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-border-edge bg-surface p-3 shadow-warm-sm sm:p-4"
            >
              <div className="flex gap-3 sm:gap-4">
                <Skeleton className="h-24 w-16 rounded-lg bg-skeleton sm:h-30 sm:w-20" />
                <div className="flex flex-1 flex-col gap-3">
                  <Skeleton className="h-6 w-28 rounded-full bg-skeleton" />
                  <Skeleton className="h-7 w-full max-w-sm rounded-full bg-skeleton" />
                  <Skeleton className="h-7 w-24 rounded-full bg-skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
