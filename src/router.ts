import { createRouter, createWebHistory } from "vue-router";
import Connections from "./pages/Connections.vue";
import QueryConsole from "./pages/QueryConsole.vue";
import Collection from "./pages/Collection.vue";
import History from "./pages/History.vue";
import Settings from "./pages/Settings.vue";

const routes = [
  { path: "/", component: QueryConsole },
  { path: "/connections", component: Connections },
  { path: "/collection", component: Collection },
  { path: "/history", component: History },
  { path: "/settings", component: Settings },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
