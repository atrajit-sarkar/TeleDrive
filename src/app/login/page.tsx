
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, KeyRound, Loader2 } from "lucide-react";
import { Logo } from "@/components/teledrive/Logo";
import { useToast } from "@/hooks/use-toast";
import { startLogin, verifyLogin } from "@/app/actions";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const response = await startLogin(phoneNumber);
    setIsLoading(false);
    if (response.error) {
      setError(response.error);
      toast({ title: "Login Error", description: response.error, variant: "destructive" });
    } else {
      toast({ title: "Code Sent", description: response.message });
      setStep("code");
    }
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const response = await verifyLogin(verificationCode);
    setIsLoading(false);
    if (response.error) {
      setError(response.error);
      toast({ title: "Verification Error", description: response.error, variant: "destructive" });
    } else {
      toast({ title: "Login Successful", description: response.message });
      router.push("/"); // Redirect to dashboard
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Login to TeleDrive</CardTitle>
          <CardDescription className="text-center">
            {step === "phone"
              ? "Enter your Telegram phone number to receive a login code."
              : "Enter the code sent to your Telegram account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">
              {error}
            </div>
          )}
          {step === "phone" && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+12345678900"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full text-lg py-6 bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Smartphone className="mr-2 h-5 w-5" />}
                {isLoading ? "Sending Code..." : "Send Code"}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                 <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <Input
                        id="code"
                        type="text" // Changed to text to allow non-numeric if Telegram sends them
                        placeholder="12345"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        required
                        disabled={isLoading}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                    />
                </div>
              </div>
              <Button type="submit" className="w-full text-lg py-6 bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
                {isLoading ? "Verifying..." : "Verify Code & Log In"}
              </Button>
               <Button variant="link" onClick={() => { setStep("phone"); setError(null); }} className="w-full" disabled={isLoading}>
                Back to phone number entry
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm text-muted-foreground">
          <p>By logging in, you agree to our Terms of Service.</p>
           <Link href="/" className="text-primary hover:underline mt-4">
             Or skip login and view Dashboard with Mock Data (Dev Preview)
           </Link>
        </CardFooter>
      </Card>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        TeleDrive uses Telegram&apos;s official login methods. We do not store your credentials.
      </p>
    </div>
  );
}
