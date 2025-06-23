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
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        setIsLoading(true);
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
        setError("Failed to load stats");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="w-full max-w-4xl mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {error || "Unable to load stats"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatNumber = (number: number): string => {
    return number.toLocaleString();
  };

  return (
    <div className="w-full max-w-4xl mb-8">
      <h2 className="text-xl font-semibold mb-4 text-center">Freepilot Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Jobs Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalCompletedJobs)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sats Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalEarningsInSats)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Tokens Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalTokensProcessed)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              PRs Merged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalMergedPRs)}</div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Last updated: {new Date(stats.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
}