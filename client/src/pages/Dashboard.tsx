import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryNotifications } from "@/components/InventoryNotifications";
import { TrendChart } from "@/components/TrendChart";
import { ArrowDownIcon, ArrowUpIcon, PackageIcon, AlertTriangle } from "lucide-react";
import type { Item } from "@db/schema";

export function Dashboard() {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: lowStockItems } = useQuery<Item[]>({
    queryKey: ["/api/items/low-stock"],
  });

  const totalItems = items?.length ?? 0;
  const lowStockCount = lowStockItems?.length ?? 0;
  const totalValue = items?.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0) ?? 0;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Inventory Dashboard</h1>

      <div className="grid gap-4 mb-8">
        <TrendChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
            {lowStockCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Items requiring attention
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InventoryNotifications />
      </div>
    </div>
  );
}