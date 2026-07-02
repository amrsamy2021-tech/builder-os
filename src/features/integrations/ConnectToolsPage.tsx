import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIntegrationStore } from "@/stores/useIntegrationStore";
import { TOOL_CARDS } from "@/types/integrations";
import { toast } from "sonner";

export function ConnectToolsPage() {
  const { integrations, fetchIntegrations, connect, disconnect, test, loading } =
    useIntegrationStore();
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const getStatus = (tool: string) =>
    integrations.find((i) => i.tool === tool)?.status ?? "disconnected";

  const handleConnect = async (tool: string) => {
    const secret = secrets[tool];
    if (tool !== "cursor" && tool !== "filesystem" && tool !== "shell" && !secret) {
      toast.error("Please enter credentials");
      return;
    }
    try {
      await connect(tool, { connected: "true" }, secret);
      toast.success(`${tool} connected`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleTest = async (tool: string) => {
    setTesting(tool);
    try {
      const result = await test(tool);
      toast.success(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Connect Tools</h1>
      <p className="mb-8 text-muted-foreground">
        Connect your development tools to Builder OS
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {TOOL_CARDS.map((tool) => {
          const status = getStatus(tool.tool);
          const isConnected = status === "connected";
          const needsToken = !["cursor", "filesystem", "shell"].includes(tool.tool);

          return (
            <Card key={tool.tool}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{tool.name}</CardTitle>
                  <Badge
                    variant={isConnected ? "success" : status === "error" ? "destructive" : "outline"}
                  >
                    {isConnected ? (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {status}
                  </Badge>
                </div>
                <CardDescription>{tool.description}</CardDescription>
                <p className="text-xs text-muted-foreground">
                  via {tool.connectionMethod}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {needsToken && !isConnected && (
                  <div>
                    <Label htmlFor={`${tool.tool}-token`}>
                      {tool.connectionMethod}
                    </Label>
                    <Input
                      id={`${tool.tool}-token`}
                      type="password"
                      value={secrets[tool.tool] ?? ""}
                      onChange={(e) =>
                        setSecrets((s) => ({ ...s, [tool.tool]: e.target.value }))
                      }
                      placeholder={`Enter ${tool.name} token`}
                      className="mt-1"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  {!isConnected ? (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(tool.tool)}
                      disabled={loading}
                    >
                      Connect
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(tool.tool)}
                        disabled={testing === tool.tool}
                      >
                        {testing === tool.tool ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => disconnect(tool.tool)}
                      >
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
