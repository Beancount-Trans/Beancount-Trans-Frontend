# Beancount-Trans Frontend

一个为 [`Beancount-Trans`](https://github.com/Beancount-Trans/Beancount-Trans) 项目提供的现代化、功能丰富的前端界面。本项目使用 Vue 3、TypeScript 和 Element Plus 构建，旨在为您的 Beancount 复式记账系统提供一个直观、易用的 Web 操作体验。

![Vue](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Element Plus](https://img.shields.io/badge/Element%20Plus-%234FC08D?style=for-the-badge&logo=element-plus&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## ✨ 特性

- 🚀 **现代技术栈**: 基于 Vue 3 `<script setup>` 语法、TypeScript 和 Vite，提供极致的开发体验和构建速度。
- 🎨 **优雅的UI**: 采用 Element Plus UI 框架，提供专业且美观的用户界面。
- 📱 **响应式设计**: 适配桌面端和移动端各种屏幕尺寸。
- 🔒 **类型安全**: 全面的 TypeScript 支持，提升代码质量和开发效率。
- ⚡ **高效开发**: 集成 Vue Router、Pinia 等核心库，架构清晰，易于维护和扩展。
- 🐳 **容器化部署**: 提供完整的 Docker 支持，方便部署和扩展。

## 🖥️ 功能概述

前端提供以下核心功能界面：

- **登录/注册**: 用户认证与授权。
- **账单解析**: 上传银行或支付平台账单（CSV/Excel），由后端解析后，在前端清晰展示并允许用户提交反馈以智能更新解析结果。
- **映射管理**: 管理和配置智能解析规则，用于自动匹配账单条目到正确的 Beancount 账户。
- **文件管理**: 查看和管理已上传的账单文件及生成的 Beancount 账本文件。
- **账本访问**: 查看和检索已生成的 Beancount 交易记录。

> 项目界面截图可在主项目 [Beancount-Trans](https://github.com/Beancount-Trans/Beancount-Trans) 中查看。

## 🛠️ 开发准备

### 环境要求

- [Node.js](https://nodejs.org/) (版本 18 或更高版本，推荐 20+)
- npm

### 获取项目

```bash
# 使用 SSH
git clone git@github.com:Beancount-Trans/Beancount-Trans-Frontend.git

# 或者使用 HTTPS
git clone https://github.com/Beancount-Trans/Beancount-Trans-Frontend.git

# 进入项目目录
cd Beancount-Trans-Frontend
```

### 安装依赖

```bash
# 使用 npm
npm install
```

## 🚀 开发和构建

### 启动开发服务器

这将启动一个带有热重载的开发服务器（通常为 `http://localhost:5173`）。您需要确保 [`Beancount-Trans`](https://github.com/Beancount-Trans/Beancount-Trans) 后端 API 服务已在 `http://localhost:8000` 运行。

```bash
npm run dev

# 或者指定端口
npm run dev -- --port 3000
```

### 构建生产版本

```bash
npm build
```

构建后的文件将生成在 `dist` 目录中。

## ⚙️ 配置

### 环境变量

项目通过环境变量配置后端 API 地址。您可以通过根目录下的 `.env`、`.env.development` 和 `.env.production` 文件进行配置。

复制示例环境变量文件并修改您自己的配置：

```bash
cp .env.example .env
```

关键环境变量：

- `VITE_API_BASE_URL`: 后端 API 的基础 URL（例如：`http://localhost:8000/api`）。

**开发时**，请在 `.env.development` 文件中设置：

```ini
VITE_API_BASE_URL="http://localhost:8000/api"
```

**生产环境（Docker）** 时，通过容器环境变量注入（见下方部署部分）。

### API 文档

后端提供了完整的 OpenAPI 规范，前端开发时可参考：

- **API 文档（ReDoc）**: [https://trans.dhr2333.cn/api/docs/](https://trans.dhr2333.cn/api/docs/)

这些文档详细列出了所有可用的 API 端点、请求参数和响应格式，是前端联调的重要参考。

## 🤝 如何贡献

我们欢迎任何形式的贡献！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 🙏 致谢

- [Vue.js](https://vuejs.org/)
- [Element Plus](https://element-plus.org/)
- [Vite](https://vitejs.dev/)
- [Beancount](http://beancount.org/)
- [Django Spectacular](https://drf-spectacular.readthedocs.io/) for OpenAPI docs

## 📄 许可证

本项目根据 GNU AGPL-3.0-or-later 许可证授权 - 详见 [LICENSE](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/blob/main/LICENSE.txt) 文件。
