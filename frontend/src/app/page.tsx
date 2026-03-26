"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";

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

  const stepConfig = {
    phone: {
      title: "Login to your account",
      description: "Enter your phone number to sign in via Telegram",
    },
    code: {
      title: "Check your Telegram",
      description: "Enter the verification code we sent to your account",
    },
    "2fa": {
      title: "Two-factor authentication",
      description: "Enter your Telegram 2FA password to continue",
    },
  };

  const { title, description } = stepConfig[step];

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <Image src="/logo.svg" alt="Sovereign" width={48} height={48} />
            <h1 className="text-2xl font-bold">Sovereign</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="mb-4 text-sm text-destructive">{error}</p>
              )}

              {step === "phone" && (
                <form onSubmit={handlePhone}>
                  <div className="grid gap-6">
                    <div className="grid gap-2">
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
                  </div>
                </form>
              )}

              {step === "code" && (
                <form onSubmit={handleCode}>
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="code">Verification code</Label>
                      <Input
                        id="code"
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="12345"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setStep("phone");
                          setCode("");
                          setError("");
                        }}
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1" disabled={loading || !code.trim()}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {step === "2fa" && (
                <form onSubmit={handle2FA}>
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your 2FA password"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setStep("code");
                          setPassword("");
                          setError("");
                        }}
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" className="flex-1" disabled={loading || !password.trim()}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground px-2">
            Sovereign is an agentic Telegram client. By signing in, you agree to
            our{" "}
            <a href="https://www.tgsovereign.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="https://www.tgsovereign.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            , and acknowledge that our AI agent will have access to your Telegram
            account data to function on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}
