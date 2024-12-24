
import { Route, Switch } from "wouter";
import { useUser } from "@/hooks/use-user";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import ReportsPage from "@/pages/ReportsPage";
import LowStockPage from "@/pages/LowStockPage";
import Sidebar from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

export default function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 bg-slate-100 p-8 overflow-y-auto">
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/inventory" component={InventoryPage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/low-stock" component={LowStockPage} />
        </Switch>
      </main>
    </div>
  );
}
