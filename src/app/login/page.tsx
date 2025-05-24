
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Smartphone, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/teledrive/Logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Login to TeleDrive</CardTitle>
          <CardDescription className="text-center">
            Access your Telegram media vault securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="default" className="bg-primary/10 border-primary/50">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Developer Preview</AlertTitle>
            <AlertDescription className="text-primary/90">
              This login page is a placeholder. Real Telegram login (QR code or phone number) requires backend integration with Telegram's API, which is not implemented in this demo.
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <Button variant="outline" className="w-full text-lg py-6" disabled>
              <QrCode className="mr-2 h-6 w-6" /> Log in with QR Code (Placeholder)
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <Input id="phone" type="tel" placeholder="Your Telegram phone number" disabled />
              </div>
            </div>
            <Button type="submit" className="w-full text-lg py-6 bg-primary hover:bg-primary/90" disabled>
              Log in with Phone Number (Placeholder)
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm text-muted-foreground">
          <p>By logging in, you agree to our Terms of Service.</p>
          <Link href="/" className="text-primary hover:underline mt-4">
            Proceed to Dashboard Preview (with Mock Data)
          </Link>
        </CardFooter>
      </Card>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        TeleDrive aims to use Telegram&apos;s official login methods. We do not store your credentials.
      </p>
    </div>
  );
}
