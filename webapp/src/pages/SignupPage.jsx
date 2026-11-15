import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { auth, db, generateAccessCode, makeAccessEmail, provisionAuth, signOut } from "../lib/firebase";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";

async function createAdminAccessCode(adminUid) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateAccessCode();
    try {
      await signOut(provisionAuth).catch(() => {});
      const accessCred = await createUserWithEmailAndPassword(provisionAuth, makeAccessEmail(code), code);
      await setDoc(doc(db, "admin_access", accessCred.user.uid), {
        admin_uid: adminUid,
        created_at: serverTimestamp(),
      });
      await setDoc(doc(db, "admins", adminUid), {
        access_code: code,
        access_uid: accessCred.user.uid,
      }, { merge: true });
      await signOut(provisionAuth).catch(() => {});
      return code;
    } catch (err) {
      await signOut(provisionAuth).catch(() => {});
      if (err?.code !== "auth/email-already-in-use" || attempt === 5) throw err;
    }
  }
  throw new Error("Unable to create an administrator access code.");
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", institutionCode: "" });
  const [createdCode, setCreatedCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const code = form.institutionCode.trim().toUpperCase();
      const snap = await getDocs(query(collection(db, "institutions"), where("code", "==", code)));
      const institution = snap.docs[0];

      if (!institution) throw new Error("Institution code was not found.");

      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const institutionData = institution.data();
      const institutionCode = institutionData.code || institutionData.institution_code || code;

      await setDoc(doc(db, "admins", cred.user.uid), {
        email: form.email.trim(),
        institution_id: institution.id,
        institution_code: institutionCode,
        name: form.name.trim(),
        role: "Admin",
        created_at: serverTimestamp(),
      });

      const dashboardCode = await createAdminAccessCode(cred.user.uid);
      localStorage.setItem("safetrak_session_mode", "primary");
      localStorage.setItem("safetrak_admin_uid", cred.user.uid);
      setCreatedCode(dashboardCode);
    } catch (err) {
      const messages = {
        "auth/email-already-in-use": "An account already exists for this email. Use Admin Log In instead.",
        "auth/weak-password": "Use a password with at least 6 characters.",
      };
      setError(messages[err?.code] || err?.message || "Unable to create the account.");
    } finally {
      setLoading(false);
    }
  }

  if (createdCode) {
    return (
      <main className="min-h-screen bg-[#f5f5f5] px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#666] hover:text-black"><ArrowLeft size={17} /> Back</Link>
          <div className="grid min-h-[calc(100vh-100px)] items-center gap-12 lg:grid-cols-2">
            <div>
              <Logo className="w-28 object-contain" />
              <h1 className="mt-8 font-display text-6xl leading-none tracking-tight">You&apos;re <em>ready.</em></h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#555]">Your SafeTrak administrator account has been created. Keep this dashboard code somewhere safe; it can be used to access the admin dashboard later.</p>
            </div>
            <Card className="mx-auto w-full max-w-xl rounded-[28px]">
              <CardContent className="p-7 sm:p-9">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#999]">Administrator access code</p>
                <div className="mt-4 rounded-2xl border border-[#e1e4e9] bg-[#fafbfc] px-5 py-6 text-center">
                  <div className="font-mono text-4xl font-semibold tracking-[0.2em]">{createdCode}</div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-[#777]">This code is for administrators only. You can use it from <strong className="text-[#111]">Log In using Code</strong> on the SafeTrak home page.</p>
                <Button onClick={() => navigate("/students", { replace: true })} className="mt-6 h-12 w-full rounded-xl">Open dashboard</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#666] hover:text-black"><ArrowLeft size={17} /> Back</Link>
        <div className="grid min-h-[calc(100vh-100px)] items-center gap-12 lg:grid-cols-2">
          <div>
            <Logo className="w-28 object-contain" />
            <h1 className="mt-8 font-display text-6xl leading-none tracking-tight">Create your <em>SafeTrak</em> account.</h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#555]">Register a school administrator account using the institution code already configured in your Firestore database.</p>
          </div>
          <Card className="mx-auto w-full max-w-xl rounded-[28px]">
            <CardContent className="p-7 sm:p-9">
              <h2 className="text-2xl font-semibold">Admin sign up</h2>
              <p className="mt-1 text-sm text-[#777]">Your account gets a separate administrator dashboard code after registration.</p>
              <form onSubmit={submit} className="mt-7 space-y-4">
                <Input required placeholder="Full name" value={form.name} onChange={update("name")} />
                <Input required type="email" placeholder="Email address" value={form.email} onChange={update("email")} />
                <Input required type="password" minLength={6} placeholder="Password (6+ characters)" value={form.password} onChange={update("password")} />
                <Input required placeholder="Institution code e.g. CH1234" value={form.institutionCode} onChange={update("institutionCode")} />
                {error && <div className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b33737]">{error}</div>}
                <Button disabled={loading} className="h-12 w-full rounded-xl">
                  {loading && <Loader2 className="animate-spin" size={17} />}
                  {loading ? "Creating..." : "Create account"}
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-[#777]">Already have an account? <Link to="/login" className="font-medium text-black underline">Admin log in</Link></p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
