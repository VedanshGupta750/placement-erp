import Image from "next/image";
import { PWA_CONFIG } from "@/lib/pwa/config";

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src={PWA_CONFIG.logoPath}
      width={96}
      height={96}
      alt=""
      className={`object-contain ${className ?? ""}`}
      priority
    />
  );
}
