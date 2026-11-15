import { MoreHorizontal, Search, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "./ui/badge";

function isSafeStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "safe" || value.includes("normal");
}

function formatSeen(value) {
  if (!value) return "—";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return String(value);
}

export default function StudentTable({ students, search, onSearch, loading, onEdit, onDelete }) {
  const [menu, setMenu] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const filtered = useMemo(() => students.filter((s) => {
    const term = search.toLowerCase();
    const matchesSearch = [s.name, s.class_section, s.id, s.institution_id, s.guardian_phone].some((v) => String(v || "").toLowerCase().includes(term));
    const normalizedStatus = isSafeStatus(s.status) ? "Safe" : (s.status || "Unknown");
    const matchesStatus = statusFilter === "All" || normalizedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }), [students, search, statusFilter]);

  function exportCsv() {
    const rows = [
      ["Student", "Card", "Class", "Guardian", "Last seen", "Status"],
      ...filtered.map((s) => [s.name || "", s.id || "", s.class_section || "", s.guardian_phone || "", formatSeen(s.last_seen), s.status || "Unknown"]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, `""`)}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "safetrak-students.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-7 rounded-[24px] border border-[#e3e6eb] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#eceef1] p-5 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-[370px]"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa0a8]" size={18} /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search students" className="h-11 w-full rounded-xl border border-[#e1e4e9] bg-[#fafbfc] pl-10 pr-4 text-sm outline-none focus:border-[#111]" /></div>
        <div className="flex items-center gap-2"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 rounded-xl border border-[#e1e4e9] bg-white px-4 text-sm text-[#555] outline-none focus:border-[#111]"><option>All</option><option>Safe</option><option>Alert</option><option>Offline</option><option>Unknown</option></select><button onClick={exportCsv} className="hidden h-11 rounded-xl border border-[#e1e4e9] bg-white px-4 text-sm text-[#555] hover:bg-[#fafafa] md:block">Export</button></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead><tr className="bg-[#f8f9fb] text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9298a1]"><th className="px-6 py-4">Student</th><th className="px-5 py-4">Card</th><th className="px-5 py-4">Class</th><th className="px-5 py-4">Guardian</th><th className="px-5 py-4">Last seen</th><th className="px-5 py-4">Status</th><th className="px-5 py-4"></th></tr></thead>
          <tbody className="divide-y divide-[#eff0f2]">
            {loading ? <tr><td colSpan="7" className="px-6 py-12 text-center text-sm text-[#888]">Loading students from Firestore…</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" className="px-6 py-12 text-center text-sm text-[#888]">No students found.</td></tr> : filtered.map((student) => (
              <tr key={student.id} className="hover:bg-[#fcfcfd]">
                <td className="px-6 py-4"><div className="font-medium text-[#161719]">{student.name || "Unnamed student"}</div><div className="mt-1 text-xs text-[#9aa0a8]">{student.id}</div></td>
                <td className="px-5 py-4 text-sm text-[#565a61]">{student.id}</td><td className="px-5 py-4 text-sm text-[#565a61]">{student.class_section || "—"}</td><td className="px-5 py-4 text-sm text-[#565a61]">{student.guardian_phone || "—"}</td><td className="px-5 py-4 text-sm text-[#565a61]">{formatSeen(student.last_seen)}</td>
                <td className="px-5 py-4"><Badge variant={isSafeStatus(student.status) ? "safe" : String(student.status || "").toLowerCase().includes("alert") ? "danger" : "warning"}>{isSafeStatus(student.status) ? "Safe" : (student.status || "Unknown")}</Badge></td>
                <td className="relative px-5 py-4 text-right"><button onClick={() => setMenu(menu === student.id ? null : student.id)} className="rounded-lg p-2 text-[#8b9098] hover:bg-[#f0f1f3] hover:text-black"><MoreHorizontal size={18} /></button>{menu === student.id && <div className="absolute right-5 top-12 z-20 w-36 rounded-xl border border-[#e2e4e8] bg-white p-1 text-left shadow-lg"><button onClick={() => { setMenu(null); onEdit(student); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#f5f6f8]"><Pencil size={14} /> Edit</button><button onClick={() => { setMenu(null); onDelete(student); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#b33737] hover:bg-[#fff4f4]"><Trash2 size={14} /> Remove</button></div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
