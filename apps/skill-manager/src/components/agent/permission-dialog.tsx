import { Button } from "@/components/ui/button";
import type { PermissionRequest } from "@/hooks/use-agent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldAlert } from "lucide-react";

interface PermissionDialogProps {
  permission: PermissionRequest;
  onRespond: (requestId: string, optionId: string) => void;
}

export function PermissionDialog({
  permission,
  onRespond,
}: PermissionDialogProps) {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            Permission Required
          </DialogTitle>
          <DialogDescription>
            The agent wants to use{" "}
            <span className="font-semibold text-foreground">
              {permission.title}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 border p-3 max-h-60 overflow-y-auto">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono break-all">
            {permission.description}
          </pre>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          {permission.options.map((opt) => (
            <Button
              key={opt.optionId}
              variant={opt.kind.includes("reject") ? "outline" : "default"}
              size="sm"
              onClick={() => onRespond(permission.requestId, opt.optionId)}
            >
              {opt.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
