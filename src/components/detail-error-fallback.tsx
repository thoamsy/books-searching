import { RotateCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function DetailErrorFallback({
  error,
  reset,
  entityLabel = "详情"
}: {
  error: Error;
  reset: () => void;
  entityLabel?: string;
}) {
  const message = error.message.includes("rate-limited")
    ? "豆瓣详情页当前触发了风控或频率限制，请稍后重试。"
    : `${entityLabel}获取失败，请稍后重试。`;

  return (
    <div className="mx-auto mt-10 w-full max-w-[1240px] px-5 text-center sm:px-8 lg:px-10">
      <div className="rounded-lg border border-border-edge bg-surface px-8 py-12">
        <p className="text-lg text-destructive">{message}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RotateCw data-icon="inline-start" />
            重试
          </Button>
          <Link to="/">
            <Button variant="ghost">返回搜索</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
