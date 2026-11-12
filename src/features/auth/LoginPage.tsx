import { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      window.location.href = "/app/dashboard";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      setSuccess("Password reset instructions have been sent to your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send reset email."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-neutral-50">
      {/* Desktop brand panel */}
      <section
        className="hidden lg:flex items-center justify-center min-h-[100dvh] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white relative overflow-hidden px-8"
      >
        <div className="absolute top-[-8%] left-[-8%] w-[420px] h-[420px] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div
          className="absolute bottom-[-12%] right-[-12%] w-[520px] h-[520px] bg-brand-500/15 rounded-full blur-[140px] pointer-events-none"
        />
        <div className="relative z-10 w-full max-w-[560px]">
          <div className="flex flex-col items-start gap-3 mb-10">
            <div className="flex items-center gap-2.5">
              <LockKeyhole className="h-6 w-6 text-brand-300" />
              <span className="font-heading text-2xl font-bold tracking-tight">
                IRIAD<span className="text-brand-300">/IRADEV</span>
              </span>
            </div>
            <p className="text-xs font-semibold tracking-widest text-brand-200 uppercase">
              Internal Operations Portal
            </p>
          </div>

          <div className="space-y-6 mb-10">
            <h1 className="font-heading text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight">
              Better systems. <br /> Greater impact.
            </h1>
            <p className="text-brand-100 text-lg leading-relaxed max-w-[30rem]">
              A central workspace for IRIAD/IRADEV staff to collaborate,
              manage projects, share updates and coordinate organisational
              activities.
            </p>
          </div>

          <footer className="mt-auto flex flex-col gap-1 text-xs text-brand-200/80">
            <span>
              Initiative for Research, Innovation and Advocacy in Development
            </span>
            <span>© {new Date().getFullYear()} IRIAD/IRADEV</span>
          </footer>
        </div>
      </section>

      {/* Sign-in form panel */}
      <section className="flex items-center justify-center min-h-[100dvh] px-6 py-8 md:py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 text-brand-600 mb-4">
              <LockKeyhole size={20} />
            </div>
            <span className="text-xs font-semibold tracking-widest text-brand-600 uppercase">
              Staff Access
            </span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-neutral-900 mt-2">
              Welcome back
            </h2>
            <p className="text-neutral-500 mt-2">
              Sign in to access your IRIAD/IRADEV workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">
                Work email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                />
                <input
                  id="email"
                  type="email"
                  placeholder="name@iriadng.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  className="input pl-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-1">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Password
                </label>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleForgotPassword}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-neutral-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <div className="relative">
              <LockKeyhole
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="input pl-10 pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Sign in to workspace"}
              {!loading && <ArrowRight size={18} className="ml-2" />}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-neutral-600">
            <span>Need access?</span>
            <p className="font-medium text-neutral-800">
              Contact your IRIAD/IRADEV system administrator.
            </p>
          </div>

          <div className="mt-8 p-4 rounded-xl border border-brand-100 bg-brand-50 flex items-center gap-3 text-sm text-brand-700">
            <ShieldCheck size={16} />
            <span>Secure access for authorised IRIAD/IRADEV personnel only.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
