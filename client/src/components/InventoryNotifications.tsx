import { useInventoryNotifications } from "@/lib/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { format } from "date-fns";

export function InventoryNotifications() {
  const updates = useInventoryNotifications();

  if (updates.length === 0) {
    return null;
  }

  return (
    <Card className="w-[350px] shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Updates</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {updates.map((update, index) => {
            const change = update.quantity - update.previousQuantity;
            const isIncrease = change > 0;

            return (
              <div
                key={`${update.id}-${index}`}
                className="mb-4 flex items-start space-x-3 last:mb-0"
              >
                <div className={`rounded-full p-2 ${
                  isIncrease ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {isIncrease ? (
                    <ArrowUpIcon className="h-4 w-4" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{update.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Stock {isIncrease ? 'increased' : 'decreased'} by {Math.abs(change)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(update.timestamp), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
