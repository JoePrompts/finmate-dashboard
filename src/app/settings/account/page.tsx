"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { AlertCircle, ExternalLink, RefreshCw, Copy, Link as LinkIcon, Link2Off, Settings, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "@/app/providers"

type Profile = {
  user_id: string
  telegram_user_id: number | null
  telegram_chat_id: number | null
  telegram_username: string | null
  linked_at: string | null
}

type LinkToken = {
  token: string
  expires_at: string
}

function makeUrlSafeToken(len: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
  const arr = new Uint32Array(len)
  if (typeof crypto !== "undefined" && (crypto as Crypto).getRandomValues) {
    (crypto as Crypto).getRandomValues(arr)
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * alphabet.length)
  }
  let out = ""
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length]
  return out
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err !== null) {
    try { return JSON.stringify(err) } catch {}
  }
  return String(err ?? 'Error')
}

export default function AccountSettingsPage() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tokenData, setTokenData] = useState<LinkToken | null>(null)
  const [busy, setBusy] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const botUser = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ""

  const isLinked = !!profile

  const deepLink = useMemo(() => {
    if (!tokenData || !botUser) return null
    return `https://t.me/${botUser}?start=${tokenData.token}`
  }, [tokenData, botUser])

  const msRemaining = useMemo(() => {
    if (!tokenData) return 0
    const end = Date.parse(tokenData.expires_at)
    const now = Date.now()
    return Math.max(0, end - now)
  }, [tokenData])

  const mmss = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  useEffect(() => {
    let raf: number | null = null
    const tick = () => {
      // Force re-render every 1s while token active
      if (tokenData && msRemaining > 0) {
        raf = window.setTimeout(() => setTokenData((t) => (t ? { ...t } : t)), 1000)
      }
    }
    tick()
    return () => { if (raf) clearTimeout(raf) }
  }, [tokenData, msRemaining])

  useEffect(() => {
    async function init() {
      setErrorMsg(null)
      setLoading(true)
      try {
        if (!SUPABASE_CONFIGURED) {
          setErrorMsg('Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.')
          return
        }
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error('No autenticado')
        const { data: prof, error: pErr } = await supabase
          .from('profiles')
          .select('user_id, telegram_user_id, telegram_chat_id, telegram_username, linked_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (pErr) throw pErr
        setProfile(prof || null)
      } catch (e: unknown) {
        setErrorMsg(getErrorMessage(e) || 'No se pudo cargar el estado de Telegram')
      } finally {
        setLoading(false)
      }
    }
    init()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function generateToken() {
    setBusy(true)
    setErrorMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const nowIso = new Date().toISOString()
      // Revoke any unexpired tokens (optionally only unused)
      await supabase.from('link_tokens')
        .delete()
        .eq('user_id', user.id)
        .gt('expires_at', nowIso)
        .is('used_at', null)

      const token = makeUrlSafeToken(10)
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('link_tokens')
        .insert({ user_id: user.id, token, expires_at })
        .select('token, expires_at')
        .single()
      if (error) throw error
      setTokenData({ token: data.token, expires_at: data.expires_at })

      // Start polling profiles to detect completion
      if (pollRef.current) clearInterval(pollRef.current)
      const started = Date.now()
      pollRef.current = setInterval(async () => {
        // Stop after 5 minutes
        if (Date.now() - started > 5 * 60 * 1000) {
          if (pollRef.current) clearInterval(pollRef.current)
          return
        }
        const { data: prof } = await supabase
          .from('profiles')
          .select('user_id, telegram_username, linked_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (prof) {
          setProfile(prof as Profile)
          if (pollRef.current) clearInterval(pollRef.current)
          // optional telemetry could go here
        }
      }, 4000)
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e) || 'No se pudo generar el token de enlace')
    } finally {
      setBusy(false)
    }
  }

  async function unlinkTelegram() {
    setBusy(true)
    setErrorMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase.from('profiles').delete().eq('user_id', user.id)
      if (error) throw error
      setProfile(null)
      setTokenData(null)
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e) || 'No se pudo desvincular Telegram')
    } finally {
      setBusy(false)
    }
  }

  const expired = tokenData ? msRemaining <= 0 : false

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b bg-background px-4 md:px-6 sticky top-0">
        <div className="flex w-full items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="text-sm font-medium">Settings · Account</div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              title="Refrescar"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Refrescar</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Cambiar tema</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {errorMsg && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <section className="grid gap-6 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Conectar Telegram</CardTitle>
              <CardDescription>
                Vincula tu Telegram para registrar gastos y ver presupuestos desde el chat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Cargando…</div>
              ) : isLinked ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Vinculado</Badge>
                    <div className="text-sm">
                      {profile?.telegram_username ? (
                        <>Vinculado a @{profile.telegram_username}</>
                      ) : (
                        <>Vinculado</>
                      )}
                    </div>
                  </div>
                  {profile?.linked_at && (
                    <div className="text-xs text-muted-foreground">
                      Última vinculación: {new Date(profile.linked_at).toLocaleString()}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Puedes volver a vincular cuando quieras.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {!tokenData && (
                    <Button onClick={generateToken} disabled={busy || !SUPABASE_CONFIGURED}>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Conectar Telegram
                    </Button>
                  )}

                  {tokenData && (
                    <div className="space-y-3">
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        <li> Toca “Abrir Telegram” abajo. </li>
                        <li> En Telegram, toca Start para finalizar el enlace. </li>
                      </ol>

                      <div className="flex items-center gap-2">
                        <Button asChild disabled={expired || busy || !botUser}>
                          <a href={deepLink ?? '#'} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir Telegram
                          </a>
                        </Button>
                        <div className={cn("text-sm", expired ? "text-red-600" : "text-muted-foreground")}
                          title={tokenData.expires_at}
                        >
                          {expired ? "El enlace venció. Genera uno nuevo." : `Vence en ${mmss(msRemaining)}`}
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="text-muted-foreground">O envía este mensaje al bot: </span>
                        <code className="rounded bg-muted px-2 py-1">/start {tokenData.token}</code>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 ml-1"
                              onClick={() => navigator.clipboard?.writeText(`/start ${tokenData.token}`)}
                              title="Copiar"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copiar</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="text-xs text-muted-foreground">Este enlace vence en 10 minutos.</div>

                      <div className="pt-2">
                        <Button variant="secondary" onClick={generateToken} disabled={busy}>
                          Generar nuevo enlace
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="text-xs text-muted-foreground">
                Bot: {botUser ? `@${botUser}` : 'No configurado'}
              </div>
              {isLinked && (
                <Button variant="outline" onClick={unlinkTelegram} disabled={busy}>
                  <Link2Off className="h-4 w-4 mr-2" />
                  Desvincular
                </Button>
              )}
            </CardFooter>
          </Card>
        </section>
      </main>
    </>
  )
}
