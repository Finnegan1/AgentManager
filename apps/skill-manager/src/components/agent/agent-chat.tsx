import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { AgentMessage } from "./chat-message";
import { PermissionDialog } from "./permission-dialog";
import { useAgent } from "@/hooks/use-agent";
import { Bot, Loader2, Sparkles, AlertCircle } from "lucide-react";
import type { ChatStatus } from "ai";

export function AgentChat() {
  const {
    messages,
    isConnected,
    isStreaming,
    isInitializing,
    pendingPermission,
    error,
    connect,
    sendMessage,
    cancelTurn,
    respondToPermission,
  } = useAgent();

  const chatStatus: ChatStatus = isStreaming ? "streaming" : "ready";

  // Not connected — setup screen
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <Sparkles className="size-10 text-primary" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            AI Assistant
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Start a conversation with the AI agent to install MCP servers,
            create skills, and manage your configuration.
          </p>
        </div>
        {error && (
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          onClick={connect}
          disabled={isInitializing}
          size="lg"
          className="gap-2"
        >
          {isInitializing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Bot className="size-4" />
              Start Agent
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)]">
      {/* Messages area */}
      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles className="size-8" />}
              title="How can I help?"
              description='Ask me to install MCP servers, create skills, or manage your setup. Try: "Add the filesystem MCP server"'
            />
          ) : (
            messages.map((msg, i) => <AgentMessage key={i} message={msg} />)
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Error banner */}
      {error && (
        <div className="max-w-3xl mx-auto w-full px-4">
          <Alert variant="destructive" className="mb-2">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input area */}
      <div className="border-t bg-background">
        <div className="max-w-3xl mx-auto w-full p-4">
          <PromptInput
            onSubmit={(message) => {
              const text = message.text?.trim();
              if (text) {
                sendMessage(text);
              }
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                placeholder="Ask the agent to help you..."
                disabled={isStreaming}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputSubmit status={chatStatus} onStop={cancelTurn} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      {/* Permission dialog */}
      {pendingPermission && (
        <PermissionDialog
          permission={pendingPermission}
          onRespond={respondToPermission}
        />
      )}
    </div>
  );
}
