import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Item } from "@db/schema";

interface TrendPoint {
  timestamp: string;
  actual: number;
  predicted: number;
}

// Simple linear regression for prediction
function predictNextValues(data: TrendPoint[], periods: number): TrendPoint[] {
  if (data.length < 2) return [];
  
  // Calculate slope and intercept
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  data.forEach((point, i) => {
    sumX += i;
    sumY += point.actual;
    sumXY += i * point.actual;
    sumXX += i * i;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Generate predictions
  const predictions: TrendPoint[] = [];
  const lastDate = new Date(data[data.length - 1].timestamp);
  
  for (let i = 1; i <= periods; i++) {
    const predictedValue = slope * (n + i - 1) + intercept;
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    
    predictions.push({
      timestamp: futureDate.toISOString(),
      actual: NaN, // No actual value for future dates
      predicted: Math.max(0, Math.round(predictedValue)) // Ensure non-negative
    });
  }
  
  return predictions;
}

export function TrendChart() {
  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const chartData = useMemo(() => {
    if (!items) return [];

    // Calculate total inventory value over time (simplified for demo)
    const now = new Date();
    const historicalData: TrendPoint[] = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - i));
      
      // Generate some historical data based on current quantities
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const randomVariation = Math.random() * 0.1 - 0.05; // ±5% variation
      const historicalQuantity = Math.round(totalQuantity * (1 + randomVariation));
      
      return {
        timestamp: date.toISOString(),
        actual: historicalQuantity,
        predicted: NaN
      };
    });

    // Generate predictions for next 7 days
    const predictions = predictNextValues(historicalData, 7);
    return [...historicalData, ...predictions];
  }, [items]);

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Inventory Trends & Predictions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as TrendPoint;
                  const date = new Date(data.timestamp).toLocaleDateString();
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md">
                      <p className="text-sm font-medium">{date}</p>
                      {!isNaN(data.actual) && (
                        <p className="text-sm text-muted-foreground">
                          Actual: {data.actual.toLocaleString()}
                        </p>
                      )}
                      {!isNaN(data.predicted) && (
                        <p className="text-sm text-muted-foreground">
                          Predicted: {data.predicted.toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--primary))"
                fill="url(#actualGradient)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                animationDuration={1000}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="hsl(var(--secondary))"
                fill="url(#predictedGradient)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
