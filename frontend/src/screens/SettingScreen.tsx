export const SettingScreen = () => {
    return (
        <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0a] px-6 text-white">
            <div className="w-full max-w-[900px] text-center">

                {/* Badge */}
                <div className="mb-6 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-gray-400 sm:text-sm">
                    🚀 UNDER DEVELOPMENT
                </div>

                {/* Main Text */}
                <h1 className="mb-6 text-[clamp(3.5rem,10vw,9rem)] font-black leading-[0.9] tracking-[-0.06em]">
                    COMING
                    <br />
                    <span className="text-white/90">
                        SOON.
                    </span>
                </h1>

                {/* Description */}
                <p className="mx-auto max-w-[550px] text-base leading-relaxed text-gray-400 sm:text-lg md:text-xl">
                    We're working on something awesome. This section is currently
                    under construction and will be available soon.
                </p>

                {/* Dots */}
                <div className="mt-10 flex justify-center gap-3 sm:mt-12">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-white/70 [animation-delay:200ms]" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-white/40 [animation-delay:400ms]" />
                </div>

            </div>
        </div>
    );
}
