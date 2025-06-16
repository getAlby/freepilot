import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightIcon } from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  disconnect,
  init,
  onConnected,
  onDisconnected,
  requestProvider,
  WebLNProviders,
} from "@getalby/bitcoin-connect-react";

export function HomePage() {
  const [issueUrl, setIssueUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [walletConnected, setWalletConnected] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsub = onConnected(() => {
      setWalletConnected(true);
    });
    return unsub;
  }, []);
  React.useEffect(() => {
    const unsub = onDisconnected(() => {
      setWalletConnected(false);
    });
    return unsub;
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      init({
        appName: "Freepilot",
        filters: ["nwc"],
      });

      const nwcUrl = await requestProvider().then((provider) => {
        if (provider instanceof WebLNProviders.NostrWebLNProvider) {
          return provider.client.nostrWalletConnectUrl;
        }
        return undefined;
      });
      if (!nwcUrl) {
        throw new Error("Wallet not connected");
      }

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: issueUrl, userNwcUrl: nwcUrl }),
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
      <div className="mt-2 text-xs text-muted-foreground">
        Price: 1000 sats + AI usage (Claude Sonnet 4).{" "}
        <Link to="/about" className="underline">
          Learn More
        </Link>
      </div>
      {walletConnected && (
        <div
          className="mt-2 text-xs text-muted-foreground underline cursor-pointer"
          onClick={disconnect}
        >
          Disconnect Wallet
        </div>
      )}
    </form>
  );
}
