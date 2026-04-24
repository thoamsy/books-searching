import { useState } from "react";
import { SiGithub, SiGoogle } from "@icons-pack/react-simple-icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSeparator,
} from "@/components/ui/field";
import { FieldLabel } from "@/components/ui/field";
import { OpusWordmark } from "@/components/opus-wordmark";

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

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex flex-col items-center gap-2 text-center">
              <img src="/favicon.svg" alt="" className="size-8" />
              <DialogTitle className="flex items-baseline justify-center gap-2 text-2xl font-medium">
                <span className="text-muted-foreground">Welcome to</span>
                <OpusWordmark className="text-[1.6rem]" />
              </DialogTitle>
              <DialogDescription>
                登录以同步搜索历史和收藏
              </DialogDescription>
            </div>
          </DialogHeader>
          <LoginForm onSuccess={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex flex-col items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-8" />
            <DrawerTitle className="flex items-baseline justify-center gap-2 text-2xl font-medium">
              <span className="text-muted-foreground">Welcome to</span>
              <OpusWordmark className="text-[1.6rem]" />
            </DrawerTitle>
            <DrawerDescription>
              登录以同步搜索历史和收藏
            </DrawerDescription>
          </div>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <LoginForm onSuccess={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { enabled, signInWithOAuth, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

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
    } else {
      onSuccess();
    }
  }

  return (
    <FieldGroup>
      {!enabled && (
        <FieldError>当前站点暂未配置登录服务，仍可继续使用本地收藏。</FieldError>
      )}

      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="login-email">邮箱</FieldLabel>
          <Input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!enabled}
            autoComplete="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="login-password">密码</FieldLabel>
          <Input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={!enabled}
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

        <Button type="submit" className="w-full" disabled={submitting || !enabled}>
          {submitting ? "处理中…" : isSignUp ? "注册" : "登录"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "已有账号？" : "没有账号？"}
        <button
          type="button"
          className="ml-1 font-medium text-foreground underline underline-offset-4 transition hover:text-primary"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
            setSignUpSuccess(false);
          }}
          disabled={!enabled}
        >
          {isSignUp ? "去登录" : "注册"}
        </button>
      </p>

      {oauthProviders.length > 0 && (
        <>
          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-popover">
            或
          </FieldSeparator>

          <div className="flex flex-col gap-3">
            {oauthProviders.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                type="button"
                className="w-full"
                disabled={!enabled}
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
  );
}
