"use client"

import { ArrowRight, Mic, Square } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import TextareaAutosize from "react-textarea-autosize"
import Focus from "./MessageInputActions/Focus"
import Optimization from "./MessageInputActions/Optimization"
import Attach from "./MessageInputActions/Attach"
import { useChat } from "@/lib/hooks/useChat"

const EmptyChatMessageInput = () => {
  const { sendMessage } = useChat()

  const [message, setMessage] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState<any | null>(null)
  const [interimTranscript, setInterimTranscript] = useState("")

  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognitionInstance = new SpeechRecognition()

      recognitionInstance.continuous = true
      recognitionInstance.interimResults = true
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (finalTranscript) {
          setMessage((prev) => prev + finalTranscript)
          setInterimTranscript("")
        } else {
          setInterimTranscript(interimTranscript)
        }
      }

      recognitionInstance.onerror = (event) => {
        console.error("Speech recognition error:", event.error)
        setIsRecording(false)
        setInterimTranscript("")
      }

      recognitionInstance.onend = () => {
        setIsRecording(false)
        setInterimTranscript("")
      }

      setRecognition(recognitionInstance)
    }
  }, [])

  const startRecording = () => {
    if (recognition) {
      setIsRecording(true)
      setInterimTranscript("")
      recognition.start()
    }
  }

  const stopRecording = () => {
    if (recognition) {
      recognition.stop()
      setIsRecording(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement

      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.hasAttribute("contenteditable")

      if (e.key === "/" && !isInputFocused) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    inputRef.current?.focus()

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isRecording) {
          stopRecording()
        }
        sendMessage(message)
        setMessage("")
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          if (isRecording) {
            stopRecording()
          }
          sendMessage(message)
          setMessage("")
        }
      }}
      className="w-full"
    >
      <div className="flex flex-col bg-secondary dark:bg-secondary px-5 pt-5 pb-2 rounded-lg w-full border border-border">
        

        <TextareaAutosize
          ref={inputRef}
          value={message + interimTranscript}
          onChange={(e) => {
            const newValue = e.target.value
            if (newValue.length >= message.length) {
              setMessage(newValue.slice(0, newValue.length - interimTranscript.length))
            } else {
              setMessage(newValue)
            }
          }}
          minRows={2}
          className="bg-transparent placeholder:text-muted-foreground text-sm text-foreground resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder="Ask anything..."
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <div className="flex flex-row items-center space-x-2 lg:space-x-4">
            <Focus />
            <Attach showText />
          </div>
          <div className="flex flex-row items-center space-x-1 sm:space-x-4">
            <Optimization />

            {recognition && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`${
                  isRecording ? "bg-red-500 hover:bg-red-600" : "bg-gray-500 hover:bg-gray-600"
                } text-white transition duration-100 rounded-full p-2`}
                title={isRecording ? "Stop recording" : "Start voice recording"}
              >
                {isRecording ? <Square size={17} /> : <Mic size={17} />}
              </button>
            )}

            <button
              disabled={message.trim().length === 0}
              className="bg-[#24A0ED] text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
            >
              <ArrowRight className="bg-background" size={17} />
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

export default EmptyChatMessageInput
