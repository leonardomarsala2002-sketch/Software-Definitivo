import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EmployeeRow } from "@/hooks/useEmployees";
import EmployeeInfoTab from "./EmployeeInfoTab";

interface Props {
  employee: EmployeeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function EmployeeDetailDrawer({ employee, open, onOpenChange, canEdit }: Props) {
  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={employee.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent text-accent-foreground text-sm font-semibold">
                {getInitials(employee.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-base truncate">{employee.full_name ?? "—"}</SheetTitle>
              <SheetDescription className="text-xs truncate">{employee.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <EmployeeInfoTab employee={employee} canEdit={canEdit} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
