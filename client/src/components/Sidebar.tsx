import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import {
  LayoutDashboard,
  Package,
  BarChart,
  LogOut,
  Settings,
  AlertTriangle
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useUser();

  const links = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/inventory", icon: Package, label: "Inventory" },
    { href: "/reports", icon: BarChart, label: "Reports", adminOnly: true },
    { href: "/settings", icon: Settings, label: "Settings", adminOnly: true },
    { href: "/low-stock", icon: AlertTriangle, label: "Low Stock" },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white p-4 flex flex-col">
      <div className="flex items-center gap-3 px-2 py-4">
        <Package className="h-8 w-8" />
        <span className="text-xl font-bold">Inventory Pro</span>
      </div>

      <nav className="flex-1 pt-4">
        {links.map(({ href, icon: Icon, label, adminOnly }) => {
          if (adminOnly && user?.role !== "admin") return null;

          return (
            <Link key={href} href={href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-lg mb-1 hover:bg-slate-800 transition-colors",
                  location === href && "bg-primary text-primary-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 pt-4">
        <div className="px-2 py-2 text-sm text-slate-400">
          Signed in as {user?.username}
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-2 py-2 w-full rounded-lg hover:bg-slate-800 transition-colors text-left"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}