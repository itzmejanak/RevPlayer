export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Storage, playback defaults, and app preferences.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Settings arrive in a later phase.
      </p>
    </div>
  );
}
