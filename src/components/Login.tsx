import React from "react";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet2, LogIn } from "lucide-react";
import { toast } from "sonner";

export function Login() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Succesfully logged in!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to login with Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <Card className="w-full max-w-md border-none shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
              <Wallet2 className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-gray-900">FinTrack</CardTitle>
          <CardDescription className="text-gray-500 mt-2">
            Your personal financial companion. Track commitments, analyze payslips, and build wealth.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-10">
          <div className="space-y-4">
            <Button 
              className="w-full h-12 text-lg font-semibold rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] gap-3"
              onClick={handleGoogleLogin}
            >
              <LogIn className="h-5 w-5" />
              Sign in with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground pt-4">
              Secure authentication powered by Google. 
              Your data is encrypted and only accessible by you.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
