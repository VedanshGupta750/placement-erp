"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type College = {
  name: string;
  logoUrl: string | null;
  university: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export function CollegeDetailsForm({ college }: { college: College }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [logoUrl, setLogoUrl] = useState(college.logoUrl);
  const [logoPending, setLogoPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const res = await fetch("/api/settings/college", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    toast[res.ok ? "success" : "error"](res.ok ? "College details saved" : "Couldn't save details.");
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPending(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/settings/college/logo", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setLogoPending(false);
    e.target.value = "";
    if (res.ok) {
      setLogoUrl(data.logoUrl);
      toast.success("Logo updated");
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't upload logo.");
    }
  }

  async function handleLogoRemove() {
    setLogoPending(true);
    const res = await fetch("/api/settings/college", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: "" }),
    });
    setLogoPending(false);
    if (res.ok) {
      setLogoUrl(null);
      router.refresh();
    } else {
      toast.error("Couldn't remove logo.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="name">College name</Label>
        <Input id="name" name="name" defaultValue={college.name} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="border-input size-12 shrink-0 rounded-md border object-cover" />
          ) : (
            <span className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-md text-sm">
              {college.name.charAt(0).toUpperCase()}
            </span>
          )}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoChange} />
          <Button type="button" variant="outline" size="sm" disabled={logoPending} onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-3.5" /> {logoPending ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={logoPending} onClick={handleLogoRemove}>
              <X className="size-3.5" /> Remove
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">PNG, JPEG, WebP, or SVG — up to 2MB.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="university">University affiliation</Label>
        <Input id="university" name="university" defaultValue={college.university ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" defaultValue={college.website ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={college.email ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={college.phone ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={college.address ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" defaultValue={college.city ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state">State</Label>
        <Input id="state" name="state" defaultValue={college.state ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="postalCode">Postal code</Label>
        <Input id="postalCode" name="postalCode" defaultValue={college.postalCode ?? ""} />
      </div>
      <Button type="submit" disabled={pending} className="w-fit sm:col-span-2">
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
