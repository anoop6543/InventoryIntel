
import { Route, Switch } from "wouter";
import { useUser } from "@/hooks/use-user";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import ReportsPage from "@/pages/ReportsPage";
import Sidebar from "@/components/Sidebar";

export default function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 bg-slate-100 p-8">
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/inventory" component={InventoryPage} />
          <Route path="/reports" component={ReportsPage} />
        </Switch>
      </main>
    </div>
  );
}
