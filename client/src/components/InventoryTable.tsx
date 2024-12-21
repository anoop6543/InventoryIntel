import { useState } from "react";
import type { Item } from "@db/schema";
import { useUser } from "@/hooks/use-user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, X } from "lucide-react";

interface InventoryTableProps {
  items: Item[];
  onUpdate: (item: Item, updates: Partial<Item>) => void;
  isUpdating: boolean;
}

export default function InventoryTable({
  items,
  onUpdate,
  isUpdating,
}: InventoryTableProps) {
  const { user } = useUser();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Item>>({});

  const handleEdit = (item: Item) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleSave = async (item: Item) => {
    await onUpdate(item, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Min Quantity</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            {user?.role !== "user" && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.sku}</TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    value={editForm.name || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="w-full"
                  />
                ) : (
                  item.name
                )}
              </TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    type="number"
                    value={editForm.quantity || 0}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        quantity: parseInt(e.target.value),
                      })
                    }
                    className="w-24"
                  />
                ) : (
                  item.quantity
                )}
              </TableCell>
              <TableCell>{item.minQuantity}</TableCell>
              <TableCell>
                ${Number(item.unitPrice).toFixed(2)}
              </TableCell>
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    value={editForm.location || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, location: e.target.value })
                    }
                    className="w-full"
                  />
                ) : (
                  item.location
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    item.quantity <= item.minQuantity
                      ? "destructive"
                      : item.quantity <= item.minQuantity * 1.5
                      ? "warning"
                      : "success"
                  }
                >
                  {item.quantity <= item.minQuantity
                    ? "Low Stock"
                    : item.quantity <= item.minQuantity * 1.5
                    ? "Warning"
                    : "In Stock"}
                </Badge>
              </TableCell>
              {user?.role !== "user" && (
                <TableCell>
                  {editingId === item.id ? (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(item)}
                        disabled={isUpdating}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isUpdating}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
