import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoaderIcon, CircleStop } from "lucide-react";
import React from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function JobPage() {
  const params = useParams<{ id: string }>();
  const [showLogs, setShowLogs] = React.useState(false);
  const [isStopping, setIsStopping] = React.useState(false);
  const { data: job, mutate } = useSWR<{
    url: string;
    prUrl: string;
    status: string;
    logs: string;
  }>(params.id && `/api/jobs/${params.id}`, fetcher, {
    refreshInterval: 5000,
  });

  const handleStopJob = async () => {
    if (!params.id) return;
    
    const confirmed = window.confirm(
      "Are you sure you want to cancel this job? This action cannot be undone."
    );
    
    if (!confirmed) return;
    
    setIsStopping(true);
    try {
      const response = await fetch(`/api/jobs/${params.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Refresh job data to show updated status
        mutate();
      } else {
        const errorData = await response.json();
        alert(`Failed to cancel job: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      alert('Failed to cancel job. Please try again.');
    } finally {
      setIsStopping(false);
    }
  };

  if (!params.id) {
    return <p>Job not found</p>;
  }

  // Use a regular expression to find all occurrences of numbers followed by 'sats'
  const satsValues = job?.logs.match(/(\d+)\s*sats/g);

  // Calculate the total by summing the extracted values
  const totalSats = satsValues?.reduce((total, value) => {
    // Extract the number from the matched string and convert it to an integer
    return total + parseInt(value);
  }, 0);

  // Check if job can be cancelled (not completed, failed, or already cancelled)
  const canBeCancelled = job && 
    job.status !== "COMPLETED" && 
    job.status !== "FAILED" && 
    job.status !== "CANCELLED";

  return (
    <div className="w-full max-w-lg">
      {!job && <p>Loading job {params.id}...</p>}
      {job && (
        <div>
          <div className="flex justify-between items-center">
            <p>
              <a href={job.url} target="_blank" className="underline">
                {job.url.substring("https://github.com/".length)}
              </a>
            </p>
            <Badge variant="outline" className="mt-2">
              {totalSats || 0} sats
            </Badge>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {job.status !== "COMPLETED" && (
                <Badge
                  variant={
                    job.status === "FAILED" ? "destructive" : 
                    job.status === "CANCELLED" ? "secondary" : 
                    "default"
                  }
                >
                  {job.status.replace("_", " ")}
                  {job.status !== "FAILED" && job.status !== "CANCELLED" && (
                    <LoaderIcon className="animate-spin ml-1" size={14} />
                  )}
                </Badge>
              )}
              {job.prUrl && (
                <a href={job.prUrl} target="_blank">
                  <Button>View PR</Button>
                </a>
              )}
              {canBeCancelled && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStopJob}
                  disabled={isStopping}
                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                >
                  <CircleStop size={16} className="mr-1" />
                  {isStopping ? "Stopping..." : "Stop"}
                </Button>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLogs((current) => !current)}
            >
              {showLogs ? "Hide Logs" : "Show Logs"}
            </Button>
          </div>
          {showLogs && (
            <Textarea
              readOnly
              value={job.logs || "Please wait, loading..."}
              className="mt-4 max-h-96 font-mono"
            />
          )}
        </div>
      )}
    </div>
  );
}
