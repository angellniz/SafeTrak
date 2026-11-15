import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole, UserRound, Loader2 } from "lucide-react";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getGuardianSession, saveGuardianSession, verifyGuardian } from "../lib/guardian";

export default function GuardianLoginPage() {
  const navigate = useNavigate();
  const [cardId, setCardId] = useState("");
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getGuardianSession()) navigate("/guardian/home", { replace: true });
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const student = await verifyGuardian(cardId, phone);
      saveGuardianSession(student, phone, remember);
      navigate("/guardian/home", { replace: true });
    } catch (err) {
      setError(err?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="guardian-screen guardian-login-screen">
      <div className="guardian-phone-frame guardian-login-frame">
        <div className="guardian-login-top">
          <Link to="/" className="guardian-back"><ArrowLeft size={18} /> Back</Link>
          <div className="guardian-logo-wrap"><Logo className="guardian-login-logo" /></div>
          <h1>SafeTrak</h1>
          <p>Guardian access</p>
        </div>

        <section className="guardian-login-card">
          <div className="guardian-login-heading">
            <h2>Welcome back</h2>
            <p>Enter the details linked to your SafeTrak card.</p>
          </div>

          <form onSubmit={submit} className="guardian-form">
            <label>
              <span>SafeTrak Card ID</span>
              <div className="guardian-input-wrap"><UserRound size={19} /><Input required placeholder="e.g. CHR-101" value={cardId} onChange={(e) => setCardId(e.target.value.toUpperCase())} /></div>
            </label>
            <label>
              <span>Guardian Phone</span>
              <div className="guardian-input-wrap"><LockKeyhole size={19} /><Input required type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </label>

            <div className="guardian-login-options">
              <label className="guardian-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>Remember Me</span></label>
              <span className="guardian-muted-link">Card-based access</span>
            </div>

            {error && <div className="guardian-error">{error}</div>}

            <Button disabled={loading} className="guardian-primary-button">
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Checking..." : "Login"}
            </Button>
          </form>

          <p className="guardian-login-note">This guardian view uses the card and phone number already registered by the school administrator.</p>
          <Link to="/login" className="guardian-admin-link">Admin? Log in to the dashboard</Link>
        </section>
      </div>
    </main>
  );
}
