import Logo from "./Logo";

export default function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 overflow-hidden rounded-md bg-white">
        <Logo className="h-full w-full object-cover object-center" />
      </div>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Safetrak</span>
    </div>
  );
}
