import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "./BarcodeScanner";
import { Scan } from "lucide-react";

export function ScannerDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Scan className="mr-2 h-4 w-4" />
          Scan Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <BarcodeScanner />
      </DialogContent>
    </Dialog>
  );
}
