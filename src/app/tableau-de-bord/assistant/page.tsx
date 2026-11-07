import { ShellApp } from "@/components/shell-app";
import { AssistantAI } from "@/components/assistant-ai";

export default function AssistantPage() {
  return (
    <ShellApp actif="AUTO DYALI AI" feature="ai" salutation="AUTO DYALI AI" sousTitre="Garage AUTO DYALI — Agadir">
      <AssistantAI />
    </ShellApp>
  );
}
