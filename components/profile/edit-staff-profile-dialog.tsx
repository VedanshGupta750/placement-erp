"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { resizeImageForUpload } from "@/lib/uploads/resize-image-client";

async function uploadImage(endpoint: string, file: File) {
  const resized = await resizeImageForUpload(file);
  const fd = new FormData();
  fd.set("file", resized);
  const res = await fetch(endpoint, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function EditStaffProfileDialog({
  name,
  phone,
  linkedinUrl,
  avatarUrl,
  coverImageUrl,
}: {
  name: string;
  phone: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [cover, setCover] = useState(coverImageUrl);
  const [avatarPending, setAvatarPending] = useState(false);
  const [coverPending, setCoverPending] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarPending(true);
    const { ok, data } = await uploadImage("/api/profile/avatar", file);
    setAvatarPending(false);
    if (ok) {
      setAvatar(data.avatarUrl);
      toast.success("Photo updated");
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't upload photo.");
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverPending(true);
    const { ok, data } = await uploadImage("/api/profile/cover", file);
    setCoverPending(false);
    if (ok) {
      setCover(data.coverImageUrl);
      toast.success("Cover photo updated");
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't upload cover photo.");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/profile/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone") || undefined,
        linkedinUrl: fd.get("linkedinUrl") || undefined,
      }),
    });
    setPending(false);
    if (res.ok) {
      setOpen(false);
      toast.success("Profile updated");
      router.refresh();
    } else {
      toast.error("Couldn't save changes.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="border-primary text-primary hover:bg-primary/5 hover:text-primary w-full" />}>
        <Pencil className="size-3.5" /> Edit Profile
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Cover photo</Label>
            <div
              className="relative h-24 w-full overflow-hidden rounded-lg border"
              style={!cover ? { background: "linear-gradient(135deg, var(--primary), var(--accent))" } : undefined}
            >
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="size-full object-cover" />
              )}
              <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleCoverChange} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-background/90 absolute right-2 bottom-2 backdrop-blur"
                disabled={coverPending}
                onClick={() => coverInputRef.current?.click()}
              >
                <Camera className="size-3.5" /> {coverPending ? "Uploading…" : "Change cover"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="size-16">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="bg-accent text-accent-foreground text-lg font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1.5">
              <Label>Profile photo</Label>
              <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleAvatarChange} />
              <Button type="button" variant="outline" size="sm" disabled={avatarPending} onClick={() => avatarInputRef.current?.click()}>
                <Camera className="size-3.5" /> {avatarPending ? "Uploading…" : "Change photo"}
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" name="name" defaultValue={name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" name="phone" defaultValue={phone ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-linkedin">LinkedIn URL</Label>
              <Input id="edit-linkedin" name="linkedinUrl" defaultValue={linkedinUrl ?? ""} placeholder="https://linkedin.com/in/…" />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
