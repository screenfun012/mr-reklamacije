export function RouteNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-lg font-semibold">Stranica nije pronađena</h1>
      <p className="text-sm text-muted-foreground">URL ne odgovara nijednoj ruti u aplikaciji.</p>
    </div>
  )
}
