"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function AuthPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });

      if (error) throw error;

      router.push("/profiles");
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <Sparkles className="w-12 h-12 text-red-600 mr-2" />
          <h1 className="text-4xl font-bold text-red-600">StreamCorn</h1>
        </div>

        {/* Auth Card */}
        <div className="bg-black/70 backdrop-blur-sm border border-gray-800 rounded-lg p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white mb-2">
            Login or sign up to continue
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            {step === "phone"
              ? "Enter mobile number to login"
              : "Enter the OTP sent to your mobile"}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-md mb-6 text-sm">
              {error}
            </div>
          )}

          {step === "phone" ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Enter mobile number
                </label>
                <div className="flex gap-2">
                  <div className="bg-gray-900 border border-gray-700 rounded-md px-4 py-2 text-white flex items-center">
                    +91
                  </div>
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    maxLength={10}
                    className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-red-600"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  By proceeding you confirm that you are above 18 years of age
                  and agree to the Privacy Policy & Terms of Use.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-12 text-base"
                disabled={loading || phone.length !== 10}
              >
                {loading ? "Sending OTP..." : "Continue"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-blue-500 hover:underline text-sm"
                >
                  Having trouble logging in? Get Help
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Enter OTP
                </label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-red-600 text-center text-2xl tracking-widest"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  OTP sent to +91{phone}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-12 text-base"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="text-blue-500 hover:underline"
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
