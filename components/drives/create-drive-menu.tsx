"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Copy, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DuplicatePickerDialog } from "@/components/drives/duplicate-picker-dialog";

export function CreateDriveMenu() {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>
          <Plus className="size-4" /> Create Drive <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/drives/new?type=JOB" />}>Create Job Drive</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/drives/new?type=INTERNSHIP" />}>Create Internship Drive</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/drives/new?type=JOB_AND_INTERNSHIP" />}>Create Job + Internship Drive</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
            <Copy className="size-3.5" /> Duplicate Existing Drive
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
            <LayoutTemplate className="size-3.5" /> Create From Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DuplicatePickerDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} templatesOnly={false} />
      <DuplicatePickerDialog open={templateOpen} onOpenChange={setTemplateOpen} templatesOnly={true} />
    </>
  );
}
