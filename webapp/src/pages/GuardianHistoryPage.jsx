import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import GuardianShell from "./GuardianShell";
import {
  formatDate,
  formatDateTime,
  getGuardianSession,
  loadGuardianHistory,
  timestampValue,
} from "../lib/guardian";

function groupHistory(items) {
  return items.reduce((groups, item) => {
    const key = formatDate(item.timestamp);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

function normalizedText(value) {
  return String(value || "").trim().toLowerCase();
}

function isSafeEvent(item) {
  const emergency = normalizedText(item?.emergency_status);
  const status = normalizedText(item?.status);
  const fault = normalizedText(item?.fault_detection || item?.fault_status || item?.fault);
  const combined = `${fault} ${status}`;

  // A detected/abnormal fault always wins over a generic SAFE label.
  if (
    combined.includes("detected") ||
    combined.includes("abnormal") ||
    combined.includes("distress") ||
    combined.includes("triggered")
  ) return false;

  return emergency.includes("safe") || status.includes("normal") || fault.includes("normal");
}

function isAlertEvent(item) {
  if (isSafeEvent(item)) return false;

  const emergency = normalizedText(item?.emergency_status);
  const status = normalizedText(item?.status);
  const fault = normalizedText(item?.fault_detection || item?.fault_status || item?.fault);
  const alertType = normalizedText(item?.alert_type);
  const combined = `${emergency} ${status} ${fault} ${alertType}`;

  return (
    combined.includes("detected") ||
    combined.includes("abnormal") ||
    combined.includes("distress") ||
    combined.includes("triggered") ||
    (emergency.includes("emergency") && !emergency.includes("safe") && !emergency.includes("normal")) ||
    alertType.includes("alert") ||
    alertType.includes("fall")
  );
}

function faultLabel(item) {
  // Prefer an explicit fault field when the device provides one.
  const explicit = item?.fault_detection ?? item?.fault_status ?? item?.fault;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    const value = String(explicit).trim();
    if (typeof explicit === "boolean") return explicit ? "FAULT DETECTED" : "NO FAULT DETECTED";
    return value;
  }

  // Preserve the alert/fault label if it is stored there.
  if (item?.alert_type) return String(item.alert_type);

  // The current Firestore logs use status such as "Fall Status: Normal"
  // or "Fall Status: Detected", so keep that visible rather than hiding it.
  if (item?.status) return String(item.status);

  return isSafeEvent(item) ? "NO FAULT DETECTED" : "FAULT DETECTED";
}

function eventTitle(item) {
  if (item.emergency_status) return item.emergency_status;
  if (item.alert_type) return item.alert_type;
  if (item.status) return item.status;
  return "Card activity";
}

function mapUrl(item) {
  const lat = Number(item?.lat);
  const lon = Number(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  const delta = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export default function GuardianHistoryPage() {
  const session = getGuardianSession();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    if (!session?.cardId) return;
    setLoading(true);
    setError("");
    try {
      setHistory(await loadGuardianHistory(session.cardId));
    } catch (err) {
      setError(err?.message || "Unable to load card history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [session?.cardId]);

  const groups = useMemo(() => groupHistory(history), [history]);

  return (
    <GuardianShell active="history">
      <section className="guardian-history-header">
        <div>
          <span>SafeTrak</span>
          <h1>Card History</h1>
          <p>Past safety events and locations recorded for {session?.name || session?.cardId}.</p>
        </div>
        <button onClick={load} className="guardian-refresh" aria-label="Refresh history" disabled={loading}>
          <RefreshCw size={19} className={loading ? "animate-spin" : ""} />
        </button>
      </section>

      {error && <div className="guardian-error guardian-page-error">{error}</div>}

      {loading ? (
        <div className="guardian-loading"><Loader2 className="animate-spin" size={25} /> Loading history...</div>
      ) : history.length === 0 ? (
        <div className="guardian-empty-history">
          <CheckCircle2 size={35} />
          <h2>No history recorded</h2>
          <p>The card has no log entries in Firestore yet.</p>
        </div>
      ) : (
        <div className="guardian-history-groups">
          {Object.entries(groups).map(([date, items]) => (
            <section key={date} className="guardian-history-group">
              <h2><CalendarDays size={14} /> {date}</h2>
              {items.map((item) => {
                const alert = isAlertEvent(item);
                const expanded = expandedId === item.id;
                const map = mapUrl(item);
                const lat = Number(item.lat);
                const lon = Number(item.lon);
                const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);

                return (
                  <article key={item.id} className={`guardian-history-item ${expanded ? "expanded" : ""}`}>
                    <button
                      className="guardian-history-row"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      aria-expanded={expanded}
                    >
                      <div className={`guardian-history-icon ${alert ? "danger" : "safe"}`}>
                        {alert ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                      <div className="guardian-history-copy">
                        <div className="guardian-history-main">
                          <strong>{eventTitle(item)}</strong>
                          <time>{formatDateTime(item.timestamp)}</time>
                        </div>
                        <span>{faultLabel(item)}</span>
                      </div>
                      {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {expanded && (
                      <div className="guardian-history-details">
                        <div className="guardian-history-detail-grid">
                          <div><small>Fault Detection</small><strong>{faultLabel(item)}</strong></div>
                          <div><small>Status</small><strong>{item.status || "Not recorded"}</strong></div>
                          <div><small>Emergency</small><strong>{item.emergency_status || "None"}</strong></div>
                          <div><small>Recorded</small><strong>{formatDateTime(item.timestamp)}</strong></div>
                          <div><small>Location</small><strong>{hasCoordinates ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : "Not recorded"}</strong></div>
                        </div>

                        {hasCoordinates && (
                          <>
                            {map && <iframe className="guardian-history-map" title={`Location at ${formatDateTime(item.timestamp)}`} src={map} loading="lazy" />}
                            <a
                              className="guardian-history-map-link"
                              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MapPin size={15} /> Open this location <ExternalLink size={13} />
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </GuardianShell>
  );
}
