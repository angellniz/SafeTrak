import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Bell, ChevronDown, Copy, KeyRound, Plus, ShieldCheck, Users, UserRoundCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth, codeAuth, codeDb, db, generateAccessCode, makeAccessEmail, provisionAuth, signOut } from "../lib/firebase";
import Sidebar from "../components/Sidebar";
import StudentTable from "../components/StudentTable";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

function isSafeStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "safe" || value.includes("normal");
}

async function createOrRotateAccessCode(adminUid, adminData, dataDb = db) {
  const oldAccessUid = adminData?.access_uid || null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateAccessCode();
    try {
      // Use a third Auth instance so rotating a code never logs the current
      // administrator out of either the normal or code dashboard session.
      await signOut(provisionAuth).catch(() => {});
      const cred = await createUserWithEmailAndPassword(provisionAuth, makeAccessEmail(code), code);

      // dataDb is authenticated by the currently logged-in administrator/code
      // session, so Firestore rules can verify that it belongs to adminUid.
      await setDoc(doc(dataDb, "admin_access", cred.user.uid), {
        admin_uid: adminUid,
        created_at: serverTimestamp(),
      });

      await updateDoc(doc(dataDb, "admins", adminUid), {
        access_code: code,
        access_uid: cred.user.uid,
      });

      // Invalidate the previous code only after the replacement is fully stored.
      if (oldAccessUid && oldAccessUid !== cred.user.uid) {
        await deleteDoc(doc(dataDb, "admin_access", oldAccessUid)).catch(() => {});
      }

      await signOut(provisionAuth).catch(() => {});
      return code;
    } catch (err) {
      await signOut(provisionAuth).catch(() => {});
      if (err?.code !== "auth/email-already-in-use" || attempt === 5) throw err;
    }
  }

  throw new Error("Unable to generate an administrator access code.");
}

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [institutionName, setInstitutionName] = useState("SafeTrak");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sessionMode, setSessionMode] = useState(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [studentForm, setStudentForm] = useState({
    id: "",
    name: "",
    class_section: "",
    guardian_phone: "",
    status: "Safe",
  });

  useEffect(() => {
    let cancelled = false;
    let primaryUser = null;
    let codeUser = null;
    let primaryReady = false;
    let codeReady = false;
    let loadedMode = null;

    const load = async (mode, user) => {
      if (cancelled || !user || loadedMode === mode) return;
      loadedMode = mode;
      setLoading(true);
      setError("");
      try {
        let dataDb = db;
        let adminUid = user.uid;
        let step = "starting";

        const expectedAdminUid = localStorage.getItem("safetrak_admin_uid");

        if (mode === "primary" && expectedAdminUid && expectedAdminUid !== user.uid) {
          throw new Error("The current Firebase session does not match the administrator account you just logged into. Please log in again.");
        }

        if (mode === "code") {
          dataDb = codeDb;
          step = "reading admin_access";
          const accessSnap = await getDoc(doc(codeDb, "admin_access", user.uid));
          if (!accessSnap.exists()) throw new Error("This dashboard code is no longer active.");
          adminUid = accessSnap.data().admin_uid;

          if (expectedAdminUid && expectedAdminUid !== adminUid) {
            throw new Error("This dashboard code belongs to a different administrator session. Please log in with the newest code.");
          }
        }

        step = "reading admin profile";
        const adminSnap = await getDoc(doc(dataDb, "admins", adminUid));
        if (!adminSnap.exists()) throw new Error("No admin profile was found for this account.");

        let adminData = { id: adminSnap.id, ...adminSnap.data() };
        setAdmin(adminData);
        setSessionMode(mode);

        let institutionData = null;
        if (adminData.institution_id) {
          step = "reading institution";
          const institutionSnap = await getDoc(doc(dataDb, "institutions", adminData.institution_id));
          if (institutionSnap.exists()) institutionData = institutionSnap.data();
        }

        const institutionCode = adminData.institution_code || institutionData?.code || institutionData?.institution_code;
        if (!institutionCode) throw new Error("The admin account is missing its institution code.");

        if (!adminData.institution_code) {
          await updateDoc(doc(dataDb, "admins", adminUid), { institution_code: institutionCode });
          adminData = { ...adminData, institution_code: institutionCode };
          setAdmin(adminData);
        }

        setInstitutionName(institutionData?.name || institutionCode || "SafeTrak");

        step = `reading students for institution ${institutionCode}`;
        const studentSnap = await getDocs(
          query(collection(dataDb, "students"), where("institution_id", "==", institutionCode))
        );
        setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        if (!adminData.access_code || !adminData.access_uid) {
          step = "creating dashboard code";
          const newCode = await createOrRotateAccessCode(adminUid, adminData, dataDb);
          if (!cancelled) {
            setAccessCode(newCode);
            setAdmin((current) => current ? { ...current, access_code: newCode } : current);
          }
        } else {
          setAccessCode(adminData.access_code);
        }
      } catch (err) {
        console.error("STUDENTS PAGE ERROR:", err);
        if (!cancelled) {
          setStudents([]);
          const message = err?.code === "permission-denied"
            ? "Firestore denied this request. Deploy the included firestore.rules to project safetrack-47, then refresh the dashboard."
            : (err?.message || "Unable to load the administrator dashboard.");
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const maybeStart = () => {
      if (!primaryReady || !codeReady || cancelled) return;

      // The login pages explicitly record which session was created. Prefer that
      // session so an old Firebase user cannot silently open another admin's
      // dashboard.
      const preferredMode = localStorage.getItem("safetrak_session_mode");

      if (preferredMode === "code" && codeUser) {
        load("code", codeUser);
      } else if (preferredMode === "primary" && primaryUser) {
        load("primary", primaryUser);
      } else if (primaryUser && !codeUser) {
        load("primary", primaryUser);
      } else if (codeUser && !primaryUser) {
        load("code", codeUser);
      } else if (primaryUser || codeUser) {
        // Both sessions exist but there is no trusted preference. Do not guess.
        // Clear the ambiguous sessions and send the user to the login screen.
        Promise.all([
          signOut(auth).catch(() => {}),
          signOut(codeAuth).catch(() => {}),
        ]).finally(() => {
          localStorage.removeItem("safetrak_session_mode");
          localStorage.removeItem("safetrak_admin_uid");
          if (!cancelled) {
            setLoading(false);
            navigate("/login", { replace: true });
          }
        });
      } else {
        localStorage.removeItem("safetrak_session_mode");
        localStorage.removeItem("safetrak_admin_uid");
        setLoading(false);
        navigate("/login", { replace: true });
      }
    };

    const unsubscribePrimary = onAuthStateChanged(auth, (user) => {
      primaryUser = user;
      primaryReady = true;
      maybeStart();
    });

    const unsubscribeCode = onAuthStateChanged(codeAuth, (user) => {
      codeUser = user;
      codeReady = true;
      maybeStart();
    });

    return () => {
      cancelled = true;
      unsubscribePrimary();
      unsubscribeCode();
    };
  }, [navigate]);

  const stats = useMemo(() => ({
    total: students.length,
    safe: students.filter((s) => isSafeStatus(s.status)).length,
    alerts: students.filter((s) => s.status && !isSafeStatus(s.status)).length,
    online: students.filter((s) => s.last_seen).length,
  }), [students]);

  function openAddStudent() {
    setEditingStudent(null);
    setStudentForm({ id: "", name: "", class_section: "", guardian_phone: "", status: "Safe" });
    setStudentError("");
    setShowStudentForm(true);
  }

  function openEditStudent(student) {
    setEditingStudent(student);
    setStudentForm({
      id: student.id,
      name: student.name || "",
      class_section: student.class_section || "",
      guardian_phone: student.guardian_phone || "",
      status: student.status || "Safe",
    });
    setStudentError("");
    setShowStudentForm(true);
  }

  async function saveStudent(e) {
    e.preventDefault();
    setSavingStudent(true);
    setStudentError("");
    try {
      if (!admin?.institution_code) throw new Error("Your admin account has no institution code.");
      const studentId = studentForm.id.trim().toUpperCase();
      if (!studentId) throw new Error("Enter a SafeTrak card ID.");
      if (!studentForm.name.trim()) throw new Error("Enter the student's name.");

      const dataDb = sessionMode === "code" ? codeDb : db;
      const payload = {
        name: studentForm.name.trim(),
        class_section: studentForm.class_section.trim(),
        guardian_phone: studentForm.guardian_phone.trim(),
        guardian_phone_clean: studentForm.guardian_phone.replace(/\D/g, ""),
        status: studentForm.status,
        institution_id: admin.institution_code,
        updated_at: serverTimestamp(),
      };

      if (editingStudent) {
        await updateDoc(doc(dataDb, "students", studentId), payload);
        setStudents((current) => current.map((s) => s.id === studentId ? { ...s, ...payload } : s));
      } else {
        const ref = doc(dataDb, "students", studentId);
        const existing = await getDoc(ref);
        if (existing.exists()) throw new Error("That card ID is already registered.");
        await setDoc(ref, { ...payload, battery: null, last_seen: null, created_at: serverTimestamp() });
        setStudents((current) => [...current, { id: studentId, ...payload, battery: null, last_seen: null }]);
      }

      setShowStudentForm(false);
    } catch (err) {
      setStudentError(err?.message || "Unable to save the student.");
    } finally {
      setSavingStudent(false);
    }
  }

  async function removeStudent(student) {
    if (!window.confirm(`Remove ${student.name || student.id} from the student roster?`)) return;
    try {
      const dataDb = sessionMode === "code" ? codeDb : db;
      await deleteDoc(doc(dataDb, "students", student.id));
      setStudents((current) => current.filter((s) => s.id !== student.id));
    } catch (err) {
      setError(err?.message || "Unable to remove the student.");
    }
  }

  async function rotateCode() {
    if (!admin?.id) return;
    setCodeLoading(true);
    setError("");
    try {
      const newCode = await createOrRotateAccessCode(admin.id, admin, sessionMode === "code" ? codeDb : db);
      setAccessCode(newCode);
      setAdmin((current) => ({ ...current, access_code: newCode }));
      setShowCode(true);
    } catch (err) {
      setError(err?.message || "Unable to generate a new dashboard code.");
    } finally {
      setCodeLoading(false);
    }
  }

  async function copyCode() {
    if (!accessCode) return;
    await navigator.clipboard.writeText(accessCode);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#111]">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <header className="flex h-[86px] items-center justify-between border-b border-[#e6e8ec] bg-white px-6 lg:px-10">
            <div className="lg:hidden font-semibold">Safetrak</div>
            <div className="ml-auto flex items-center gap-3">
              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-[#777] hover:bg-[#f1f2f4]"><Bell size={19} /></button>
              <div className="flex items-center gap-3 rounded-full border border-[#e6e8ec] bg-white py-1 pl-1 pr-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe2e7] text-sm font-semibold">{(admin?.name || "A").charAt(0).toUpperCase()}</div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-semibold">{admin?.name || "Admin"}</div>
                  <div className="text-[10px] text-[#999]">{institutionName}</div>
                </div>
                <ChevronDown size={14} className="text-[#999]" />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1480px] px-6 py-7 lg:px-10 lg:py-9">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#999]">{institutionName}</p>
                <h1 className="mt-2 font-display text-[44px] leading-none tracking-[-0.04em] sm:text-[54px]">SafeTrak <em>Students</em></h1>
                <p className="mt-3 text-sm text-[#7a7f87]">Manage your student roster and view their current protection status.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setShowCode(true)}><KeyRound size={16} /> Dashboard code</Button>
                <Button className="h-11 rounded-xl" onClick={openAddStudent}><Plus size={17} /> Add student</Button>
              </div>
            </div>

            {error && <div className="mt-6 rounded-2xl border border-[#f0cccc] bg-[#fff7f7] p-4 text-sm text-[#9d3333]"><strong className="font-semibold">Firebase connection:</strong> {error}</div>}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total students" value={stats.total} icon={Users} />
              <StatCard label="Safe" value={stats.safe} icon={ShieldCheck} variant="safe" />
              <StatCard label="Attention needed" value={stats.alerts} icon={Bell} variant="danger" />
              <StatCard label="Tracked cards" value={stats.online} icon={UserRoundCheck} variant="neutral" />
            </div>

            <StudentTable students={students} search={search} onSearch={setSearch} loading={loading} onEdit={openEditStudent} onDelete={removeStudent} />
          </div>
        </div>
      </div>

      {showStudentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setShowStudentForm(false)}>
          <div className="w-full max-w-xl rounded-[28px] border border-[#e2e4e8] bg-white p-7 shadow-2xl sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-2xl font-semibold">{editingStudent ? "Edit student" : "Add new student"}</h2><p className="mt-1 text-sm text-[#777]">The institution is automatically linked to your administrator account.</p></div>
              <button onClick={() => setShowStudentForm(false)} className="rounded-xl p-2 text-[#888] hover:bg-[#f1f2f4]"><X size={19} /></button>
            </div>
            <form onSubmit={saveStudent} className="mt-7 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-medium">SafeTrak card ID<Input required disabled={!!editingStudent} placeholder="e.g. CHR-075" value={studentForm.id} onChange={(e) => setStudentForm((v) => ({ ...v, id: e.target.value.toUpperCase() }))} className="mt-2" /></label>
              <label className="sm:col-span-2 text-sm font-medium">Student name<Input required placeholder="Full name" value={studentForm.name} onChange={(e) => setStudentForm((v) => ({ ...v, name: e.target.value }))} className="mt-2" /></label>
              <label className="text-sm font-medium">Class / section<Input placeholder="e.g. 12-A" value={studentForm.class_section} onChange={(e) => setStudentForm((v) => ({ ...v, class_section: e.target.value }))} className="mt-2" /></label>
              <label className="text-sm font-medium">Guardian phone<Input placeholder="e.g. +91 98765 43210" value={studentForm.guardian_phone} onChange={(e) => setStudentForm((v) => ({ ...v, guardian_phone: e.target.value }))} className="mt-2" /></label>
              <label className="text-sm font-medium sm:col-span-2">Status<select className="mt-2 flex h-11 w-full rounded-xl border border-[#dfe2e7] bg-white px-3 text-sm outline-none focus:border-[#111]" value={studentForm.status} onChange={(e) => setStudentForm((v) => ({ ...v, status: e.target.value }))}><option>Safe</option><option>Alert</option><option>Offline</option></select></label>
              {studentError && <div className="sm:col-span-2 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b33737]">{studentError}</div>}
              <div className="mt-2 flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowStudentForm(false)}>Cancel</Button><Button disabled={savingStudent} type="submit">{savingStudent ? "Saving..." : editingStudent ? "Save changes" : "Add student"}</Button></div>
            </form>
          </div>
        </div>
      )}

      {showCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setShowCode(false)}>
          <div className="w-full max-w-lg rounded-[28px] border border-[#e2e4e8] bg-white p-7 shadow-2xl sm:p-9">
            <div className="flex items-start justify-between"><div><h2 className="text-2xl font-semibold">Admin dashboard code</h2><p className="mt-1 text-sm text-[#777]">Use this code from the SafeTrak home page to sign in without entering the admin password.</p></div><button onClick={() => setShowCode(false)} className="rounded-xl p-2 text-[#888] hover:bg-[#f1f2f4]"><X size={19} /></button></div>
            <div className="mt-7 rounded-2xl border border-[#e1e4e9] bg-[#fafbfc] px-5 py-7 text-center"><div className="font-mono text-4xl font-semibold tracking-[0.2em]">{accessCode || "--------"}</div></div>
            <div className="mt-5 flex gap-3"><Button variant="outline" className="flex-1" onClick={copyCode}><Copy size={16} /> {codeCopied ? "Copied" : "Copy code"}</Button><Button className="flex-1" disabled={codeLoading} onClick={rotateCode}><KeyRound size={16} /> {codeLoading ? "Generating..." : "Generate new"}</Button></div>
            <p className="mt-4 text-xs leading-relaxed text-[#888]">Generating a new code immediately invalidates the previous dashboard code.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value, icon: Icon, variant }) {
  const iconClass = variant === "safe" ? "bg-[#e8f7ef] text-[#21834a]" : variant === "danger" ? "bg-[#fff0f0] text-[#b33737]" : "bg-[#f0f1f3] text-[#555b63]";
  return <div className="rounded-2xl border border-[#e4e7eb] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-[#858a92]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}><Icon size={19} /></div></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-[#f0f1f3]"><div className="h-full w-2/3 rounded-full bg-[#111]" /></div></div>;
}
