"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Step = "phone" | "code" | "2fa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ phone_code_hash: string }>("/api/auth/send-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setPhoneCodeHash(res.phone_code_hash);
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string | null; next: string | null }>(
        "/api/auth/verify-code",
        {
          method: "POST",
          body: JSON.stringify({ phone, code, phone_code_hash: phoneCodeHash }),
        },
      );
      if (res.next === "2fa") {
        setStep("2fa");
      } else if (res.token) {
        setToken(res.token);
        router.push("/chat");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string }>("/api/auth/verify-2fa", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      });
      setToken(res.token);
      router.push("/chat");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sovereign</CardTitle>
          <CardDescription>Sign in with Telegram</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive text-center">{error}</p>
          )}

          {step === "phone" && (
            <form onSubmit={handlePhone} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !phone.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Code
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code.trim() && !loading) {
                      e.preventDefault();
                      handleCode(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Enter code from Telegram"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Code
              </Button>
            </form>
          )}

          {step === "2fa" && (
            <form onSubmit={handle2FA} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Two-factor password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password.trim() && !loading) {
                      e.preventDefault();
                      handle2FA(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Enter your 2FA password"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !password.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
