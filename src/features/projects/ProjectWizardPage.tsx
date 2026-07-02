import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { commands } from "@/lib/tauri-commands";
import { useProjectStore } from "@/stores/useProjectStore";
import type { Platform } from "@/types/product-brain";

const STEPS = [
  "Product Idea",
  "Target Users",
  "Business Goal",
  "Platform",
  "Tech Stack",
  "Local Folder",
  "GitHub Repo",
  "Figma File",
  "Notion",
  "Summary",
];

const PLATFORMS: { id: Platform; label: string; description: string }[] = [
  { id: "mobile_app", label: "Mobile App", description: "iOS and Android app" },
  { id: "web_app", label: "Web App", description: "Browser-based application" },
  { id: "dashboard", label: "Dashboard", description: "Admin or analytics dashboard" },
  { id: "api_backend", label: "API Backend", description: "Server-side API" },
  { id: "admin_panel", label: "Admin Panel", description: "Internal admin tools" },
];

export function ProjectWizardPage() {
  const navigate = useNavigate();
  const { createProject, loading } = useProjectStore();
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [techStack, setTechStack] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [notionDest, setNotionDest] = useState("");
  const [error, setError] = useState("");

  const progress = ((step + 1) / STEPS.length) * 100;

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const pickFolder = async () => {
    const path = await commands.pickFolder();
    if (path) setFolderPath(path);
  };

  const canNext = () => {
    switch (step) {
      case 0:
        return idea.length >= 20;
      case 1:
        return targetUsers.length > 0;
      case 2:
        return businessGoal.length > 0;
      case 3:
        return platforms.length > 0;
      case 5:
        return folderPath.length > 0;
      default:
        return true;
    }
  };

  const handleCreate = async () => {
    setError("");
    try {
      const name = idea.split(" ").slice(0, 4).join(" ") || "New Project";
      const project = await createProject(name, folderPath, idea, {
        platforms,
        businessGoal,
        techStack: techStack.split(",").map((s) => s.trim()).filter(Boolean),
        vision: businessGoal,
        targetUsers: [
          {
            id: crypto.randomUUID(),
            name: "Primary User",
            description: targetUsers,
            goals: [],
            painPoints: [],
          },
        ],
        githubRepo: githubRepo || undefined,
        figmaFileUrl: figmaUrl || undefined,
        notionPageId: notionDest || undefined,
      });
      navigate(`/projects/${project.id}/dashboard`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
        <Progress value={progress} className="mt-4" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && "Describe your product idea in detail"}
            {step === 1 && "Who are your target users?"}
            {step === 2 && "What business goal does this product serve?"}
            {step === 3 && "Select the platforms to build for"}
            {step === 4 && "Preferred technologies (comma-separated)"}
            {step === 5 && "Choose where to store project files"}
            {step === 6 && "GitHub repository (optional)"}
            {step === 7 && "Figma file URL (optional)"}
            {step === 8 && "Notion destination (optional)"}
            {step === 9 && "Review and create your project"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div>
              <Label htmlFor="idea">Product Idea</Label>
              <Textarea
                id="idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe your product idea..."
                rows={6}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {idea.length}/20 characters minimum
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <Label htmlFor="users">Target Users</Label>
              <Textarea
                id="users"
                value={targetUsers}
                onChange={(e) => setTargetUsers(e.target.value)}
                placeholder="Describe your target users..."
                rows={4}
                className="mt-2"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <Label htmlFor="goal">Business Goal</Label>
              <Textarea
                id="goal"
                value={businessGoal}
                onChange={(e) => setBusinessGoal(e.target.value)}
                placeholder="What problem does this solve?"
                rows={4}
                className="mt-2"
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                    platforms.includes(p.id)
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                >
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                  {platforms.includes(p.id) && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div>
              <Label htmlFor="tech">Tech Stack Preferences</Label>
              <Input
                id="tech"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="React Native, Next.js, Supabase..."
                className="mt-2"
              />
            </div>
          )}

          {step === 5 && (
            <div>
              <Label>Project Folder</Label>
              <div className="mt-2 flex gap-2">
                <Input value={folderPath} readOnly placeholder="No folder selected" />
                <Button type="button" variant="outline" onClick={pickFolder}>
                  Browse
                </Button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <Label htmlFor="github">GitHub Repository</Label>
              <Input
                id="github"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="owner/repo (optional)"
                className="mt-2"
              />
            </div>
          )}

          {step === 7 && (
            <div>
              <Label htmlFor="figma">Figma File URL</Label>
              <Input
                id="figma"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://figma.com/design/..."
                className="mt-2"
              />
            </div>
          )}

          {step === 8 && (
            <div>
              <Label htmlFor="notion">Notion Page ID</Label>
              <Input
                id="notion"
                value={notionDest}
                onChange={(e) => setNotionDest(e.target.value)}
                placeholder="Notion page ID (optional)"
                className="mt-2"
              />
            </div>
          )}

          {step === 9 && (
            <div className="space-y-3 text-sm">
              <div><strong>Idea:</strong> {idea}</div>
              <div><strong>Users:</strong> {targetUsers}</div>
              <div><strong>Goal:</strong> {businessGoal}</div>
              <div className="flex flex-wrap gap-1">
                <strong>Platforms:</strong>
                {platforms.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
              </div>
              <div><strong>Folder:</strong> {folderPath}</div>
              {githubRepo && <div><strong>GitHub:</strong> {githubRepo}</div>}
              {figmaUrl && <div><strong>Figma:</strong> {figmaUrl}</div>}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create Project"}
          </Button>
        )}
      </div>
    </div>
  );
}
