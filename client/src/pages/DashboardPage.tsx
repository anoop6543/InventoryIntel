import { useQuery } from "@tanstack/react-query";
import type { Item } from "@db/schema";
import Dashboard from "@/components/Dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { data: items, isLoading, error } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[100px]" />
          <Skeleton className="h-[100px]" />
          <Skeleton className="h-[100px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load dashboard data: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return <Dashboard items={items || []} />;
}
