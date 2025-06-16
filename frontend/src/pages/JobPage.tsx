import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoaderIcon } from "lucide-react";
import React from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function JobPage() {
  const params = useParams<{ id: string }>();
  const [showLogs, setShowLogs] = React.useState(false);
  const { data: job } = useSWR<{
    url: string;
    prUrl: string;
    status: string;
    logs: string;
  }>(params.id && `/api/jobs/${params.id}`, fetcher, {
    refreshInterval: 5000,
  });
  if (!params.id) {
    return <p>Job not found</p>;
  }
  return (
    <div className="w-full max-w-lg">
      {!job && <p>Loading job {params.id}...</p>}
      {job && (
        <div>
          <p>
            Issue URL:{" "}
            <a href={job.url} target="_blank" className="underline">
              {job.url}
            </a>
          </p>
          <div className="mt-4 flex justify-between items-center">
            <div>
              {job.status !== "COMPLETED" && (
                <Badge
                  variant={job.status === "FAILED" ? "destructive" : "default"}
                >
                  {job.status.replace("_", " ")}
                  {job.status !== "FAILED" && (
                    <LoaderIcon className="animate-spin" />
                  )}
                </Badge>
              )}
              {job.prUrl && (
                <a href={job.prUrl} target="_blank">
                  <Button>View PR</Button>
                </a>
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
