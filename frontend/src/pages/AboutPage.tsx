import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function AboutPage() {
  return (
    <div className="max-w-sm">
      <h1 className="text-center text-lg font-semibold">About</h1>
      <p className="mt-2 text-muted-foreground">
        Freepilot is an example of an AI service which can be paid via streaming
        payments. Each agent loop will charge the user based on the tokens used
        in the previous iteration.
      </p>
      <p className="mt-2 text-muted-foreground">
        Freepilot allows developers to focus more on the requirements of their
        project and less on coding, by being able to let agents work on multiple
        issues in parallel.
      </p>
      <p className="mt-4 text-muted-foreground">
        🤖{" "}
        <a
          href="https://block.github.io/goose"
          target="_blank"
          className="underline"
        >
          Goose
        </a>{" "}
        AI agent is protected against generating content without being paid.
      </p>
      <p className="mt-2 text-muted-foreground">
        🧑‍💻 Users only pay what is needed, rather than guessing and depositing in
        advance or paying a monthly subscription.
      </p>
      <p className="mt-2 text-muted-foreground">
        🔒{" "}
        <a href="https://nwc.dev" target="_blank" className="underline">
          NWC
        </a>{" "}
        lightning wallet budgets allow users to protect themselves from excess
        charges.
      </p>

      <Link to="/" className="flex items-center justify-center">
        <Button className="mt-8">Try Freepilot now</Button>
      </Link>

      <div className="mt-4 w-full flex justify-center">
        <a
          href="https://github.com/getalby/freepilot"
          target="_blank"
          className="underline text-xs"
        >
          View source
        </a>
      </div>
    </div>
  );
}
