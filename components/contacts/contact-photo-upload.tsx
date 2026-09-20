"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ContactPhotoUpload({
  contactId,
  name,
  photoUrl,
  canEdit,
}: {
  contactId: string;
  name: string;
  photoUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState(photoUrl);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPending(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/contacts/${contactId}/photo`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) {
      setPhoto(data.photoUrl);
      router.refresh();
    } else {
      toast.error(data.message ?? "Couldn't upload photo.");
    }
  }

  return (
    <div className="group relative shrink-0 rounded-full ring-4 ring-background">
      <Avatar size="lg" className="size-16">
        {photo && <AvatarImage src={photo} alt={name} />}
        <AvatarFallback className="bg-accent text-accent-foreground text-lg font-medium">{initials}</AvatarFallback>
      </Avatar>
      {canEdit && (
        <>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleChange} />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            aria-label="Change photo"
            className="bg-foreground text-background absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full opacity-0 shadow transition-opacity group-hover:opacity-100"
          >
            <Camera className="size-3" />
          </button>
        </>
      )}
    </div>
  );
}
