import { useState } from "react"
import reactLogo from "./assets/react.svg"
import { invoke } from "@tauri-apps/api/core"
import "./App.css"

export default function App() {
  const [greetMsg, setGreetMsg] = useState("")
  const [name, setName] = useState("")

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }))
  }

  return (
    <>
      <input type="radio" name="theme" id="theme-light" className="theme-control" />
      <input type="radio" name="theme" id="theme-dark" className="theme-control" />
      <input type="radio" name="theme" id="theme-transparent" className="theme-control" defaultChecked />

      <div className="app-wrapper">
        <div className="absolute top-4 right-4 inline-block group">
          <button className="px-5 py-2.5 text-base border-none cursor-pointer rounded-lg bg-[var(--btn-bg)] text-[var(--text)]">Theme</button>
          <div className="hidden absolute right-0 min-w-[160px] shadow-lg z-10 rounded-lg backdrop-blur-md bg-[var(--btn-bg)] group-hover:block">
            <label htmlFor="theme-light" className="block px-4 py-3 no-underline cursor-pointer text-[var(--text)] hover:bg-[var(--btn-hover)]">Light</label>
            <label htmlFor="theme-dark" className="block px-4 py-3 no-underline cursor-pointer text-[var(--text)] hover:bg-[var(--btn-hover)]">Dark</label>
            <label htmlFor="theme-transparent" className="block px-4 py-3 no-underline cursor-pointer text-[var(--text)] hover:bg-[var(--btn-hover)]">Transparent</label>
          </div>
        </div>

        <main flex="~ col" justify-center text-center pt="[10vh]" m-0>
          <h1 text="center 4xl" font-bold mb-8>Welcome to Tauri + React</h1>

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
              rounded-lg border="~ transparent" px-5 py="2.5" text-base font-medium text-inherit bg="[var(--btn-bg)]" transition-colors duration-250 shadow-sm outline-none focus-border="[#396cd8]"
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
        </main>
      </div>
    </>
  )
}
