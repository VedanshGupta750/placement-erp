"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { resizeImageForUpload } from "@/lib/uploads/resize-image-client";

async function uploadImage(endpoint: string, file: File) {
  const resized = await resizeImageForUpload(file);
  const fd = new FormData();
  fd.set("file", resized);
  const res = await fetch(endpoint, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function StaffProfileHeader({
  name,
  avatarUrl,
  coverImageUrl,
  roleLabel,
  collegeName,
}: {
  name: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  roleLabel: string;
  collegeName: string;
}) {
  const router = useRouter();
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
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't upload cover photo.");
    }
  }

  return (
    <div>
      <div
        className="group relative h-56 w-full overflow-hidden rounded-xl border"
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
          className="bg-background/90 absolute right-3 bottom-3 backdrop-blur"
          disabled={coverPending}
          onClick={() => coverInputRef.current?.click()}
        >
          <Camera className="size-3.5" /> {coverPending ? "Uploading…" : "Change cover"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 px-6">
        <div className="flex items-end gap-4">
          <div className="group relative -mt-14 shrink-0 rounded-full ring-4 ring-background">
            <Avatar className="size-28">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="bg-accent text-accent-foreground text-3xl font-medium">{initials}</AvatarFallback>
            </Avatar>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleAvatarChange} />
            <button
              type="button"
              disabled={avatarPending}
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Change photo"
              className="bg-foreground text-background absolute right-1 bottom-1 flex size-8 items-center justify-center rounded-full shadow"
            >
              <Camera className="size-3.5" />
            </button>
          </div>
          <div className="pb-2">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <Badge variant="secondary" className="mt-1.5 border-none font-normal">{roleLabel}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-3 text-sm">
          <span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full">
            <UserIcon className="size-3.5" />
          </span>
          <span className="text-muted-foreground">{collegeName}</span>
        </div>
      </div>
    </div>
  );
}
