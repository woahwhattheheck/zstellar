import Image from "next/image";

export function Hero() {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <h1 className="flex flex-wrap items-center justify-center gap-x-4 text-5xl font-medium leading-tight tracking-tight text-fg sm:text-7xl">
        <span>Invisible</span>
        <Image
          src="/Assets/Images/Logo-Brands/zStellar-logo.png"
          alt="zStellar"
          width={64}
          height={64}
          priority
          className="inline-block h-12 w-12 rounded-2xl object-contain sm:h-16 sm:w-16"
        />
        <span>Payment</span>
        <span className="w-full">for your money.</span>
      </h1>

      <p className="max-w-sm text-base leading-7 text-muted">
        The privacy layer for payments on{" "}
        <span className="inline-flex items-center gap-1 whitespace-nowrap align-baseline">
          <Image
            src="/Assets/Images/Logo-Coin/stellar-logo.svg"
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            loading="lazy"
            decoding="async"
            className="inline-block h-4 w-4 object-contain dark:invert"
          />
          Stellar.
        </span>
        <br />
        Visible to no one but you.
      </p>
    </div>
  );
}
