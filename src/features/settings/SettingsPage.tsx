import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { commands } from "@/lib/tauri-commands";
import { useIntegrationStore } from "@/stores/useIntegrationStore";
import { runWithLoading } from "@/stores/useLoadingStore";
import type { AgentProvider } from "@/stores/useAgentJobsStore";
import { toast } from "sonner";

const OPENAI_SECRET_KEY = "builder-os-openai";
const CURSOR_SECRET_KEY = "builder-os-cursor-api";

const PROVIDER_OPTIONS: { value: AgentProvider; label: string }[] = [
  { value: "cursor", label: "Cursor (recommended)" },
  { value: "cursor_with_openai_fallback", label: "Cursor with OpenAI fallback" },
  { value: "openai", label: "OpenAI only" },
];

export function SettingsPage() {
  const { integrations, fetchIntegrations } = useIntegrationStore();
  const [openaiKey, setOpenaiKey] = useState("");
  const [cursorKey, setCursorKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [provider, setProvider] = useState<AgentProvider>("cursor");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [openaiKeyStored, setOpenaiKeyStored] = useState(false);
  const [cursorKeyStored, setCursorKeyStored] = useState(false);
  const [cursorCliDetected, setCursorCliDetected] = useState(false);

  const openaiIntegration = integrations.find((i) => i.tool === "openai");
  const cursorIntegration = integrations.find((i) => i.tool === "cursor");

  useEffect(() => {
    fetchIntegrations();
    commands.hasSecret(OPENAI_SECRET_KEY).then(setOpenaiKeyStored).catch(() => {});
    commands.hasSecret(CURSOR_SECRET_KEY).then(setCursorKeyStored).catch(() => {});
    commands.detectCursorCli().then(setCursorCliDetected).catch(() => false);
    const savedModel = openaiIntegration?.config?.model;
    if (typeof savedModel === "string" && savedModel) setModel(savedModel);
    const savedProvider = cursorIntegration?.config?.defaultProvider as AgentProvider | undefined;
    if (savedProvider && PROVIDER_OPTIONS.some((p) => p.value === savedProvider)) {
      setProvider(savedProvider);
    }
  }, [fetchIntegrations, openaiIntegration?.config?.model, cursorIntegration?.config?.defaultProvider]);

  const persistOpenAIKey = async () => {
    const trimmed = openaiKey.trim();
    if (!trimmed) {
      toast.error("Please enter your OpenAI API key");
      return;
    }
    await commands.saveSecret(OPENAI_SECRET_KEY, trimmed);
    const verified = await commands.hasSecret(OPENAI_SECRET_KEY);
    if (!verified) throw new Error("Key could not be verified after save.");
    await commands.saveIntegration("openai", { model, connected: "true", mode: "api_key" });
    setOpenaiKeyStored(true);
    setOpenaiKey("");
  };

  const persistCursorKey = async () => {
    const trimmed = cursorKey.trim();
    if (!trimmed) {
      toast.error("Please enter your Cursor API key");
      return;
    }
    await commands.saveSecret(CURSOR_SECRET_KEY, trimmed);
    const verified = await commands.hasSecret(CURSOR_SECRET_KEY);
    if (!verified) throw new Error("Cursor key could not be verified after save.");
    await commands.saveIntegration("cursor", {
      defaultProvider: provider,
      connected: "true",
      mode: "api_key",
    });
    setCursorKeyStored(true);
    setCursorKey("");
  };

  const saveProvider = async () => {
    await commands.saveIntegration("cursor", {
      ...(cursorIntegration?.config ?? {}),
      defaultProvider: provider,
    });
    toast.success("Default agent provider saved");
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Settings</h1>
      <p className="mb-8 text-muted-foreground">Configure Builder OS</p>

      <div className="grid max-w-lg gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cursor Agent</CardTitle>
              {cursorKeyStored && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Key saved
                </Badge>
              )}
            </div>
            <CardDescription>
              Run Generate and Send to Dev in the background using your Cursor subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              CLI detected: {cursorCliDetected ? "Yes" : "No — install Cursor app"}
            </p>
            <div>
              <Label htmlFor="cursor-key">
                {cursorKeyStored ? "Replace Cursor API Key" : "Cursor API Key"}
              </Label>
              <Input
                id="cursor-key"
                type="password"
                value={cursorKey}
                onChange={(e) => setCursorKey(e.target.value)}
                placeholder="key_..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="provider">Default agent provider</Label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as AgentProvider)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await runWithLoading("Saving Cursor key...", persistCursorKey);
                    await saveProvider();
                    toast.success("Cursor settings saved");
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                Save Cursor Key
              </Button>
              <Button
                variant="outline"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const result = await runWithLoading("Testing Cursor...", () =>
                      commands.testCursorAgent(),
                    );
                    toast.success(result);
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                Test Cursor
              </Button>
              <Button variant="secondary" onClick={saveProvider}>
                Save provider only
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">OpenAI (optional fallback)</CardTitle>
              {openaiKeyStored && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Key saved
                </Badge>
              )}
            </div>
            <CardDescription>
              Used only when provider is OpenAI-only or Cursor fallback is enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="openai-key">
                {openaiKeyStored ? "Replace API Key" : "API Key"}
              </Label>
              <Input
                id="openai-key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={openaiKeyStored ? "Enter new key to replace" : "sk-..."}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o"
                className="mt-1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await runWithLoading("Saving OpenAI key...", persistOpenAIKey);
                    toast.success("OpenAI key saved");
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                Save Key
              </Button>
              <Button
                variant="secondary"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const result = await runWithLoading("Testing OpenAI...", async () => {
                      if (!(await commands.hasSecret(OPENAI_SECRET_KEY))) {
                        throw new Error("No saved OpenAI key.");
                      }
                      return commands.testOpenAI(model);
                    });
                    toast.success(result);
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                Test Saved Key
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
