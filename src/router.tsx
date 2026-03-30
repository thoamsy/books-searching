import { createBrowserRouter, Outlet, ScrollRestoration } from "react-router-dom";
import { bookDetailQueryOptions, searchBooksQueryOptions } from "@/lib/book-queries";
import { celebrityDetailQueryOptions, celebrityWorksQueryOptions } from "@/lib/celebrity-queries";
import { movieDetailQueryOptions } from "@/lib/movie-queries";
import { queryClient } from "@/lib/query-client";

function RootLayout() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
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
            void queryClient.ensureQueryData(celebrityWorksQueryOptions(params.celebrityId));
          }
          return null;
        },
        lazy: () =>
          import("@/routes/celebrity-page").then((m) => ({ Component: m.CelebrityPage }))
      }
    ]
  }
]);
