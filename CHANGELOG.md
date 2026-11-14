## [5.23.0](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/compare/5.22.0...5.23.0) (2026-11-14)

### Features

* **trans:** 游客登录写入后自动生成首期月报 ([610fe5a](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/610fe5a5ff26b256e04cb083d8e198716a0029d8))

## [5.22.0](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/compare/5.21.0...5.22.0) (2026-11-14)

### Features

* **review:** 游客默认原文并将复制结果并入预览 ([79d9dbd](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/79d9dbdcaebc067a77ea3de8129d8d0023d45382))

## [5.21.0](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/compare/5.20.0...5.21.0) (2026-11-13)

### Features

* **account-management:** 展示账户托管态并禁用受限操作 ([93fb58e](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/93fb58e30a2e9fa00b2479031762c81fe9685cbc))
* **account-management:** 引导收尾交接账户与映射并补审核页兜底提示 ([b58fc8e](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/b58fc8e4b71eeec1fcc50677a9771a1728f4b076))
* **account-management:** 新用户引导配置支付宝对账周期并完成首次对账 ([55f6702](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/55f6702d5c2ba638ee4fc7638780002afc94d540))
* **account-management:** 账户树支持按路径与描述搜索 ([3a63ae4](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/3a63ae427507370fef58362b122f542a05d68024))
* **account:** 账户树按根类型分组并对接账户对账 ([4c5f164](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/4c5f1643539b575b666e3e7a4a5b52e5c7182313))
* **account:** 账户表单与详情支持多币种 ([9a484ef](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/9a484ef72431bb15d9a6ead73ab344f05deb90e4))
* **branding:** 顶栏与页面图标改为财见品牌 ([cb5c17d](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/cb5c17dd3757b895e55b1632b58f8590630ddecc))
* **capability:** 按会话层级收敛路由入口 ([c3b3a33](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/c3b3a338b11ad3ed6cd10d87f8355ff99047596d))
* **config:** 解析设置支持开关资产账户自动补齐 ([dbb848d](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/dbb848d6f8676bc8a650d3155edaf4d0fe528427))
* **git:** 高级设置支持自动导入账本新增账户 ([85f3489](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/85f348940b6475bc291409073042077e433567ab))
* **parse:** 条目支持行内排除，清空文本不再删除条目 ([5f59f51](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/5f59f51639ebce598e927084f9d8250149565b9c))
* **reconciliation:** 对账时间点默认沿用当天或上一条已完成对账 ([c4d81a4](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/c4d81a455c6fc0038b09e3143840fbe42f502f96))
* **review:** 新增仅需关注与全部视图切换 ([9d4eeca](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/9d4eeca0047841e3d232b05bf52db9afcc2222f5))
* **review:** 新增表单/原文模式切换与结构化条目编辑 ([4a7b903](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/4a7b903565cf4ad0957610c649add19d13a68f7c))
* **trans:** 未登录解析结果引导登录并自动重解析 ([d503949](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/d5039499cb41bd9fbdcdc54add03bd67c7f2871c))
* **trans:** 登录用户解析页提示多账单合并去重入口 ([1f7c35c](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/1f7c35c6b812a1bac56a8aa58a0eb8bfd2a9b556))
* **trans:** 解析结果条目编辑回车即保存 ([c8f3d05](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/c8f3d056fd9f291dadb4e44ff0052e3dc299bc8e))

### Bug Fixes

* **account-management:** 修正账户管理的提示逻辑与文案 ([c3d6736](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/c3d6736d7f01dadd18da273624a8dae023a5dd18))
* **account-management:** 账本已关闭账户可清理并单独归类 ([e069071](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/e06907126ce8e61dc07a67766af59861e74c6553))
* 修复对账周期表单会复用之前周期的缺陷 ([f7a9efd](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/f7a9efd538bff360245c6c316b1cc1483153f6c7))

## [5.20.0](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/compare/5.19.0...5.20.0) (2026-11-02)

### Features

* **router:** 根路径按登录态分流到解析页或文件管理 ([c167ade](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/c167ade4c1245c733f94ba170fdd281bf0a406bf))
* **trans:** 优化错误账单与加密账单的上传交互 ([547e6a7](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/547e6a74fedc71a79f241116c1ea810d3aca13b8))
* **trans:** 完善上传提示弹窗，添加银行账单指南跳转链接 ([e259e35](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/e259e35f1a470e7e7d3d934157c9008384f631b0))
* **trans:** 解析首页支持按次使用平台 LLM ([22e1091](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/22e109154f3347f7d1c5314b1c2c61a560106503))
* **trans:** 解析首页新增账单解析可用性悬浮框 ([049e013](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/049e013b3506d6c80946fd8a174a364b5382dd5d))

