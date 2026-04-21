import { createBrowserRouter, Outlet, ScrollRestoration } from "react-router-dom";
import { bookDetailQueryOptions, searchBooksQueryOptions } from "@/lib/book-queries";
import { bookmarksQueryOptions } from "@/lib/bookmark-queries";
import { celebrityDetailQueryOptions, celebrityWorksQueryOptions } from "@/lib/celebrity-queries";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import { queryClient } from "@/lib/query-client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { TopBar } from "@/components/top-bar";

function RootLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <TopBar />
      <Outlet />
      <footer className="-mt-10 pb-3 text-center text-[10px] text-muted-foreground/30">
        <a href="https://github.com/thoamsy" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-muted-foreground/60">
          @thoamsy
        </a>
      </footer>
      <ScrollRestoration />
    </div>
  );
}

function DetailLayout() {
  return (
    <main className="min-h-screen bg-background pb-16 text-foreground">
      <Outlet />
    </main>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        loader() {
          if (!isSupabaseConfigured || !supabase) {
            void queryClient.ensureQueryData(bookmarksQueryOptions(null));
            return null;
          }

          void supabase.auth.getSession().then(({ data: { session } }) => {
            void queryClient.ensureQueryData(
              bookmarksQueryOptions(session?.user?.id ?? null)
            );
          });
          return null;
        },
        lazy: () =>
          import("@/routes/search-page").then((m) => ({ Component: m.SearchPage }))
      },
      {
        element: <DetailLayout />,
        children: [
          {
            path: "/book/:workId",
            loader({ params }) {
              if (params.workId) {
                void queryClient.ensureQueryData(bookDetailQueryOptions(params.workId));
              }
              return null;
            },
            lazy: () =>
              import("@/routes/book-detail-page").then((m) => ({ Component: m.BookDetailPage }))
          },
          {
            path: "/movie/:subjectId",
            loader({ params }) {
              if (params.subjectId) {
                void queryClient.ensureQueryData(movieDetailQueryOptions(params.subjectId));
              }
              return null;
            },
            lazy: () =>
              import("@/routes/movie-detail-page").then((m) => ({ Component: m.MovieDetailPage }))
          },
          {
            path: "/author/:authorName",
            loader({ params }) {
              if (params.authorName) {
                void queryClient.ensureQueryData(
                  searchBooksQueryOptions(decodeURIComponent(params.authorName))
                );
              }
              return null;
            },
            lazy: () =>
              import("@/routes/author-page").then((m) => ({ Component: m.AuthorPage }))
          },
          {
            path: "/celebrity/:celebrityId",
            loader({ params }) {
              if (params.celebrityId) {
                void queryClient.ensureQueryData(celebrityDetailQueryOptions(params.celebrityId));
              }
              return null;
            },
            lazy: () =>
              import("@/routes/celebrity-page").then((m) => ({ Component: m.CelebrityPage }))
          },
          {
            path: "/collection/:collectionId",
            loader({ params }) {
              if (params.collectionId) {
                void queryClient.ensureInfiniteQueryData(
                  collectionItemsQueryOptions(params.collectionId)
                );
              }
              return null;
            },
            lazy: () =>
              import("@/routes/collection-page").then((m) => ({
                Component: m.CollectionPage
              }))
          }
        ]
      }
    ]
  }
]);
