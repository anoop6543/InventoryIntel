import { useState, useEffect, useRef } from "react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
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
        credentials: "include",
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
          id: updatedItem.id,
          name: updatedItem.name,
          quantity: updatedItem.quantity,
          previousQuantity: updatedItem.quantity - 1,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });

  useEffect(() => {
    if (!scanning) {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        toast({
          title: "Camera Error",
          description: "Could not access the camera. Please check your permissions.",
          variant: "destructive",
        });
        setScanning(false);
      }
    };

    startCamera();
  }, [scanning, toast]);

  const handleScan = () => {
    // For demo purposes, simulate a successful scan
    const mockSku = "DEMO123";
    const scannedItem = items?.find((item) => item.sku === mockSku);

    if (scannedItem) {
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
        description: `No item found with SKU: ${mockSku}`,
        variant: "destructive",
      });
    }

    setScanning(false);
  };

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
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-w-sm mx-auto border rounded-lg"
            />
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => setScanning(false)}>
                Stop Scanning
              </Button>
              <Button onClick={handleScan}>
                Capture
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Position the barcode in front of your camera and click Capture
            </p>
          </div>
        )}
      </div>
    </div>
  );
}