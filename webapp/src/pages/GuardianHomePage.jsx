import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, RefreshCw, ShieldCheck } from "lucide-react";
import GuardianShell from "./GuardianShell";
import { formatDateTime, getGuardianSession, timestampValue, watchLocation, watchStudent } from "../lib/guardian";
import Logo from "../components/Logo";

function safeStatus(value) {
  const text = String(value || "").toLowerCase();
  return text === "safe" || text.includes("normal");
}

function mapUrl(location) {
  if (!location?.lat || !location?.lon) return "";
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  const delta = 0.008;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export default function GuardianHomePage() {
  const session = getGuardianSession();
  const [student, setStudent] = useState(null);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!session?.cardId) return undefined;
    const stopStudent = watchStudent(session.cardId, setStudent, (err) => setError(err?.message || "Unable to read card status."));
    const stopLocation = watchLocation(session.cardId, setLocation, (err) => setLocationError(err?.message || "Unable to read card location."));
    return () => { stopStudent(); stopLocation(); };
  }, [session?.cardId]);

  const map = useMemo(() => mapUrl(location), [location]);
  const isSafe = safeStatus(student?.status);
  const locationTime = timestampValue(location?.updated_at);

  return (
    <GuardianShell active="home">
      <section className="guardian-hero">
        <div>
          <h1>{student?.name || session?.name || "Student Name"}</h1>
          <p>Card {student?.id || session?.cardId}</p>
        </div>
        <Logo className="guardian-small-logo" />
      </section>

      <section className="guardian-status-block">
        <div className="guardian-stat-row"><span>Battery :</span><strong>{student?.battery == null ? "—" : `${student.battery}%`}</strong></div>
        <div className="guardian-stat-row"><span>Status of Card :</span><strong className={isSafe ? "safe" : "alert"}>{student?.status || "Checking..."}</strong></div>
        {student?.last_event && <div className="guardian-event-line"><span>Last event</span><strong>{student.last_event}</strong></div>}
      </section>

      {error && <div className="guardian-error guardian-page-error">{error}</div>}

      <section className="guardian-map-wrap">
        {map ? <iframe title="SafeTrak live location" src={map} loading="lazy" /> : <div className="guardian-map-empty"><MapPin size={38} /><span>{locationError || "Waiting for the card to report a location..."}</span></div>}
        <div className="guardian-map-badge"><Navigation size={16} /> Live location</div>
      </section>

      <section className="guardian-location-panel">
        <div className="guardian-location-title"><MapPin size={24} /><div><span>Location</span><small>{locationTime ? `Updated ${formatDateTime(location.updated_at)}` : "No location update yet"}</small></div></div>
        {location && <p className="guardian-coordinates">{Number(location.lat).toFixed(6)}, {Number(location.lon).toFixed(6)}</p>}
      </section>

      <section className="guardian-quick-history">
        <div className="guardian-section-title"><span>Card activity</span><a href="/guardian/history">View history</a></div>
        <div className="guardian-history-hint"><ShieldCheck size={21} /><div><strong>{isSafe ? "Card is currently safe" : "Attention may be needed"}</strong><span>{student?.last_seen ? `Last seen ${formatDateTime(student.last_seen)}` : "Waiting for the latest card update"}</span></div></div>
        <a className="guardian-history-button" href="/guardian/history">Open card history <RefreshCw size={16} /></a>
      </section>
    </GuardianShell>
  );
}
