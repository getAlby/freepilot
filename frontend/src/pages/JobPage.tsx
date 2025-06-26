import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoaderIcon, CircleStop, Loader2Icon, CheckCircleIcon } from "lucide-react";
import React from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";

interface JobSummary {
  currentStep: string;
  completedSteps: string[];
  totalCost: number;
}

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
    summary: JobSummary;
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
        method: "POST",
      });

      if (response.ok) {
        // Refresh job data to show updated status
        mutate();
      } else {
        const errorData = await response.json();
        alert(`Failed to cancel job: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Error cancelling job:", error);
      alert("Failed to cancel job. Please try again.");
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

  // Use summary total cost if available, otherwise fall back to regex calculation
  const displayTotalSats = job?.summary?.totalCost ?? totalSats ?? 0;

  // Check if job can be cancelled (not completed, failed, or already cancelled)
  const canBeCancelled =
    job &&
    job.status !== "COMPLETED" &&
    job.status !== "PUBLISHING" &&
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
              {displayTotalSats} sats
            </Badge>
          </div>

          {/* High-level summary section */}
          {job.summary && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">
                Progress Summary
              </h3>
              
              {/* Current step */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm">
                  {job.summary.currentStep === "Completed" ? (
                    <CheckCircleIcon className="text-green-500" size={16} />
                  ) : job.summary.currentStep === "Failed" ? (
                    <CircleStop className="text-red-500" size={16} />
                  ) : job.summary.currentStep === "Cancelled" ? (
                    <CircleStop className="text-gray-500" size={16} />
                  ) : (
                    <LoaderIcon className="animate-spin text-blue-500" size={16} />
                  )}
                  <span className="font-medium">
                    {job.summary.currentStep === "Completed" ? "✅ Completed" :
                     job.summary.currentStep === "Failed" ? "❌ Failed" :
                     job.summary.currentStep === "Cancelled" ? "⏹️ Cancelled" :
                     `Current: ${job.summary.currentStep}`}
                  </span>
                </div>
              </div>

              {/* Completed steps */}
              {job.summary.completedSteps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-600 mb-2">Completed:</p>
                  {job.summary.completedSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <CheckCircleIcon className="text-green-500" size={14} />
                      <span className="text-gray-700">{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {job.status !== "COMPLETED" && (
                <Badge
                  variant={
                    job.status === "FAILED" || job.status === "CANCELLED"
                      ? "destructive"
                      : "default"
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
                  variant="ghost"
                  onClick={handleStopJob}
                  disabled={isStopping}
                  className="p-0 m-0 -ml-2"
                >
                  {isStopping ? (
                    <Loader2Icon size={16} className="animate-spin" />
                  ) : (
                    <CircleStop size={16} />
                  )}
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
