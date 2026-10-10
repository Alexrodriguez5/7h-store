"use client";
export default function Error({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="mx-auto max-w-xl px-5 py-24 text-center"><h1 className="font-display text-4xl">No pudimos abrir el checkout.</h1><button onClick={reset} className="mt-6 bg-ink px-5 py-3 text-sm text-ivory">Intentar de nuevo</button></main>}
