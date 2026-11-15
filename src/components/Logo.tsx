import logoSrc from "@/assets/logo.png";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { box: "h-8 w-8", text: "text-lg" },
    md: { box: "h-10 w-10", text: "text-xl" },
    lg: { box: "h-14 w-14", text: "text-3xl" },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoSrc}
        alt="ZapPrático"
        className={`${sizes.box} object-contain drop-shadow-[0_0_12px_oklch(0.78_0.18_152/0.45)]`}
      />
      <span className={`${sizes.text} font-display font-bold tracking-tight`}>
        Zap<span className="text-gradient">Prático</span>
      </span>
    </div>
  );
}
