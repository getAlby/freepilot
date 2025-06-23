/**
 * StatsSection Component - Displays fun statistics about Freepilot's performance
 *
 * Fetches and displays:
 * - Jobs completed
 * - Sats earned
 * - Tokens processed
 * - PRs merged
 *
 * Includes loading states and error handling.
 */
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Stats {
  totalCompletedJobs: number;
  totalEarningsInSats: number;
  totalTokensProcessed: number;
  totalMergedPRs: number;
  lastUpdated: Date;
}

interface StatsApiResponse {
  success: boolean;
  data: Stats;
  cached: boolean;
}

export function StatsSection() {
  const [stats, setStats] = React.useState<Stats | null>(null);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/stats");

        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }

        const data: StatsApiResponse = await response.json();

        if (data.success) {
          setStats(data.data);
        } else {
          throw new Error("Stats API returned error");
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    }

    fetchStats();
  }, []);

  const formatNumber = (number: number): string => {
    return number.toLocaleString();
  };

  return (
    <div className="w-full max-w-md mt-16">
      <h2 className="text-xl font-semibold mb-4 text-center">
        Freepilot Stats
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <Card className={cn(!stats && "animate-pulse")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Jobs Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats && formatNumber(stats.totalCompletedJobs)}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(!stats && "animate-pulse")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sats Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats && formatNumber(stats.totalEarningsInSats)}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(!stats && "animate-pulse")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Tokens Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats && formatNumber(stats.totalTokensProcessed)}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(!stats && "animate-pulse")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              PRs Merged
            </CardTitle>
          </CardHeader>
          <CardContent className="h-full flex items-end">
            <div className="text-2xl font-bold">
              {stats && formatNumber(stats.totalMergedPRs)}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* <p className="text-xs text-muted-foreground text-center mt-4">
        Last updated: {new Date(stats.lastUpdated).toLocaleString()}
      </p> */}
    </div>
  );
}
