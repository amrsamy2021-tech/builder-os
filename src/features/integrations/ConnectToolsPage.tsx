import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, PlugZap, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIntegrationStore } from "@/stores/useIntegrationStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { TOOL_CARDS, MCP_CAPABLE_TOOLS } from "@/types/integrations";
import { NotionSyncSetup } from "@/features/integrations/NotionSyncSetup";
import { runWithLoading } from "@/stores/useLoadingStore";
import { commands } from "@/lib/tauri-commands";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export function ConnectToolsPage() {
  const {
    integrations,
    mcpServers,
    fetchIntegrations,
    fetchMcpServers,
    connect,
    connectViaMcp,
    disconnect,
    test,
    testMcp,
    loading,
    notionSyncReady,
    checkNotionSyncReady,
    saveNotionSyncToken,
    getMcpServerForTool,
  } = useIntegrationStore();
  const { getActiveProject } = useProjectStore();
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [notionSyncToken, setNotionSyncToken] = useState("");
  const [savingNotionSync, setSavingNotionSync] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<Record<string, "mcp" | "api_key">>({});
  const [cursorCliDetected, setCursorCliDetected] = useState<boolean | null>(null);
  const [cursorKeyStored, setCursorKeyStored] = useState<boolean | null>(null);

  const activeProject = getActiveProject();

  useEffect(() => {
    fetchIntegrations();
    fetchMcpServers();
    checkNotionSyncReady();
    commands.detectCursorCli().then(setCursorCliDetected).catch(() => setCursorCliDetected(false));
    commands.hasSecret("builder-os-cursor-api").then(setCursorKeyStored).catch(() => setCursorKeyStored(false));
  }, [fetchIntegrations, fetchMcpServers, checkNotionSyncReady]);

  const getStatus = (tool: string) =>
    integrations.find((i) => i.tool === tool)?.status ?? "disconnected";

  const getConnectionMode = (tool: string) => {
    const integration = integrations.find((i) => i.tool === tool);
    if (integration?.config?.mode === "mcp") return "mcp";
    if (integration?.config?.mode === "api_key") return "api_key";
    return connectionMode[tool] ?? (MCP_CAPABLE_TOOLS.includes(tool as typeof MCP_CAPABLE_TOOLS[number]) ? "mcp" : "api_key");
  };

  const handleConnectMcp = async (tool: string) => {
    const server = getMcpServerForTool(tool);
    if (!server) {
      toast.error(`No MCP server found for ${tool}. Add it in Cursor MCP settings first.`);
      return;
    }
    try {
      const syncToken = tool === "notion" ? notionSyncToken : undefined;
      await connectViaMcp(tool, server.name, activeProject?.folderPath, syncToken);
      toast.success(`${tool} connected via MCP (${server.name})`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSaveNotionSync = async () => {
    setSavingNotionSync(true);
    try {
      await saveNotionSyncToken(notionSyncToken);
      toast.success("Notion sync token saved — you can create pages from Builder OS");
      setNotionSyncToken("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingNotionSync(false);
    }
  };

  const handleConnectApiKey = async (tool: string) => {
    const secret = secrets[tool];
    if (!secret) {
      toast.error("Please enter credentials");
      return;
    }
    try {
      await connect(tool, { connected: "true" }, secret);
      toast.success(`${tool} connected via API key`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleTest = async (tool: string) => {
    setTesting(tool);
    try {
      const result = await runWithLoading(`Testing ${tool}...`, () => test(tool));
      toast.success(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTesting(null);
    }
  };

  const handleTestMcpServer = async (serverName: string) => {
    setTesting(serverName);
    try {
      const result = await runWithLoading(`Testing ${serverName}...`, () =>
        testMcp(serverName),
      );
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
      <p className="mb-4 text-muted-foreground">
        Connect via MCP (recommended) — uses your Cursor MCP servers — or fall back to API keys.
      </p>

      {mcpServers.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-4 w-4" />
              Available MCP Servers
            </CardTitle>
            <CardDescription>
              Detected from ~/.cursor/mcp.json and Builder OS templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mcpServers.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{server.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {server.transport} · {server.source}
                      {server.mappedTool && ` · maps to ${server.mappedTool}`}
                    </p>
                    {server.url && (
                      <p className="truncate text-xs text-muted-foreground">{server.url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{server.transport}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestMcpServer(server.name)}
                      disabled={testing === server.name}
                    >
                      {testing === server.name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {TOOL_CARDS.map((tool) => {
          const status = getStatus(tool.tool);
          const isConnected = status === "connected";
          const mode = getConnectionMode(tool.tool);
          const mcpServer = tool.supportsMcp ? getMcpServerForTool(tool.tool) : null;
          const isLocal = ["cursor", "filesystem", "shell"].includes(tool.tool);

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
                <p className="text-xs text-muted-foreground">{tool.connectionMethod}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isConnected && tool.supportsMcp && (
                  <Tabs
                    value={mode}
                    onValueChange={(v) =>
                      setConnectionMode((s) => ({ ...s, [tool.tool]: v as "mcp" | "api_key" }))
                    }
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="mcp" className="flex-1 gap-1">
                        <PlugZap className="h-3 w-3" />
                        MCP
                      </TabsTrigger>
                      <TabsTrigger value="api_key" className="flex-1 gap-1">
                        <Key className="h-3 w-3" />
                        API Key
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="mcp" className="mt-3 space-y-2">
                      {mcpServer ? (
                        <>
                          <div className="rounded-md border bg-muted/50 p-3 text-sm">
                            <p className="font-medium">{mcpServer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {mcpServer.transport}
                              {mcpServer.url && ` · ${mcpServer.url}`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleConnectMcp(tool.tool)}
                            disabled={loading}
                          >
                            Connect via MCP
                          </Button>
                          {tool.tool === "notion" && (
                            <NotionSyncSetup
                              compact
                              syncToken={notionSyncToken}
                              onSyncTokenChange={setNotionSyncToken}
                              onSave={handleSaveNotionSync}
                              onTest={() => handleTest("notion")}
                              saving={savingNotionSync}
                              testing={testing === "notion"}
                              syncReady={notionSyncReady}
                            />
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No MCP server found. Add {tool.name} to ~/.cursor/mcp.json in Cursor
                          settings, then refresh.
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="api_key" className="mt-3 space-y-2">
                      <div>
                        <Label htmlFor={`${tool.tool}-token`}>API Token</Label>
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
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleConnectApiKey(tool.tool)}
                        disabled={loading}
                      >
                        Connect via API Key
                      </Button>
                    </TabsContent>
                  </Tabs>
                )}

                {!isConnected && !tool.supportsMcp && !isLocal && (
                  <>
                    <div>
                      <Label htmlFor={`${tool.tool}-token`}>API Key</Label>
                      <Input
                        id={`${tool.tool}-token`}
                        type="password"
                        value={secrets[tool.tool] ?? ""}
                        onChange={(e) =>
                          setSecrets((s) => ({ ...s, [tool.tool]: e.target.value }))
                        }
                        placeholder={`Enter ${tool.name} key`}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleConnectApiKey(tool.tool)}
                      disabled={loading}
                    >
                      Connect
                    </Button>
                  </>
                )}

                {!isConnected && isLocal && tool.tool !== "cursor" && (
                  <Button
                    size="sm"
                    onClick={() => connect(tool.tool, { connected: "true" })}
                    disabled={loading}
                  >
                    Connect
                  </Button>
                )}

                {!isConnected && tool.tool === "cursor" && (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <p>
                      CLI:{" "}
                      <Badge variant={cursorCliDetected ? "success" : "outline"}>
                        {cursorCliDetected ? "Detected" : "Not found"}
                      </Badge>
                    </p>
                    <p>
                      API key:{" "}
                      <Badge variant={cursorKeyStored ? "success" : "outline"}>
                        {cursorKeyStored ? "Saved" : "Missing"}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Save your Cursor API key in Settings for background Generate and Send to Dev.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/settings">Open Settings</Link>
                    </Button>
                  </div>
                )}

                {isConnected && tool.tool === "cursor" && (
                  <div className="space-y-2">
                    <div className="space-y-1 text-sm">
                      <p>
                        CLI:{" "}
                        <Badge variant={cursorCliDetected ? "success" : "outline"}>
                          {cursorCliDetected ? "Detected" : "Not found"}
                        </Badge>
                      </p>
                      <p>
                        API key:{" "}
                        <Badge variant={cursorKeyStored ? "success" : "outline"}>
                          {cursorKeyStored ? "Saved" : "Missing"}
                        </Badge>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/settings">Settings</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          setTesting("cursor");
                          try {
                            const result = await commands.testCursorAgent();
                            toast.success(result);
                          } catch (e) {
                            toast.error(String(e));
                          } finally {
                            setTesting(null);
                          }
                        }}
                        disabled={testing === "cursor"}
                      >
                        {testing === "cursor" ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        Test agent
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => disconnect(tool.tool)}>
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}

                {isConnected && tool.tool !== "cursor" && (
                  <div className="space-y-2">
                    {integrations.find((i) => i.tool === tool.tool)?.config?.mode === "mcp" && (
                      <Badge variant="secondary" className="gap-1">
                        <PlugZap className="h-3 w-3" />
                        MCP: {integrations.find((i) => i.tool === tool.tool)?.config?.mcpServer}
                      </Badge>
                    )}
                    {tool.tool === "notion" && (
                      <NotionSyncSetup
                        compact
                        syncToken={notionSyncToken}
                        onSyncTokenChange={setNotionSyncToken}
                        onSave={handleSaveNotionSync}
                        onTest={() => handleTest("notion")}
                        saving={savingNotionSync}
                        testing={testing === "notion"}
                        syncReady={notionSyncReady}
                      />
                    )}
                    <div className="flex gap-2">
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
                      <Button size="sm" variant="destructive" onClick={() => disconnect(tool.tool)}>
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
