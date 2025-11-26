import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'virtual:uno.css'
import './App.css'

createApp(App)
  .use(router)
  .mount('#root')
