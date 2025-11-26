import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import reactLogo from "../assets/react.svg"

export default function Page1() {
  const [greetMsg, setGreetMsg] = useState("")
  const [name, setName] = useState("")

  async function greet() {
    setGreetMsg(await invoke("greet", { name }))
  }

  return (
    <div flex="~ col" justify-center text-center h-full overflow-y-auto p-8>
      <h1 text="4xl" font-bold mb-8>Welcome to Tauri + React</h1>

      <div flex justify-center gap-8 mb-8>
        <a href="https://vite.dev" target="_blank" font-medium text="[#646cff] hover:[#535bf2]" decoration-none>
          <img src="/vite.svg" h-24 p-6 transition-all duration-700 hover:drop-shadow="[0_0_2em_#747bff]" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank" font-medium text="[#646cff] hover:[#535bf2]" decoration-none>
          <img src="/tauri.svg" h-24 p-6 transition-all duration-700 hover:drop-shadow="[0_0_2em_#24c8db]" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank" font-medium text="[#646cff] hover:[#535bf2]" decoration-none>
          <img src={reactLogo} h-24 p-6 transition-all duration-700 hover:drop-shadow="[0_0_2em_#61dafb]" alt="React logo" />
        </a>
      </div>
      <p mb-8>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        flex justify-center gap-2
        onSubmit={(e) => {
          e.preventDefault()
          greet()
        }}
      >
        <input
          id="greet-input"
          rounded-lg border="~ transparent" px-5 py="2.5" text-base font-medium text-inherit bg="[var(--btn-bg)]" transition-colors duration-250 shadow-sm outline-none
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button 
          type="submit"
          cursor-pointer rounded-lg border="~ transparent" px-5 py="2.5" text-base font-medium text-inherit bg="[var(--btn-bg)]" transition-colors duration-250 shadow-sm outline-none hover-border="[#396cd8]" active-bg="[var(--btn-hover)]" active-border="[#396cd8]"
        >
          Greet
        </button>
      </form>
      <p mt-4>{greetMsg}</p>
    </div>
  )
}
