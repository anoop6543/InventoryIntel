import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useInventoryNotifications } from "@/lib/websocket";
import type { Item } from "@db/schema";
import { useMemo } from "react";

interface HeatMapData {
  x: number; // Hour of day
  y: number; // Day of week
  z: number; // Activity intensity
  details: string;
}

function generateInitialHeatMapData(items: Item[]): HeatMapData[] {
  const data: HeatMapData[] = [];
  const now = new Date();
  
  // Generate data for the last 7 days x 24 hours
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Calculate base intensity using current inventory levels
      const baseIntensity = items.reduce((sum, item) => sum + item.quantity, 0) / items.length;
      
      // Add some randomization for demo purposes
      const randomFactor = 0.5 + Math.random();
      const intensity = Math.round(baseIntensity * randomFactor);
      
      data.push({
        x: hour,
        y: day,
        z: intensity,
        details: `Day ${day + 1}, ${hour}:00 - Activity Level: ${intensity}`,
      });
    }
  }
  
  return data;
}

export function HeatMapChart() {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });
  
  const updates = useInventoryNotifications();
  
  const heatMapData = useMemo(() => {
    if (!items) return [];
    return generateInitialHeatMapData(items);
  }, [items]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{days[data.y]}</p>
          <p className="text-sm text-muted-foreground">
            {`${String(data.x).padStart(2, '0')}:00 - ${String(data.x + 1).padStart(2, '0')}:00`}
          </p>
          <p className="text-sm text-muted-foreground">Activity Level: {data.z}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Inventory Movement Heat Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 23]}
                ticks={[0, 6, 12, 18, 23]}
                tickFormatter={(value) => `${String(value).padStart(2, '0')}:00`}
                name="Hour"
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 6]}
                ticks={[0, 1, 2, 3, 4, 5, 6]}
                tickFormatter={(value) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][value]}
                name="Day"
              />
              <ZAxis type="number" dataKey="z" range={[100, 1000]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                data={heatMapData}
                fill="hsl(var(--primary))"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
