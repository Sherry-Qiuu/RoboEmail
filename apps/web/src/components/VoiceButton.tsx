import { useEffect, useRef, useState } from 'react'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type SpeechEvent = {
  resultIndex: number
  results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } }
}

function recognizer(): (new () => SpeechRecognitionLike) | null {
  const api = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return api.SpeechRecognition ?? api.webkitSpeechRecognition ?? null
}

type Props = {
  onText: (text: string) => void
  lang?: string
}

/**
 * Speech-to-text via the browser. Chrome and Edge ship it; anywhere else the
 * button simply does not render, so typing is always the fallback.
 */
export function VoiceButton({ onText, lang = 'zh-CN' }: Props) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const handler = useRef(onText)
  handler.current = onText

  useEffect(() => {
    setSupported(Boolean(recognizer()))
    return () => recognition.current?.stop()
  }, [])

  if (!supported) return null

  function toggle() {
    if (listening) {
      recognition.current?.stop()
      return
    }

    const Ctor = recognizer()
    if (!Ctor) return

    const instance = new Ctor()
    instance.lang = lang
    instance.continuous = true
    instance.interimResults = false
    instance.onresult = (event) => {
      let said = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result?.isFinal) said += result[0]?.transcript ?? ''
      }
      if (said.trim()) handler.current(said)
    }
    instance.onend = () => setListening(false)
    instance.onerror = () => setListening(false)

    recognition.current = instance
    instance.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`text-[11px] tracking-wide transition-colors ${
        listening ? 'text-accent' : 'text-faint hover:text-ink'
      }`}
    >
      {listening ? '● 停止' : '语音'}
    </button>
  )
}
