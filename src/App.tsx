import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Page1 from './pages/Page1'
import Page2 from './pages/Page2'
import Page3 from './pages/Page3'
import "./App.css"

export default function App() {
  return (
    <BrowserRouter>
      {/* Hidden Radio Buttons for Theme State */}
      <input type="radio" name="theme" id="theme-light" className="theme-control" />
      <input type="radio" name="theme" id="theme-dark" className="theme-control" />
      <input type="radio" name="theme" id="theme-transparent" className="theme-control" defaultChecked />

      <div className="app-wrapper" flex h-screen overflow-hidden>
        <Sidebar />

        <main flex-1 relative overflow-hidden>
          <Routes>
            <Route path="/" element={<Page1 />} />
            <Route path="/page2" element={<Page2 />} />
            <Route path="/page3" element={<Page3 />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
