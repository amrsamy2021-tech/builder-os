import { Link } from "react-router-dom";
import { Brain, FolderOpen, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WelcomePage() {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Brain className="h-8 w-8" />
          </div>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">Builder OS</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Your AI Product Development Operating System. Connect your tools and
          guide your idea from concept to production-ready software.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link to="/projects/new">
              <Brain className="mr-2 h-4 w-4" />
              Create New Project
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/projects">
              <FolderOpen className="mr-2 h-4 w-4" />
              Open Existing Project
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/connect-tools">
              <Plug className="mr-2 h-4 w-4" />
              Connect Tools
            </Link>
          </Button>
        </div>
        <Card className="mt-12 text-left">
          <CardHeader>
            <CardTitle className="text-base">Idea to Release</CardTitle>
            <CardDescription>
              One command center for your entire product lifecycle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Idea → Discovery → Research → PRD → UX → UI → Architecture →
              Development → QA → Release
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
