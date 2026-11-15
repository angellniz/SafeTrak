import { NavLink, useNavigate } from "react-router-dom";
import { Bell, CircleHelp, Grid2X2, LayoutDashboard, LogOut, Map, MessageSquare, Settings, UsersRound } from "lucide-react";
import BrandMark from "./BrandMark";
import { auth, codeAuth } from "../lib/firebase";
import { signOut } from "firebase/auth";

const currentPath = window.location.pathname;

const links = [
  { label: "Overview", icon: LayoutDashboard, to: "/students" },
  { label: "Students", icon: UsersRound, to: "/students" },
  { label: "Locations", icon: Map, to: "/students" },
  { label: "Alerts", icon: Bell, to: "/students" },
  { label: "Messages", icon: MessageSquare, to: "/students" },
];

export default function Sidebar() {
  const navigate = useNavigate();

  async function logout() {
    try {
      await Promise.all([signOut(auth), signOut(codeAuth)]);
    } finally {
      localStorage.removeItem("safetrak_session_mode");
      localStorage.removeItem("safetrak_admin_uid");
      navigate("/");
    }
  }

  return (
    <aside className="hidden w-[82px] shrink-0 flex-col border-r border-[#e6e8ec] bg-white lg:flex">
      <div className="flex h-[86px] items-center justify-center border-b border-[#eceef1]">
        <div className="h-10 w-10 overflow-hidden rounded-xl">
          <BrandMark />
        </div>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2 px-3 py-5">
        {links.map(({ label, icon: Icon, to }, index) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `group relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
                (isActive && index === 1) || (!isActive && index === 0 && currentPath === "/students")
                  ? "bg-[#111] text-white"
                  : "text-[#858a92] hover:bg-[#f1f2f4] hover:text-[#111]"
              }`
            }
            title={label}
          >
            <Icon size={19} strokeWidth={1.8} />
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-3 border-t border-[#eceef1] p-4">
        <button onClick={logout} title="Log out" className="flex h-10 w-10 items-center justify-center rounded-xl text-[#858a92] hover:bg-[#f1f2f4] hover:text-[#111]">
          <LogOut size={18} />
        </button>
        <button title="Help" className="flex h-10 w-10 items-center justify-center rounded-xl text-[#858a92] hover:bg-[#f1f2f4] hover:text-[#111]">
          <CircleHelp size={18} />
        </button>
      </div>
    </aside>
  );
}
