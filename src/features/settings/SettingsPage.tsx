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
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const saveOpenAI = async () => {
    if (!openaiKey.trim()) {
      toast.error("Please enter your OpenAI API key");
      return;
    }
    setSaving(true);
    try {
      await commands.saveSecret("builder-os-openai", openaiKey.trim());
      await commands.saveIntegration("openai", { model, connected: "true", mode: "api_key" });
      toast.success("OpenAI key saved");
      setOpenaiKey("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAndTestOpenAI = async () => {
    if (!openaiKey.trim()) {
      toast.error("Please enter your OpenAI API key first");
      return;
    }
    setSaving(true);
    setTesting(true);
    try {
      await commands.saveSecret("builder-os-openai", openaiKey.trim());
      await commands.saveIntegration("openai", { model, connected: "true", mode: "api_key" });
      const result = await commands.testOpenAI(model);
      toast.success(result);
      setOpenaiKey("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
      setTesting(false);
    }
  };

  const testOpenAI = async () => {
    setTesting(true);
    try {
      const result = await commands.testOpenAI(model);
      toast.success(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTesting(false);
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
            Your API key is stored locally on this Mac (Keychain or secure app storage)
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveOpenAI} disabled={saving}>
              {saving ? "Saving..." : "Save Key"}
            </Button>
            <Button variant="outline" onClick={saveAndTestOpenAI} disabled={saving || testing}>
              {testing ? "Testing..." : "Save & Test"}
            </Button>
            <Button variant="secondary" onClick={testOpenAI} disabled={testing}>
              Test Saved Key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
