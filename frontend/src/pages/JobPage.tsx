import { Textarea } from "@/components/ui/textarea";
import { useParams } from "react-router-dom";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function JobPage() {
  const params = useParams<{ id: string }>();
  const { data: job } = useSWR<{
    url: string;
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
          <p>Job {params.id}</p>
          <p>Issue URL: {job.url}</p>
          <p>Job Status: {job.status}</p>
          <p>Logs</p>
          <Textarea readOnly value={job.logs} />
        </div>
      )}
    </div>
  );
}
