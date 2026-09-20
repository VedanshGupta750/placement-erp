"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function AddCategoryForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        minPackage: fd.get("minPackage") || undefined,
        maxPackage: fd.get("maxPackage") || undefined,
        maxOffersPerStudent: fd.get("maxOffersPerStudent") || undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Category added");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      toast.error("Couldn't add category.");
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add a category</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Dream, Super Dream, Core…" required className="w-56" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minPackage">Minimum package (₹)</Label>
            <Input id="minPackage" name="minPackage" type="number" min={0} step="0.01" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxPackage">Maximum package (₹)</Label>
            <Input id="maxPackage" name="maxPackage" type="number" min={0} step="0.01" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxOffersPerStudent">Max offers a student can receive in this category</Label>
            <Input id="maxOffersPerStudent" name="maxOffersPerStudent" type="number" min={1} className="w-24" />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add category"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
