import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const { user } = useUser();
  const { data: logs, isLoading, error } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  if (user?.role !== "admin") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to view this page.
        </AlertDescription>
      </Alert>
    );
  }

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
          Failed to load audit logs: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Audit Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => {
                const oldValue = log.oldValue ? JSON.parse(log.oldValue) : null;
                const newValue = log.newValue ? JSON.parse(log.newValue) : null;

                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{log.userId}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action === "created"
                            ? "success"
                            : log.action === "updated"
                            ? "warning"
                            : "destructive"
                        }
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.itemId}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {log.action === "updated" && oldValue && newValue ? (
                        <div className="text-sm">
                          {Object.keys(newValue).map((key) => {
                            if (oldValue[key] !== newValue[key]) {
                              return (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span>{" "}
                                  {oldValue[key]} → {newValue[key]}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ) : (
                        log.action === "created" && "New item created"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
