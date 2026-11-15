import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { auth, codeAuth, db, signOut } from "../lib/firebase";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  async function resetPassword() {
    const normalizedEmail = email.trim();
    setError("");
    setResetMessage("");
    if (!normalizedEmail) {
      setError("Enter your administrator email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetMessage("Password reset instructions have been sent to your email.");
    } catch (err) {
      const messages = {
        "auth/invalid-email": "Enter a valid email address.",
        "auth/user-not-found": "No SafeTrak admin account exists for this email.",
      };
      setError(messages[err?.code] || err?.message || "Unable to send password reset instructions.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setResetMessage("");
    setLoading(true);

    try {
      // A login must always start from a clean Firebase session. This prevents
      // an old administrator account from being reused after a logout/browser
      // restart.
      await signOut(auth).catch(() => {});
      await signOut(codeAuth).catch(() => {});

      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const adminSnap = await getDoc(doc(db, "admins", cred.user.uid));

      if (!adminSnap.exists() || adminSnap.data()?.role !== "Admin") {
        await signOut(auth);
        throw new Error("This Firebase account is not registered as a SafeTrak administrator.");
      }

      localStorage.setItem("safetrak_session_mode", "primary");
      localStorage.setItem("safetrak_admin_uid", cred.user.uid);

      const destination = location.state?.from || "/students";
      navigate(destination, { replace: true });
    } catch (err) {
      const messages = {
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/user-not-found": "No SafeTrak admin account exists for this email.",
        "auth/wrong-password": "The email or password is incorrect.",
        "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      };
      setError(messages[err?.code] || err?.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#666] hover:text-black">
          <ArrowLeft size={17} /> Back
        </Link>

        <div className="grid min-h-[calc(100vh-100px)] items-center gap-12 lg:grid-cols-2">
          <div>
            <Logo className="w-28 object-contain" />
            <h1 className="mt-8 font-display text-6xl leading-none tracking-tight">Welcome <em>back.</em></h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#555]">
              Log in with the administrator email and password you created for SafeTrak.
            </p>
          </div>

          <Card className="mx-auto w-full max-w-xl rounded-[28px]">
            <CardContent className="p-7 sm:p-9">
              <h2 className="text-2xl font-semibold">Admin log in</h2>
              <p className="mt-1 text-sm text-[#777]">This opens the protected administrator dashboard.</p>

              <form onSubmit={submit} className="mt-7 space-y-4">
                <Input required type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input required type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

                <div className="flex justify-end">
                  <button type="button" onClick={resetPassword} className="text-xs font-medium text-[#555] underline underline-offset-4 hover:text-black">
                    Forgot password?
                  </button>
                </div>

                {error && <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b33737]">{error}</div>}
                {resetMessage && <div className="rounded-xl bg-[#eef9f2] px-4 py-3 text-sm text-[#287548]">{resetMessage}</div>}

                <Button disabled={loading} className="h-12 w-full rounded-xl">
                  {loading && <Loader2 className="animate-spin" size={17} />}
                  {loading ? "Logging in..." : "Log in"}
                </Button>
              </form>

              <div className="mt-6 space-y-3 text-center text-sm text-[#777]">
                <p>Need the quick dashboard code? <Link to="/login-code" className="font-medium text-black underline">Log in using code</Link></p>
                <p>New administrator? <Link to="/signup" className="font-medium text-black underline">Create an account</Link></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
