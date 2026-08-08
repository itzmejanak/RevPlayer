export default function DownloadsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Downloads</h1>
        <p className="text-sm text-muted-foreground">
          Manage your offline videos and device storage.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">Nothing downloaded yet.</p>
    </div>
  );
}
