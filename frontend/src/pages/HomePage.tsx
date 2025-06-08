import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightIcon } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function HomePage() {
  const [issueUrl, setIssueUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: issueUrl }),
      });
      if (!response.ok) {
        throw new Error(
          "Request returned non-OK success code: " + response.status
        );
      }
      const { id } = await response.json();
      toast("Job created. Please wait...");
      navigate(`/jobs/${id}`);
    } catch (err) {
      console.error("Failed to submit prompt:", err);
      toast("Failed to create job. Please try again");
    }
    setLoading(false);
  }

  return (
    <form className="w-full max-w-lg" onSubmit={handleSubmit}>
      <Label>Enter Github Issue URL</Label>
      <div className="flex gap-2 justify-center mt-2">
        <Input
          placeholder="https://github.com/getAlby/hub/issues/1"
          value={issueUrl}
          onChange={(e) => setIssueUrl(e.target.value)}
          autoFocus
        />
        <Button disabled={loading}>
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  );
}
