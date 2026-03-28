import { createBrowserRouter } from "react-router-dom";
import { BookDetailPage } from "@/routes/book-detail-page";
import { SearchPage } from "@/routes/search-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SearchPage />
  },
  {
    path: "/book/:workId",
    element: <BookDetailPage />
  }
]);
