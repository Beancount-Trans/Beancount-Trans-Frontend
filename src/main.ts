import { createApp } from "vue";
import App from "./App.vue";
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import route from "./routers"
import axios from "axios"
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 主题：用 SCSS 源编译，确保自定义色阶参与 Element 的派生
import "element-plus/theme-chalk/src/index.scss";

import "~/styles/index.scss";
import "uno.css";

const app = createApp(App);
// app.config.globalProperties.$baseUrl = 'http://127.0.0.1:38001'
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(route)
app.use(ElementPlus, {
  locale: zhCn,
})
// app.use(ElementPlus, { size: 'small', zIndex: 3000 })
app.config.globalProperties.$axios = axios  // 全局注册 $axios
app.mount("#app");
