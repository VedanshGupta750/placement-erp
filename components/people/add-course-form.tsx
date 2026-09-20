"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function AddCourseForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        degree: fd.get("degree"),
        specialization: fd.get("specialization") || undefined,
        years: fd.get("years"),
      }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Course added");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      toast.error("Couldn't add course.");
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add a course</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Course name</Label>
            <Input id="name" name="name" placeholder="B.Tech. - Computer Science & Engineering" required className="w-72" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="degree">Degree</Label>
            <Input id="degree" name="degree" placeholder="B.Tech." required className="w-32" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="specialization">Specialization</Label>
            <Input id="specialization" name="specialization" className="w-56" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="years">Years</Label>
            <Input id="years" name="years" type="number" min={1} max={6} defaultValue={4} className="w-20" />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add course"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
