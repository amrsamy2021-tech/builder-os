import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { commands } from "@/lib/tauri-commands";
import { toast } from "sonner";

export function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");

  const saveOpenAI = async () => {
    if (!openaiKey) return;
    try {
      await commands.saveSecret("builder-os-openai", openaiKey);
      await commands.saveIntegration("openai", { model, connected: "true" });
      toast.success("OpenAI settings saved");
      setOpenaiKey("");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const testOpenAI = async () => {
    try {
      const result = await commands.testOpenAI(model);
      toast.success(result);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Settings</h1>
      <p className="mb-8 text-muted-foreground">Configure Builder OS</p>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">OpenAI</CardTitle>
          <CardDescription>
            API key is stored securely in macOS Keychain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="openai-key">API Key</Label>
            <Input
              id="openai-key"
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
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
          <div className="flex gap-2">
            <Button onClick={saveOpenAI}>Save</Button>
            <Button variant="outline" onClick={testOpenAI}>
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
