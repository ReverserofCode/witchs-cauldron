export default function Footer() {
  return (
    <footer className="w-full border-t border-[rgba(219,206,247,0.6)] surface">
      <div className="flex items-center justify-between py-8 text-xs text-muted w-full">
        <div className="container flex items-center justify-between w-full">
          <p>© {new Date().getFullYear()} Witch&apos;s Cauldron</p>
          <p className="opacity-80">Powered by Moing palette</p>
        </div>
      </div>
    </footer>
  );
}
