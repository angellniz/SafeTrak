import { Link } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f5] text-[#111111]">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-8 py-7 lg:px-20 lg:py-10">
        <header>
          <BrandMark />
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="max-w-[630px]">
            <h1 className="font-display text-[54px] leading-[0.98] tracking-[-0.045em] sm:text-[66px] lg:text-[82px]">
              Let&apos;s get <em>digital.</em>
            </h1>

            <p className="mt-7 max-w-[610px] text-[18px] leading-[1.42] tracking-[-0.02em] text-[#111111] sm:text-[22px] lg:text-[25px]">
              Bridging the gap between campus security
              <br className="hidden sm:block" />
              and parental peace of mind with offline-
              <br className="hidden sm:block" />
              capable, privacy-first student protection.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4">
              <Button asChild variant="outline" size="lg" className="h-16 w-[285px] rounded-full border-[#202020] text-[18px] shadow-none">
                <Link to="/signup">Sign Up</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-16 w-[285px] rounded-full border-[#202020] text-[18px] shadow-none">
                <Link to="/login-code">Log In using Code</Link>
              </Button>
              <div className="flex flex-wrap items-center gap-4 ml-2 text-sm font-medium"><Link to="/login" className="underline underline-offset-4">Admin Log In with email &amp; password</Link><span className="text-[#aaa]">|</span><Link to="/guardian" className="underline underline-offset-4">Guardian App</Link></div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <Logo className="w-full max-w-[650px] object-contain drop-shadow-[0_30px_25px_rgba(0,0,0,0.18)]" />
          </div>
        </section>
      </div>
    </main>
  );
}
