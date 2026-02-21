import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EmployeeRow } from "@/hooks/useEmployees";
import EmployeeInfoTab from "./EmployeeInfoTab";
import EmployeeAvailabilityTab from "./EmployeeAvailabilityTab";
import EmployeeExceptionsTab from "./EmployeeExceptionsTab";

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

        <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 w-auto grid grid-cols-3">
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="availability" className="text-xs">Disponibilità</TabsTrigger>
            <TabsTrigger value="exceptions" className="text-xs">Eccezioni</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 pb-6">
            <TabsContent value="info" className="mt-0">
              <EmployeeInfoTab employee={employee} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="availability" className="mt-0">
              <EmployeeAvailabilityTab userId={employee.user_id} storeId={employee.primary_store_id} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="exceptions" className="mt-0">
              <EmployeeExceptionsTab userId={employee.user_id} storeId={employee.primary_store_id} canEdit={canEdit} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
