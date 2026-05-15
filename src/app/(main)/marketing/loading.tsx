export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in zoom-in">
      <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
      <p className="text-muted-foreground text-sm font-medium animate-pulse">Carregando...</p>
    </div>
  );
}
