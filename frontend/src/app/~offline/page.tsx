export default function OfflinePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-4xl">📡</div>
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="text-muted-foreground">
        Check your internet connection and try again.
      </p>
    </div>
  );
}