### Bug Fixes

* **trans:** 复制成功后清除解析草稿并优化弹窗文案 ([d5472e4](https://github.com/Beancount-Trans/Beancount-Trans-Frontend/commit/d5472e49404a6dffc64563876cd29b9b9f42fd83))

## [5.19.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.18.1...5.19.0) (2026-10-23)

### Features

* **map/format:** 优化AI解析引擎配置的登录状态适配 ([4a01f36](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/4a01f3601a8ddc1b6f18ca7a0e34a31f3667fa96))

## [5.18.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.18.0...5.18.1) (2026-10-19)

### Bug Fixes

* **copilot:** 修复生成的分享图表格内容被截断的问题 ([92b5159](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/92b5159d20cfd842f67285d3fed8e1046342b69e))

## [5.18.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.17.0...5.18.0) (2026-10-17)

### Features

* **account-management:** 添加对账周期快速预设并补全组件类型声明 ([e000eb7](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/e000eb705cb689dcc34cb49f36a4a96c6a0514a4))

### Bug Fixes

* **config/account:** 修复模板缩进并补充映射刷新逻辑 ([8f8f248](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/8f8f248891b6f177c19347d43ac3ef23feba4a57))

## [5.17.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.16.0...5.17.0) (2026-10-14)

### Features

* **reconciliation:** 循环待办支持日历改期并精简管理视图 ([577adc0](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/577adc0518155d795fec1bb38704342ab77bb8b3))
* **reconciliation:** 循环待办新增三块式新建弹窗 ([658c57d](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/658c57de1ebd1ee993df4987a42af5fc479810b7))
* **reconciliation:** 循环待办新增到期产出与固定模板编辑 ([1b0c910](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/1b0c91075aafb6185390a5d4c1db3379c24fd7ac))
* **reconciliation:** 循环待办管理日期样式统一与列表即时刷新 ([de0621a](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/de0621a2b5921961b578456781b0f5ac1c7ea492))
* **reconciliation:** 循环待办管理行内编辑与日期闭环 ([120b577](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/120b57746e1feb8f690184d455e157f28fdb64de))
* **reconciliation:** 新增next_run_date字段并更新对账任务列表日期展示 ([d8f7dad](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/d8f7dad7b7a7aecebca8c0bdd64514dd6c4cf162))
* **reconciliation:** 新增循环待办管理与「待办」页签 ([1801038](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/18010385b6d869a82ec6c1801f84a3f0c9d31862))
* **reconciliation:** 新建循环待办展示创建后果并统一基准日期语义 ([1ee8ebd](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/1ee8ebd082db35bf511ce8b76c217f39a1b17596))

### Bug Fixes

* **reconciliation:** 循环待办创建时 template_ref 传空串 ([85c9669](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/85c96698115c007e29e4357a78df155c640879bf))
* **reconciliation:** 生成审核待办隐藏「完成后起算」选项 ([b2c5c6e](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/b2c5c6e73a3f53c2820d0c379f739d4d2630b321))

## [5.16.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.15.1...5.16.0) (2026-10-06)

### Features

* **git:** 实现 trans 条目迁移到月度账本功能 ([2ade2f6](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/2ade2f60d88ec606d17c066fa0975fb34a5e93f8))

### Bug Fixes

* **parse-review:** 修复条目匹配错误的问题 ([12f79c7](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/12f79c7d26d8e15aeb076afa1a07749e23e43dee))
* **parse-review:** 实现分类映射的候选分类批量同步功能 ([e98b494](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/e98b4943bfa0363a19c7b4f87d019a002dd3d8e0))

## [5.15.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.15.0...5.15.1) (2026-09-30)

### Bug Fixes

* **assistant:** 修复会话ID不同步导致消息发错会话 ([844ec19](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/844ec1950318ab90e792a93bebc93c1cc347d579))
* **assistant:** 添加聊天消息重新生成按钮 ([0dbe2b0](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/0dbe2b04a7d038efe04e294afa33c4f6138d3640))

## [5.15.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.14.0...5.15.0) (2026-09-27)

### Features

* **assistant:** 优化助手首页空白会话的示例问句展示 ([09bb5df](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/09bb5df3a9cd1e8734d4fe49acaa6969f9ed4aa0))
* **assistant:** 支持共享账本用于助手对话 ([b086650](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/b0866502580f443244160fe53754708649ecafbd))
* **共享账本:** 将共享账本的单个备注替换为多别名支持 ([fab855e](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/fab855e367af9622bc9630f0215df8440acc36ff))
* 新增共享账本绑定、管理及跨账本聊天支持 ([c2c3c96](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/c2c3c96bf651f6a0f0e2d1ff780accd12d4d387e))

## [5.14.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.13.1...5.14.0) (2026-09-26)

### Features

* **parse-review:** 增加对Copilot记账条目的支持 ([8c91909](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/8c919099c3d787055fadae73cf5380b658c36cea))
* **translate:** 添加写入解析条目到用户账本的功能 ([5c4eb33](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/5c4eb33014f5b4d9feae011e6d895279a455cda2))

## [5.13.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.13.0...5.13.1) (2026-09-16)

### Bug Fixes

* **mcp:** OAuth 元数据 scheme ([ddd42e6](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/ddd42e63d8254a80acdb2702dac2f6f06f93ecf7))

## [5.13.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.12.2...5.13.0) (2026-09-16)

### Features

* 新增MCP客户端接入用的个人访问令牌管理功能 ([3fd4b76](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/3fd4b760feacaf152c36055842728df96ddd9238))

## [5.12.2](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.12.1...5.12.2) (2026-09-15)

### Bug Fixes

* **git_repository:** 完善各托管平台支持 ([da718af](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/da718af167bb056b2f5a9c9fb56e0d1629ac3082))
* **git:** 新增取消同步 ([93d5782](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/93d5782339cfb40978642dbc26869c94ab8723f3))
* 账单完成解析后，不再以账单进行分组，而是统一为条目审核待办，重复条目自动去重 ([7e0a147](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/7e0a14765502959f26468850b7a8d606a7eb1c7a))

## [5.12.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.12.0...5.12.1) (2026-09-08)

### Bug Fixes

* 优化选择候选分类后的提示 ([31d8761](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/31d87613b95923794c474b9814ebd089533e3d82))
* 首页解析对齐现有解析审核 ([f6ea14b](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/f6ea14b1290bd1f87d5b9ded9737894bd3ecb401))

## [5.12.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.12.0...5.12.1) (2026-09-08)

### Bug Fixes

* 优化选择候选分类后的提示 ([31d8761](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/31d87613b95923794c474b9814ebd089533e3d82))
* 首页解析对齐现有解析审核 ([f6ea14b](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/f6ea14b1290bd1f87d5b9ded9737894bd3ecb401))

## [5.12.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.11.0...5.12.0) (2026-09-02)

### Features

* Copilot Fava 引用来源 ([9f860e6](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/9f860e65dd74915976e25ffe28feb1f0b166033a))

### Bug Fixes

* 修复以下问题 ([a56199a](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/a56199a9e1f523b6dce15eddb7a0e2fdebd931c3))
* 修复前端修改账本账户负债账户描述后会自动展开资产账户的问题 ([84fb998](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/84fb998685870176c398b0334ada1331d0aa787a))
* 修复审核草稿一致性问题 ([43184e4](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/43184e42a3f469912a569d66fe1711fa312d28da))
* 修复或新增 Copilot 以下问题： ([1654db4](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/1654db47db2aee93cc6bd545ce6d062d278a53ae))
* 解决设置页两套 DeepSeek Key 的冗余问题 ([ccf710f](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/ccf710f3e0c5e9c872f132b1be937f4c69114048))
* 解析审核支持新增资产映射（参考新增支出映射和新增收入映射） ([1a18ee1](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/1a18ee14e8f49e5ed5186999c04e37a532dfe8c0))
* 请求只负责落库和投递任务，生成在 Celery 上跑；页面只订阅进度 ([c80e715](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/c80e715eb3a006db49f2fee6cad1da06a9d3b477))
* 预览保存为真源，删除条目后无空行 ([12f4f94](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/12f4f94f75ae639e9d008749c893ef2d98f1de00))

## [5.11.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.10.0...5.11.0) (2026-06-20)

### Features

* 添加深度思考功能以增强助手聊天体验 ([b0885cd](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/b0885cdacdfbf41ac047e58f93c7a51af9ffcfe6))

## [5.10.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.10...5.10.0) (2026-06-20)

### Features

* 更新示例问题以增强助手聊天功能 ([281520a](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/281520a614f2d774bc33e0ff5925bf3b96cf8b1f))

## [5.9.10](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.9...5.9.10) (2026-06-04)

### Bug Fixes

* defeat repair ([#65](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/65)) ([cb626ce](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/cb626ce5714faee54175f7637355b783cb77bf07))

## [5.9.9](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.8...5.9.9) (2026-04-09)

### Bug Fixes

* 修复以下缺陷 ([#61](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/61)) ([5795214](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/5795214fe06cbbd40daf973c4ac99db0a78ef07a))

## [5.9.8](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.7...5.9.8) (2026-04-01)

### Bug Fixes

* self-hosting ([#60](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/60)) ([3560b5d](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/3560b5d3e0b2ee51af14a429c4060ef8bd633947))

## [5.9.7](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.6...5.9.7) (2026-03-13)

### Performance Improvements

* Enhance AccountSelector to support external account tree injection and improve account selection logic ([ef9780c](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/ef9780c507853971038f370875fd10487ad578ba))

## [5.9.6](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.5...5.9.6) (2026-03-12)

### Bug Fixes

* Add inline mapping dialog and original row type definition ([fc6afdc](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/fc6afdcad8cee8b49c8da143467dbbc8e1c54207))

## [5.9.5](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.4...5.9.5) (2026-03-11)

### Bug Fixes

* Enhance ReconciliationForm with first reconciliation tag and improved timing selection ([29f1aea](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/29f1aea33213a9ed9e6dc13f392cc80d72442b91))

## [5.9.4](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.3...5.9.4) (2026-03-11)

### Bug Fixes

* translate ([#58](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/58)) ([4bb387b](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/4bb387bd265312d993cc98e5900e5047dc853695))

## [5.9.3](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.2...5.9.3) (2026-03-05)

### Bug Fixes

* Add description field to account management and templates ([#56](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/56)) ([94fc69e](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/94fc69e09f06ca1014d1a22f72731d656c775794))

## [5.9.2](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.1...5.9.2) (2026-02-06)

### Bug Fixes

* balance ([#55](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/55)) ([b3c068d](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/b3c068d1205060ce19ca73bb3785d4635fce7bec))

## [5.9.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.9.0...5.9.1) (2026-02-06)

### Bug Fixes

* balance ([#54](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/54)) ([b0f64b3](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/b0f64b3ad6f302e2d8237f46a07db3949f15f026))

## [5.9.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.8.0...5.9.0) (2026-02-06)

### Features

* Enhance reconciliation form with date selection and UI improvements ([#52](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/52)) ([8752393](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/875239390e933a7996d75bc4cf20e47c10f1686e))

## [5.8.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.7.0...5.8.0) (2026-02-04)

### Features

* 文件解析支持审核功能 ([#50](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/50)) ([5413548](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/541354806996314179fab628ccfc82c23f365353))

## [5.7.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.6.0...5.7.0) (2026-01-30)

### Features

* Automatically generate reconciliation tasks when creating a new user. ([#48](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/48)) ([f9e4e09](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/f9e4e09991126a3fb84571381248b39962509255))

## [5.6.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.5.1...5.6.0) (2026-01-28)

### Features

* 增加自动兜底账户，首次开启对账默认使用 `Equity:Opening-Balances`，后续对账默认使用 `Equity:Adjustments` ([#47](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/47)) ([89f08b8](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/89f08b8a131ddfccb682454c56c6ba80982e4545))

## [5.5.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.5.0...5.5.1) (2026-01-28)

### Bug Fixes

* 实现账户对账周期与待办管理的闭环 ([#46](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/46)) ([1b7750a](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/1b7750affef83e98fd225d20475673c601ec251a))

## [5.5.0](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.4.1...5.5.0) (2026-01-14)

### Features

* Implemented a case-insensitive custom filter method in account ([#43](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/43)) ([5febe9b](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/5febe9bed7889b7dd69717b326c71cafe503a80f))

## [5.4.1](https://github.com/dhr2333/Beancount-Trans-Frontend/compare/5.4.0...5.4.1) (2026-01-13)

### Bug Fixes

* Disable unbinding phone feature with tooltip notification in settings index.vue ([#42](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/42)) ([bef5aae](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/bef5aae429a08505b5a0c8c5118b1461ac991a59))
* Update income validation rule to make account selection optional and clean up template formatting in Income.vue ([#41](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/41)) ([20810f2](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/20810f2a61020e69156a7a86c56b369da839e88f))

## 1.0.0 (2025-11-12)

### Features

* Supports night mode ([#30](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/30)) ([394f6ad](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/394f6adb8b85171793ed76dd8e0e6fbdf8d5b574))

### Reverts

* Revert "增加LICENSE和SECURITY ([#2](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/2))" ([#3](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/3)) ([e3251fa](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/e3251fa50db716e5da7f160608bb267acfc461e5))

# Changelog

本文件由 semantic-release 自动维护，用于记录 Beancount-Trans-Backend 的版本变化。
## 1.0.0 (2025-11-11)

### Features

* Supports night mode ([#30](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/30)) ([394f6ad](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/394f6adb8b85171793ed76dd8e0e6fbdf8d5b574))

### Reverts

* Revert "增加LICENSE和SECURITY ([#2](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/2))" ([#3](https://github.com/dhr2333/Beancount-Trans-Frontend/issues/3)) ([e3251fa](https://github.com/dhr2333/Beancount-Trans-Frontend/commit/e3251fa50db716e5da7f160608bb267acfc461e5))
