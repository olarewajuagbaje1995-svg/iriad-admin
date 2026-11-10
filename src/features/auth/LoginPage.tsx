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
import "./LoginPage.css";

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
      window.location.href = "/dashboard";
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
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-content">
          <div className="brand-logo">
            <div className="brand-mark">IRIAD</div>
            <span>INTERNAL OPERATIONS PORTAL</span>
          </div>

          <div className="brand-message">
            <span className="brand-eyebrow">KNOWLEDGE. INCLUSION. IMPACT.</span>
            <h1>
              Better systems.
              <br />
              Greater impact.
            </h1>
            <p>
              A central workspace for IRIAD staff to collaborate,
              manage projects, share updates and coordinate
              organisational activities.
            </p>
          </div>

          <div className="brand-footer">
            <span>Initiative for Research, Innovation and Advocacy in Development</span>
            <span>© {new Date().getFullYear()} IRIAD</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-container">
          <div className="mobile-brand">
            <div className="brand-mark">IRIAD</div>
            <span>INTERNAL OPERATIONS PORTAL</span>
          </div>

          <div className="login-heading">
            <div className="welcome-icon">
              <LockKeyhole size={23} />
            </div>

            <span className="login-overline">STAFF ACCESS</span>
            <h2>Welcome back</h2>
            <p>Sign in to access your IRIAD workspace.</p>
          </div>

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Work email address</label>
            <div className="login-input">
              <Mail size={19} />
              <input
                id="email"
                type="email"
                placeholder="name@iriadng.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="password-label">
              <label htmlFor="password">Password</label>
              <button
                type="button"
                className="forgot-link"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>

            <div className="login-input">
              <LockKeyhole size={19} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-success">{success}</div>}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Sign in to workspace"}
              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="login-security">
            <ShieldCheck size={18} />
            <span>Secure access for authorised IRIAD personnel only.</span>
          </div>

          <div className="login-bottom">
            <span>Need access?</span>
            <p>Contact your IRIAD system administrator.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
