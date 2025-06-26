export interface JobSummary {
  currentStep: string;
  completedSteps: string[];
  totalCost: number;
}

export function analyzeLogs(logs: string): JobSummary {
  const lines = logs.split('\n');
  let totalCost = 0;
  const completedSteps: string[] = [];
  let currentStep = "Initializing";

  // Extract costs from logs
  const satsMatches = logs.match(/(\d+)\s*sats/g);
  if (satsMatches) {
    totalCost = satsMatches.reduce((total, match) => {
      return total + parseInt(match.replace(/\s*sats/, ''));
    }, 0);
  }

  // Define step patterns and their corresponding user-friendly names
  const stepPatterns = [
    {
      pattern: /Preparing repository/i,
      step: "Checking out repository",
      priority: 1
    },
    {
      pattern: /extracted repository from issue URL/i,
      step: "Analyzing issue URL",
      priority: 2
    },
    {
      pattern: /forking repository/i,
      step: "Forking repository",
      priority: 3
    },
    {
      pattern: /cloning forked repository/i,
      step: "Cloning repository",
      priority: 4
    },
    {
      pattern: /Launching agent/i,
      step: "Looking at the code",
      priority: 5
    },
    {
      pattern: /Spawning goose process/i,
      step: "Understanding the issue",
      priority: 6
    },
    {
      pattern: /starting session.*provider:/i,
      step: "Starting code analysis",
      priority: 7
    },
    {
      pattern: /I'll help you.*follow.*steps/i,
      step: "Planning solution",
      priority: 8
    },
    {
      pattern: /checkout.*new branch/i,
      step: "Creating development branch",
      priority: 9
    },
    {
      pattern: /git checkout -b/i,
      step: "Setting up development environment",
      priority: 10
    },
    {
      pattern: /Step 2.*address.*issue/i,
      step: "Coding solution",
      priority: 11
    },
    {
      pattern: /Step 3.*commit.*changes/i,
      step: "Reviewing and committing changes",
      priority: 12
    },
    {
      pattern: /git commit/i,
      step: "Committing changes",
      priority: 13
    },
    {
      pattern: /getting branch name/i,
      step: "Preparing pull request",
      priority: 14
    },
    {
      pattern: /pushing branch/i,
      step: "Pushing changes",
      priority: 15
    },
    {
      pattern: /creating pull request/i,
      step: "Opening pull request",
      priority: 16
    },
    {
      pattern: /successfully created pull request/i,
      step: "Pull request created",
      priority: 17
    }
  ];

  // Track which steps have been completed based on log patterns
  const foundSteps: Array<{step: string, priority: number}> = [];

  for (const line of lines) {
    for (const { pattern, step, priority } of stepPatterns) {
      if (pattern.test(line)) {
        foundSteps.push({ step, priority });
        break;
      }
    }
  }

  // Sort by priority and get unique steps
  const uniqueSteps = foundSteps
    .sort((a, b) => a.priority - b.priority)
    .reduce((acc, curr) => {
      if (!acc.find(s => s.step === curr.step)) {
        acc.push(curr);
      }
      return acc;
    }, [] as Array<{step: string, priority: number}>);

  // Add completed steps
  completedSteps.push(...uniqueSteps.map(s => s.step));

  // Determine current step based on the last completed step and job status
  if (uniqueSteps.length > 0) {
    const lastStep = uniqueSteps[uniqueSteps.length - 1];
    
    // If we're still in progress, show what's likely next
    if (lastStep.priority < 17) {
      const nextStepIndex = stepPatterns.findIndex(p => p.priority > lastStep.priority);
      if (nextStepIndex !== -1) {
        currentStep = stepPatterns[nextStepIndex].step;
      } else {
        currentStep = "Finalizing";
      }
    } else {
      currentStep = "Completed";
    }
  }

  // Handle specific status cases from logs
  if (logs.includes('Job completed! 🎉')) {
    currentStep = "Completed";
    if (!completedSteps.includes("Pull request created")) {
      completedSteps.push("Pull request created");
    }
  } else if (logs.includes('job failed')) {
    currentStep = "Failed";
  } else if (logs.includes('Job was cancelled')) {
    currentStep = "Cancelled";
  }

  return {
    currentStep,
    completedSteps,
    totalCost
  };
}