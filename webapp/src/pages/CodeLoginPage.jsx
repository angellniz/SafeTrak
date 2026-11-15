import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { codeAuth, codeDb, makeAccessEmail, auth, signOut } from "../lib/firebase";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";

export default function CodeLoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const normalized = code.trim().toUpperCase();

    try {
      if (normalized.length !== 8) throw new Error("Enter the full 8-character SafeTrak dashboard code.");

      // Code login is its own Firebase session. Never let a previously logged-in
      // email/password administrator win the race in StudentsPage.
      await signOut(auth).catch(() => {});
      await signOut(codeAuth).catch(() => {});

      const cred = await signInWithEmailAndPassword(
        codeAuth,
        makeAccessEmail(normalized),
        normalized
      );

      const accessSnap = await getDoc(doc(codeDb, "admin_access", cred.user.uid));
      if (!accessSnap.exists()) {
        await signOut(codeAuth);
        throw new Error("That dashboard code is no longer active.");
      }

      const adminUid = accessSnap.data()?.admin_uid;
      if (!adminUid) {
        await signOut(codeAuth);
        throw new Error("This dashboard code is not linked to an administrator.");
      }

      const adminSnap = await getDoc(doc(codeDb, "admins", adminUid));
      if (!adminSnap.exists() || adminSnap.data()?.role !== "Admin") {
        await signOut(codeAuth);
        throw new Error("The administrator linked to this code could not be found.");
      }

      if (adminSnap.data()?.access_uid !== cred.user.uid) {
        await signOut(codeAuth);
        throw new Error("This dashboard code has been replaced. Use the newest code shown by your administrator dashboard.");
      }

      localStorage.setItem("safetrak_session_mode", "code");
      localStorage.setItem("safetrak_admin_uid", adminUid);

      navigate("/students", { replace: true });
    } catch (err) {
      const messages = {
        "auth/invalid-credential": "That dashboard code is invalid or has been replaced.",
        "auth/user-not-found": "That dashboard code is invalid or has been replaced.",
        "auth/wrong-password": "That dashboard code is invalid or has been replaced.",
      };
      setError(messages[err?.code] || err?.message || "Unable to log in with that code.");
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
            <h1 className="mt-8 font-display text-6xl leading-none tracking-tight">Your <em>dashboard.</em></h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#555]">
              Enter the SafeTrak administrator access code provided inside your dashboard. This code is for administrators only.
            </p>
          </div>

          <Card className="mx-auto w-full max-w-xl rounded-[28px]">
            <CardContent className="p-7 sm:p-9">
              <h2 className="text-2xl font-semibold">Log in using code</h2>
              <p className="mt-1 text-sm text-[#777]">Enter the 8-character administrator dashboard code.</p>

              <form onSubmit={submit} className="mt-7 space-y-4">
                <Input
                  required
                  autoFocus
                  autoCapitalize="characters"
                  maxLength={8}
                  placeholder="e.g. A7K3P9Q2"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="font-mono text-lg tracking-[0.18em]"
                />
                {error && <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b33737]">{error}</div>}
                <Button disabled={loading} className="h-12 w-full rounded-xl">
                  {loading && <Loader2 className="animate-spin" size={17} />}
                  {loading ? "Checking..." : "Open dashboard"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-[#777]">
                Prefer your email and password? <Link to="/login" className="font-medium text-black underline">Admin log in</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
