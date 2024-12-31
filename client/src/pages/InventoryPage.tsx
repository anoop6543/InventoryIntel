import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Item } from "@db/schema";
import { useUser } from "@/hooks/use-user";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import InventoryTable from "@/components/InventoryTable";
import { Button } from "@/components/ui/button";
import { Plus, Scan } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { ScannerDialog } from "@/components/ScannerDialog";

export default function InventoryPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: items, isLoading, error } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  useWebSocket((data) => {
    queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    toast({
      title: "Inventory Updated",
      description: "The inventory has been updated by another user.",
    });
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Item> & { id: number }) => {
      const response = await fetch(`/api/items/${updates.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load inventory: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex gap-4">
          {/* Make the Scan Item button more prominent */}
          <Button variant="default" size="lg" onClick={() => setIsDialogOpen(true)}>
            <Scan className="h-5 w-5 mr-2" />
            Scan Item
          </Button>
          {user?.role !== 'user' && (
            <Button variant="outline" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Inventory Item</DialogTitle>
          </DialogHeader>
          <ScannerDialog />
        </DialogContent>
      </Dialog>

      <InventoryTable 
        items={items || []}
        onUpdate={(item, updates) => updateMutation.mutate({ id: item.id, ...updates })}
        isUpdating={updateMutation.isPending}
      />
    </div>
  );
}