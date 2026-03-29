import { createBrowserRouter } from "react-router-dom";
import { AuthorPage } from "@/routes/author-page";
import { BookDetailPage } from "@/routes/book-detail-page";
import { SearchPage } from "@/routes/search-page";
import { bookDetailQueryOptions, searchBooksQueryOptions } from "@/lib/book-queries";
import { queryClient } from "@/lib/query-client";

export const router = createBrowserRouter([
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
]);
