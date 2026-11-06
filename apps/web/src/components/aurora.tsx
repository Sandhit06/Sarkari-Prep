export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#f6f5f1] dark:bg-[#070a12]" />

      <div className="animate-drift absolute -left-[18%] -top-[30%] h-[46rem] w-[46rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(53,102,245,0.30),rgba(53,102,245,0)_62%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(53,102,245,0.42),rgba(53,102,245,0)_62%)]" />

      <div className="animate-drift animation-delay-1 absolute -right-[16%] -top-[12%] h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(247,144,9,0.22),rgba(247,144,9,0)_62%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(247,144,9,0.18),rgba(247,144,9,0)_62%)]" />

      <div className="animate-drift animation-delay-2 absolute -bottom-[26%] left-[20%] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),rgba(16,185,129,0)_62%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.30),rgba(99,102,241,0)_62%)]" />

      <div className="absolute inset-0 opacity-[0.55] [background-image:radial-gradient(rgba(13,20,36,0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_50%_18%,black,transparent_72%)] dark:opacity-[0.4] dark:[background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)]" />

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/40 to-transparent dark:from-black/30" />
    </div>
  );
}
