import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";

const oauthProviders = [
  {
    id: "google" as const,
    label: "使用 Google 登录",
    icon: SiGoogle,
    enabled: !!import.meta.env.VITE_OAUTH_GOOGLE,
  },
  {
    id: "github" as const,
    label: "使用 GitHub 登录",
    icon: SiGithub,
    enabled: !!import.meta.env.VITE_OAUTH_GITHUB,
  },
].filter((p) => p.enabled);

export function LoginPage() {
  const { user, loading, signInWithOAuth, signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = isSignUp
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else if (isSignUp) {
      setSignUpSuccess(true);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5">
      <Link
        to="/"
        className="fixed top-4 left-5 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground sm:left-8"
      >
        <ArrowLeft className="size-4" />
        返回
      </Link>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card className="overflow-hidden p-0">
          <CardContent className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <img src="/favicon.svg" alt="" className="size-8" />
                <h1 className="text-2xl font-bold">Welcome to Opus</h1>
                <p className="text-balance text-muted-foreground">
                  登录以同步搜索历史和收藏
                </p>
              </div>

              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="email">邮箱</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  <FieldDescription className={cn(!isSignUp && "invisible")}>
                    至少 6 个字符
                  </FieldDescription>
                </Field>

                {error && <FieldError>{error}</FieldError>}

                {signUpSuccess && (
                  <p className="text-sm text-muted-foreground">
                    注册成功！请查收验证邮件。
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "处理中…" : isSignUp ? "注册" : "登录"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                {isSignUp ? "已有账号？" : "没有账号？"}
                <button
                  type="button"
                  className={cn(
                    "ml-1 font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
                  )}
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setSignUpSuccess(false);
                  }}
                >
                  {isSignUp ? "去登录" : "注册"}
                </button>
              </p>

              {oauthProviders.length > 0 && (
                <>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    或
                  </FieldSeparator>

                  <div className="flex flex-col gap-3">
                    {oauthProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        variant="outline"
                        type="button"
                        className="w-full"
                        onClick={() => signInWithOAuth(provider.id)}
                      >
                        <provider.icon data-icon="inline-start" />
                        {provider.label}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
