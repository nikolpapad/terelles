/** Text logo — swap for the official TERR'ELLES logo file when available. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`px-box inline-flex items-center gap-2 px-3 py-1.5 text-lg font-bold ${className}`}>
      <span className="inline-block h-3 w-3 bg-leaf" />
      TERR<span className="text-terracotta">&apos;</span>ELLES
    </div>
  );
}
