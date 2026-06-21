import { Heading } from './heading.js'

export function RouteNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <Heading level="h1">Stranica nije pronađena</Heading>
      <p className="text-sm text-muted-foreground">URL ne odgovara nijednoj ruti u aplikaciji.</p>
    </div>
  )
}
