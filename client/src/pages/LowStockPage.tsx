
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LowStockPage() {
  const { toast } = useToast();
  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const lowStockItems = items?.filter(
    (item) => item.quantity <= item.minQuantity
  ) || [];

  const calculateProjectedStockoutDate = (item: Item) => {
    // Assuming average daily usage is 10% of minimum quantity
    const dailyUsage = item.minQuantity * 0.1;
    const daysUntilStockout = Math.floor(item.quantity / dailyUsage);
    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + daysUntilStockout);
    return stockoutDate.toLocaleDateString();
  };

  const notifySupplier = async (items: Item[]) => {
    try {
      const response = await fetch("/api/notify-supplier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(items),
      });
      
      if (!response.ok) throw new Error("Failed to notify supplier");
      
      toast({
        title: "Success",
        description: "Supplier notification sent successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send supplier notification",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Low Stock Items</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Items Below Minimum Quantity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Minimum Stock</TableHead>
                <TableHead>Projected Stockout</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.minQuantity}</TableCell>
                  <TableCell>{calculateProjectedStockoutDate(item)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => notifySupplier([item])}
                    >
                      Notify Supplier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {lowStockItems.length > 0 && (
            <div className="mt-4">
              <Button onClick={() => notifySupplier(lowStockItems)}>
                Notify All Suppliers
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
