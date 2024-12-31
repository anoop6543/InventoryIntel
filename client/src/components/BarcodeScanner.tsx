import { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wsClient } from "@/lib/websocket";
import type { Item } from "@db/schema";

interface BarcodeScannerProps {
  onClose?: () => void;
}

export function BarcodeScanner({ onClose }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const updateItemQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => {
      const response = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity }),
      });

      if (!response.ok) {
        throw new Error("Failed to update item quantity");
      }

      return response.json();
    },
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      wsClient.send({
        type: "INVENTORY_UPDATE",
        payload: {
          itemId: updatedItem.id,
          quantity: updatedItem.quantity,
        },
      });
    },
  });

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        qrbox: {
          width: 250,
          height: 250,
        },
        fps: 5,
      },
      false
    );

    scanner.render(onScanSuccess, onScanError);

    function onScanSuccess(decodedText: string) {
      // Stop scanning after successful scan
      scanner.clear();
      setScanning(false);

      // Find item by SKU
      const scannedItem = items?.find((item) => item.sku === decodedText);

      if (scannedItem) {
        // Increment quantity by 1
        updateItemQuantity.mutate({
          id: scannedItem.id,
          quantity: scannedItem.quantity + 1,
        });

        toast({
          title: "Item Scanned",
          description: `Updated quantity for ${scannedItem.name}`,
        });
      } else {
        toast({
          title: "Unknown Item",
          description: `No item found with SKU: ${decodedText}`,
          variant: "destructive",
        });
      }
    }

    function onScanError(error: any) {
      console.warn(`Code scan error = ${error}`);
    }

    return () => {
      scanner.clear();
    };
  }, [scanning, items, toast, updateItemQuantity]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Scan Item</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {!scanning ? (
          <Button onClick={() => setScanning(true)}>Start Scanning</Button>
        ) : (
          <Button variant="secondary" onClick={() => setScanning(false)}>
            Stop Scanning
          </Button>
        )}

        {scanning && (
          <>
            <div id="reader" className="w-full max-w-sm mx-auto" />
            <p className="text-sm text-muted-foreground text-center">
              Position the barcode or QR code in front of your camera
            </p>
          </>
        )}
      </div>
    </div>
  );
}
