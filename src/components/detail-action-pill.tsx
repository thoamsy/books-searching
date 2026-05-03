import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  useUpdateWatchedItemDate,
  useUpsertWatchedItem,
  watchedItemsQueryOptions,
} from "@/lib/watched-queries";
import { formatWatchedDay, todayDateValue } from "@/lib/watched-dates";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/login-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverAnchor,
} from "@/components/ui/popover";
import type { WatchedItemRow } from "@/types/supabase";

interface DetailActionPillProps {
  itemId: string;
  itemType: WatchedItemRow["item_type"];
  mediaKind: WatchedItemRow["media_kind"];
  title: string;
  coverUrl: string | null;
  className?: string;
}

export function DetailActionPill({
  itemId,
  itemType,
  mediaKind,
  title,
  coverUrl,
  className,
}: DetailActionPillProps) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const { data: watchedItems = [] } = useQuery(watchedItemsQueryOptions(userId));
  const watchedItem = watchedItems.find(
    (item) => item.item_id === itemId && item.item_type === itemType
  );
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(watchedItem?.watched_on ?? todayDateValue());

  const upsertMutation = useUpsertWatchedItem();
  const updateDateMutation = useUpdateWatchedItemDate();
  const isPending = upsertMutation.isPending || updateDateMutation.isPending;
  const mutationError = upsertMutation.error ?? updateDateMutation.error;

  useEffect(() => {
    if (watchedItem?.watched_on) {
      setSelectedDate(watchedItem.watched_on);
    } else if (!popoverOpen) {
      setSelectedDate(todayDateValue());
    }
  }, [popoverOpen, watchedItem?.watched_on]);

  if (loading) return null;

  function requireLogin() {
    setLoginOpen(true);
  }

  function markWatched(watchedOn: string) {
    if (!userId) {
      requireLogin();
      return;
    }

    upsertMutation.mutate({
      item_id: itemId,
      item_type: itemType,
      media_kind: mediaKind,
      item_title: title,
      item_cover_url: coverUrl,
      watched_on: watchedOn,
    });
  }

  function handlePrimaryClick() {
    if (!userId) {
      requireLogin();
      return;
    }

    if (watchedItem) {
      setPopoverOpen(true);
      return;
    }

    const today = todayDateValue();
    setSelectedDate(today);
    markWatched(today);
  }

  function handleOpenChange(nextOpen: boolean) {
    setPopoverOpen(nextOpen);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      requireLogin();
      return;
    }

    if (watchedItem) {
      updateDateMutation.mutate(
        { itemId, itemType, watchedOn: selectedDate },
        { onSuccess: () => setPopoverOpen(false) }
      );
      return;
    }

    upsertMutation.mutate(
      {
        item_id: itemId,
        item_type: itemType,
        media_kind: mediaKind,
        item_title: title,
        item_cover_url: coverUrl,
        watched_on: selectedDate,
      },
      { onSuccess: () => setPopoverOpen(false) }
    );
  }

  const label = watchedItem ? `已看过 · ${formatWatchedDay(watchedItem.watched_on)}` : "看过";

  return (
    <>
      <div className={cn("mt-5 flex w-full max-w-[280px] flex-wrap items-center gap-2", className)}>
        <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
          <PopoverAnchor asChild>
            <Button
              type="button"
              disabled={isPending}
              aria-pressed={Boolean(watchedItem)}
              className={cn(
                "h-10 w-full rounded-full px-4 text-[0.92rem] shadow-warm-sm has-data-[icon=inline-start]:pl-4 sm:h-11 sm:px-5 sm:text-[0.95rem] sm:has-data-[icon=inline-start]:pl-5 lg:h-12 lg:px-6 lg:text-base lg:shadow-warm-md lg:has-data-[icon=inline-start]:pl-6",
                watchedItem && "bg-primary text-primary-foreground"
              )}
              onClick={handlePrimaryClick}
            >
              {watchedItem ? <CheckCircle2 data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
              <span className="truncate">{isPending ? "保存中..." : label}</span>
            </Button>
          </PopoverAnchor>
          <PopoverContent align="start" sideOffset={10} className="w-72">
            <PopoverHeader>
              <PopoverTitle>{watchedItem ? "修改看过日期" : "标记看过"}</PopoverTitle>
              <PopoverDescription>
                只记录日期，历史会按这个日期排序。
              </PopoverDescription>
            </PopoverHeader>
            <form onSubmit={handleSave}>
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor={`watched-on-${itemType}-${itemId}`}>日期</FieldLabel>
                  <Input
                    id={`watched-on-${itemType}-${itemId}`}
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.currentTarget.value)}
                    required
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? "保存中..." : "保存"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </PopoverContent>
        </Popover>
        {mutationError ? (
          <p role="alert" className="basis-full text-sm text-destructive">
            看过记录保存失败，请稍后重试。
          </p>
        ) : null}
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
