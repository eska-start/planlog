import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ReactNode } from "react";

interface TabShellProps {
  title: string;
  description?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
  isEmpty?: boolean;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function TabShell({
  title,
  description,
  onAdd,
  addLabel = "추가",
  children,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: TabShellProps) {
  return (
    <div className="space-y-4">
      {/* Header: stacks on mobile, row on sm+ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {onAdd && (
          <Button
            onClick={onAdd}
            size="sm"
            className="gap-1.5 self-start sm:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-14 gap-4 rounded-2xl border border-dashed border-border bg-muted/20">
          {emptyIcon && (
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              {emptyIcon}
            </div>
          )}
          {emptyTitle && (
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
              {emptyDescription && (
                <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
              )}
            </div>
          )}
          {onAdd && (
            <Button onClick={onAdd} size="sm" variant="outline" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {addLabel}
            </Button>
          )}
        </div>
      ) : children}
    </div>
  );
}
