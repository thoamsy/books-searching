import { createBrowserRouter, Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { bookDetailQueryOptions, searchBooksQueryOptions } from "@/lib/book-queries";
import { celebrityDetailQueryOptions, celebrityWorksQueryOptions } from "@/lib/celebrity-queries";
import { collectionItemsQueryOptions } from "@/lib/collection-queries";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import { queryClient } from "@/lib/query-client";
import { BackButton } from "@/components/back-button";
import { UserMenu } from "@/components/user-menu";

function RootLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  return (
    <>
      {!isHome && (
        <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-5 z-10 sm:left-8">
          <BackButton />
        </div>
      )}
      <div className="fixed top-[max(1rem,env(safe-area-inset-top))] right-5 z-10 sm:right-8">
        <UserMenu />
      </div>
      <Outlet />
      <footer className="-mt-10 pb-3 text-center text-[10px] text-[var(--muted-foreground)]/30">
        <a href="https://github.com/thoamsy" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--muted-foreground)]/60">
          @thoamsy
        </a>
      </footer>
      <ScrollRestoration />
    </>
  );
}

function DetailLayout() {
  return (
    <main className="min-h-screen bg-[var(--background)] pb-16 text-[var(--foreground)]">
      <div className="h-[calc(env(safe-area-inset-top)+3.5rem)]" />
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
