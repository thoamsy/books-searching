import { createBrowserRouter, Outlet, ScrollRestoration } from "react-router-dom";
import { AuthorPage } from "@/routes/author-page";
import { BookDetailPage } from "@/routes/book-detail-page";
import { MovieDetailPage } from "@/routes/movie-detail-page";
import { SearchPage } from "@/routes/search-page";
import { bookDetailQueryOptions, searchBooksQueryOptions } from "@/lib/book-queries";
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
        element: <SearchPage />
      },
      {
        path: "/book/:workId",
        loader({ params }) {
          if (params.workId) {
            void queryClient.ensureQueryData(bookDetailQueryOptions(params.workId));
          }
          return null;
        },
        element: <BookDetailPage />
      },
      {
        path: "/movie/:subjectId",
        loader({ params }) {
          if (params.subjectId) {
            void queryClient.ensureQueryData(movieDetailQueryOptions(params.subjectId));
          }
          return null;
        },
        element: <MovieDetailPage />
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
        element: <AuthorPage />
      }
    ]
  }
]);
