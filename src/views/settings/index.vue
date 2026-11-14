<template>
    <div class="settings-container">
        <div>
            <el-card class="settings-card" shadow="hover">
                <template #header>
                    <div class="card-header">
                        <h2>个人设置</h2>
                        <el-text type="info" size="small">管理您的账户和安全设置</el-text>
                    </div>
                </template>

                <el-tabs v-model="activeTab" class="settings-tabs">
                    <!-- 账户绑定 -->
                    <el-tab-pane label="账户绑定" name="bindings">
                        <el-card shadow="never" class="section-card">
                            <template #header>
                                <h3>账户绑定</h3>
                                <!-- <el-text type="info" size="small">绑定多种登录方式，提高账户安全性</el-text> -->
                            </template>

                            <!-- 手机号绑定 -->
                            <div class="binding-item">
                                <div class="binding-info">
                                    <el-icon class="binding-icon">
                                        <Phone />
                                    </el-icon>
                                    <div class="binding-details">
                                        <div class="binding-label">手机号</div>
                                        <div class="binding-value">
                                            {{ bindings.phone_number || '未绑定' }}
                                            <el-tag v-if="bindings.phone_verified" type="success" size="small"
                                                style="margin-left: 8px">
                                                已验证
                                            </el-tag>
                                        </div>
                                    </div>
                                </div>
                                <div class="binding-actions">
                                    <el-button v-if="!bindings.phone_number" type="primary"
                                        @click="showBindPhoneDialog = true">
                                        绑定
                                    </el-button>
                                    <el-tooltip v-else content="暂不支持解绑" placement="top">
                                        <el-button type="danger" plain disabled>
                                            解绑
                                        </el-button>
                                    </el-tooltip>
                                </div>
                            </div>

                            <!-- GitHub OAuth绑定 -->
                            <div class="binding-item">
                                <div class="binding-info">
                                    <el-icon class="binding-icon">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path
                                                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                        </svg>
                                    </el-icon>
                                    <div class="binding-details">
                                        <div class="binding-label">GitHub</div>
                                        <div class="binding-value">
                                            {{ getGitHubAccount() || '未绑定' }}
                                            <el-tag v-if="getGitHubAccount()" type="success" size="small"
                                                style="margin-left: 8px">
                                                已验证
                                            </el-tag>
                                        </div>
                                    </div>
                                </div>
                                <div class="binding-actions">
                                    <el-button v-if="!getGitHubAccount()" type="primary" @click="bindGitHub">
                                        绑定
                                    </el-button>
                                    <el-button v-else type="danger" plain @click="handleUnbindSocial('github')">
                                        解绑
                                    </el-button>
                                </div>
                            </div>
                        </el-card>
                    </el-tab-pane>

                    <!-- 高级：本地账本 -->
                    <el-tab-pane label="本地账本" name="git">
                        <ledger-export-card v-if="!gitRepository" />
                        <!-- @vue-ignore -->
                        <git-setup v-if="!gitRepository" @created="onGitRepositoryCreated as any" />
                        <git-repository-component v-else :repository="gitRepository" @updated="onGitRepositoryUpdated"
                            @deleted="onGitRepositoryDeleted" />
                    </el-tab-pane>

                    <!-- 访问令牌（MCP 客户端接入） -->
                    <el-tab-pane label="访问令牌" name="tokens">
                        <el-card shadow="never" class="section-card">
                            <template #header>
                                <div class="section-header">
                                    <h3>
                                        访问令牌
                                        <el-tooltip placement="bottom-start" :show-after="100">
                                            <template #content>
                                                <div style="max-width: 280px; line-height: 1.6;">
                                                    把令牌交给他人等于把该账本的只读权限分享给他；建议为每次分享单独创建令牌，需要收回时直接删除。
                                                </div>
                                            </template>
                                            <el-icon class="token-help" tabindex="0" aria-label="访问令牌说明">
                                                <QuestionFilled />
                                            </el-icon>
                                        </el-tooltip>
                                    </h3>
                                </div>
                            </template>

                            <div v-loading="tokensLoading" class="token-panel">
                                <el-empty v-if="!tokensLoading && tokens.length === 0" description="暂无访问令牌"
                                    :image-size="72" />
                                <div v-else class="token-list">
                                    <div v-for="token in tokens" :key="token.id" class="token-card">
                                        <div class="token-card__body">
                                            <div class="token-card__head">
                                                <el-input v-if="editingTokenId === token.id" :ref="setTokenEditInput"
                                                    v-model="editingTokenName" class="token-card__edit-input"
                                                    size="small" maxlength="64" :disabled="savingTokenId === token.id"
                                                    @keyup.enter="saveTokenName(token)" @keyup.esc="cancelEditToken"
                                                    @blur="saveTokenName(token)" />
                                                <span v-else class="token-card__name">{{ token.name }}</span>
                                            </div>
                                            <div class="token-card__meta">
                                                <code class="token-card__prefix">{{ token.prefix }}…</code>
                                                <span class="token-card__sep">·</span>
                                                <el-tooltip :content="`创建于 ${formatTokenTime(token.created)}`"
                                                    placement="top" :show-after="200">
                                                    <span class="token-card__expiry"
                                                        :class="`token-card__expiry--${getTokenExpiry(token).type}`">
                                                        <el-icon v-if="getTokenExpiry(token).type === 'warning'">
                                                            <WarningFilled />
                                                        </el-icon>
                                                        {{ getTokenExpiry(token).text }}
                                                    </span>
                                                </el-tooltip>
                                                <span class="token-card__last-used">
                                                    {{ formatTokenDate(token.last_used_at, '从未使用') }}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="token-card__actions">
                                            <el-button v-if="editingTokenId !== token.id" link class="token-card__edit"
                                                title="编辑用途" aria-label="编辑用途" @click="startEditToken(token)">
                                                <el-icon>
                                                    <Edit />
                                                </el-icon>
                                            </el-button>
                                            <el-button link type="danger" class="token-card__delete" title="删除令牌"
                                                aria-label="删除令牌" @click="handleDeleteToken(token)">
                                                <el-icon>
                                                    <Delete />
                                                </el-icon>
                                            </el-button>
                                        </div>
                                    </div>
                                </div>
                                <el-button class="token-add" @click="showCreateTokenDialog = true">
                                    新建令牌
                                </el-button>
                            </div>
                        </el-card>
                    </el-tab-pane>

                    <!-- 共享账本（把他人共享的账本作为 Copilot 的额外数据来源） -->
                    <el-tab-pane label="共享账本" name="shared-ledgers">
                        <el-card shadow="never" class="section-card">
                            <template #header>
                                <div class="section-header">
                                    <h3>
                                        共享账本
                                        <el-tooltip placement="bottom-start" :show-after="100">
                                            <template #content>
                                                <div style="max-width: 280px; line-height: 1.6;">
                                                    绑定他人分享给你的账本后，Copilot 会把它与你的账本作为同一批数据来源综合分析与合计。解除绑定不会撤销对方的令牌。
                                                </div>
                                            </template>
                                            <el-icon class="token-help" tabindex="0" aria-label="共享账本说明">
                                                <QuestionFilled />
                                            </el-icon>
                                        </el-tooltip>
                                    </h3>
                                </div>
                            </template>

                            <div v-loading="sharedLedgersLoading" class="token-panel">
                                <el-empty v-if="!sharedLedgersLoading && sharedLedgers.length === 0"
                                    description="暂无共享账本" :image-size="72" />
                                <div v-else class="token-list">
                                    <div v-for="ledger in sharedLedgers" :key="ledger.id"
                                        class="token-card shared-ledger-card"
                                        :class="{ 'shared-ledger-card--unusable': !ledger.usable }">
                                        <div class="token-card__body">
                                            <div class="token-card__head">
                                                <span class="token-card__name">
                                                    {{ getSharedLedgerDisplayName(ledger) }} 的账本
                                                </span>
                                                <el-tag :type="ledger.usable ? 'success' : 'info'" size="small"
                                                    effect="light">
                                                    {{ ledger.usable ? '有效' : '已失效' }}
                                                </el-tag>
                                            </div>
                                            <div class="token-card__meta">
                                                <span>
                                                    最后使用 {{ formatTokenDate(ledger.last_used_at, '从未使用') }}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="token-card__actions">
                                            <el-button link class="token-card__edit" title="编辑别名" aria-label="编辑别名"
                                                @click="openEditSharedLedgerAliasesDialog(ledger)">
                                                <el-icon>
                                                    <Edit />
                                                </el-icon>
                                            </el-button>
                                            <el-button link type="danger" class="token-card__delete" title="解除绑定"
                                                aria-label="解除绑定" @click="handleUnbindSharedLedger(ledger)">
                                                <el-icon>
                                                    <Delete />
                                                </el-icon>
                                            </el-button>
                                        </div>
                                    </div>
                                </div>
                                <el-button class="token-add" @click="showBindSharedLedgerDialog = true">
                                    添加共享账本
                                </el-button>
                            </div>
                        </el-card>
                    </el-tab-pane>

                    <!-- 安全设置 -->
                    <el-tab-pane label="安全设置" name="security">
                        <!-- 用户名和密码 -->
                        <el-card shadow="never" class="section-card">
                            <template #header>
                                <h3>账户安全</h3>
                            </template>

                            <div class="security-item">
                                <div class="security-info">
                                    <el-icon class="security-icon">
                                        <User />
                                    </el-icon>
                                    <div class="security-details">
                                        <div class="security-label">用户名</div>
                                        <div class="security-value">{{ bindings.username }}</div>
                                    </div>
                                </div>
                                <div class="security-actions">
                                    <el-button type="default" @click="showUpdateUsernameDialog = true">
                                        修改
                                    </el-button>
                                </div>
                            </div>

                            <div class="security-item">
                                <div class="security-info">
                                    <el-icon class="security-icon">
                                        <Lock />
                                    </el-icon>
                                    <div class="security-details">
                                        <div class="security-label">密码</div>
                                        <div class="security-value">
                                            <el-text v-if="bindings.has_password" type="success">已设置</el-text>
                                            <el-text v-else type="info">未设置</el-text>
                                        </div>
                                    </div>
                                </div>
                                <div class="security-actions">
                                    <el-button :type="bindings.has_password ? 'default' : 'primary'"
                                        @click="showSetPasswordDialog = true">
                                        重置
                                    </el-button>
                                </div>
                            </div>

                            <!-- TOTP 认证 -->
                            <div class="security-item">
                                <div class="security-info">
                                    <el-icon class="security-icon">
                                        <Lock />
                                    </el-icon>
                                    <div class="security-details">
                                        <div class="security-label">
                                            <strong>TOTP 认证</strong>
                                            <!-- <el-text type="info" size="small" style="margin-left: 8px">
                                                （使用 Google Authenticator 等应用）
                                            </el-text> -->
                                        </div>
                                        <div class="security-value">
                                            <el-text v-if="twoFactorStatus.totp_enabled" type="success"
                                                size="small">已启用</el-text>
                                            <el-text v-else type="info" size="small">未启用</el-text>
                                        </div>
                                    </div>
                                </div>
                                <div class="security-actions">
                                    <el-button v-if="!twoFactorStatus.totp_enabled" type="primary"
                                        @click="handleEnableTOTP">
                                        启用
                                    </el-button>
                                    <el-button v-else type="danger" plain @click="handleDisableTOTP">
                                        禁用
                                    </el-button>
                                </div>
                            </div>
                        </el-card>

                        <!-- 危险操作 -->
                        <el-card shadow="never" class="section-card danger-card">
                            <template #header>
                                <h3>危险操作</h3>
                            </template>

                            <div class="danger-zone">
                                <div class="danger-zone__item">
                                    <div class="danger-zone__content">
                                        <div class="danger-zone__title">删除账户</div>
                                        <p>删除账户将永久删除您的所有数据，包括账单文件、账户配置、映射规则等。
                                            <strong>此操作不可恢复！</strong>
                                        </p>
                                    </div>
                                    <div class="danger-zone__actions">
                                        <el-button type="danger" plain class="danger-zone__button"
                                            @click="showDeleteAccountDialog = true">
                                            删除账户
                                        </el-button>
                                    </div>
                                </div>
                            </div>
                        </el-card>
                    </el-tab-pane>
                </el-tabs>
            </el-card>

            <!-- 新建访问令牌对话框 -->
            <el-dialog v-model="showCreateTokenDialog" title="新建访问令牌" width="480px" @closed="resetCreateTokenForm">
                <el-form ref="createTokenFormRef" :model="createTokenForm" :rules="createTokenRules" label-width="90px">
                    <el-form-item label="用途" prop="name">
                        <el-input v-model="createTokenForm.name" maxlength="64" show-word-limit
                            placeholder="例如：Claude Code" />
                    </el-form-item>
                    <el-form-item label="有效期" prop="expires_in_days">
                        <el-input-number v-model="createTokenForm.expires_in_days" :min="1" :max="3650" :step="30"
                            controls-position="right" placeholder="留空表示长期有效" style="width: 100%" />
                        <!-- <el-text type="info" size="small">留空表示长期有效，最长 3650 天</el-text> -->
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showCreateTokenDialog = false">取消</el-button>
                    <el-button type="primary" :loading="createTokenLoading" @click="handleCreateToken">
                        创建
                    </el-button>
                </template>
            </el-dialog>

            <!-- 明文令牌（仅显示一次） -->
            <el-dialog v-model="showCreatedTokenDialog" title="访问令牌已创建" width="560px" @closed="createdToken = ''">
                <!-- <el-alert type="warning" :closable="false" title="请立即复制并妥善保存" class="token-tip"> -->
                <el-alert type="warning" :closable="false" class="token-tip">
                    <template #default>
                        出于安全考虑，明文令牌<strong>仅在此处显示一次</strong>，关闭后无法再次查看。
                        请将下方令牌填入 MCP 客户端的 Authorization 请求头。
                    </template>
                </el-alert>
                <el-input v-model="createdToken" readonly class="token-plain">
                    <template #append>
                        <el-button @click="copyToken">
                            <el-icon>
                                <DocumentCopy />
                            </el-icon>
                            复制
                        </el-button>
                    </template>
                </el-input>
                <template #footer>
                    <el-button type="primary" @click="showCreatedTokenDialog = false">我已保存</el-button>
                </template>
            </el-dialog>

            <!-- 添加共享账本对话框 -->
            <el-dialog v-model="showBindSharedLedgerDialog" title="添加共享账本" width="520px"
                @closed="resetBindSharedLedgerForm">
                <!-- <el-alert type="info" :closable="false" class="shared-ledger-dialog-tip">
                    <template #default>
                        别名是 Copilot 用来识别、查找该共享账本的名称，可留空、也可填写多个；Copilot 命中其中任意一个即可识别该账本，留空时将使用来源用户名。令牌由对方在『个人设置 →
                        访问令牌』生成。
                    </template>
                </el-alert> -->
                <el-form ref="bindSharedLedgerFormRef" :model="bindSharedLedgerForm" :rules="bindSharedLedgerRules"
                    label-width="70px">
                    <el-form-item label="令牌" prop="token">
                        <el-input v-model="bindSharedLedgerForm.token" type="textarea"
                            :autosize="{ minRows: 2, maxRows: 4 }" placeholder="bct_…" />
                    </el-form-item>
                    <el-form-item label="别名" prop="aliases">
                        <el-select v-model="bindSharedLedgerForm.aliases" multiple filterable allow-create
                            default-first-option :reserve-keyword="false" class="shared-ledger-alias-select"
                            placeholder="留空时使用来源用户名" />
                        <div class="shared-ledger-alias-hint">
                            Copilot 命中其中任意一个即可识别该账本。
                        </div>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showBindSharedLedgerDialog = false">取消</el-button>
                    <el-button type="primary" :loading="bindSharedLedgerLoading" @click="handleBindSharedLedger">
                        添加
                    </el-button>
                </template>
            </el-dialog>

            <!-- 编辑共享账本别名对话框 -->
            <el-dialog v-model="showEditSharedLedgerAliasesDialog" title="编辑别名" width="520px"
                @closed="resetEditSharedLedgerAliasesForm">
                <el-form ref="editSharedLedgerAliasesFormRef" :model="editSharedLedgerAliasesForm" label-width="70px">
                    <el-form-item label="来源用户">
                        <span>{{ editSharedLedgerAliasesForm.ownerUsername }}</span>
                    </el-form-item>
                    <el-form-item label="别名" prop="aliases">
                        <el-select v-model="editSharedLedgerAliasesForm.aliases" multiple filterable allow-create
                            default-first-option :reserve-keyword="false" class="shared-ledger-alias-select"
                            placeholder="留空时使用来源用户名" />
                        <div class="shared-ledger-alias-hint">
                            Copilot 命中其中任意一个即可识别该账本。
                        </div>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showEditSharedLedgerAliasesDialog = false">取消</el-button>
                    <el-button type="primary" :loading="editSharedLedgerAliasesLoading"
                        @click="handleUpdateSharedLedgerAliases">
                        保存
                    </el-button>
                </template>
            </el-dialog>

            <!-- 绑定手机号对话框 -->
            <el-dialog v-model="showBindPhoneDialog" title="绑定手机号" width="400px">
                <el-form ref="bindPhoneFormRef" :model="bindPhoneForm" :rules="bindPhoneRules">
                    <el-form-item label="手机号" prop="phone_number">
                        <el-input v-model="bindPhoneForm.phone_number" placeholder="请输入手机号" />
                    </el-form-item>
                    <el-form-item label="验证码" prop="code">
                        <div class="code-input-group">
                            <el-input v-model="bindPhoneForm.code" placeholder="请输入验证码" maxlength="6" />
                            <el-button :disabled="!canSendCode || codeSending" :loading="codeSending"
                                @click="sendBindCode">
                                {{ codeSending ? `${countdown}s` : '发送验证码' }}
                            </el-button>
                        </div>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showBindPhoneDialog = false">取消</el-button>
                    <el-button type="primary" :loading="bindPhoneLoading" @click="handleBindPhone">确定</el-button>
                </template>
            </el-dialog>

            <!-- TOTP启用对话框 -->
            <el-dialog v-model="showTOTPDialog" title="启用TOTP双因素认证" width="500px">
                <div v-if="totpQRCode">
                    <el-text>请使用手机应用扫描以下二维码，或手动输入密钥：</el-text>
                    <div style="text-align: center; margin: 20px 0">
                        <img :src="totpQRCode" alt="TOTP QR Code" style="max-width: 300px" />
                    </div>
                    <el-form-item label="密钥（Secret）">
                        <el-input v-model="totpSecret" readonly>
                            <template #append>
                                <el-button @click="copySecret">
                                    <el-icon>
                                        <DocumentCopy />
                                    </el-icon>
                                    复制
                                </el-button>
                            </template>
                        </el-input>
                        <el-text type="info" size="small">如果无法扫描二维码，请手动输入此密钥</el-text>
                    </el-form-item>
                    <el-form ref="totpFormRef" :model="totpForm" :rules="totpRules">
                        <el-form-item label="验证码" prop="code">
                            <el-input v-model="totpForm.code" placeholder="请输入6位验证码" maxlength="6" />
                        </el-form-item>
                    </el-form>
                </div>
                <template #footer>
                    <el-button @click="showTOTPDialog = false">取消</el-button>
                    <el-button type="primary" :loading="totpLoading" @click="handleConfirmTOTP">确认启用</el-button>
                </template>
            </el-dialog>

            <!-- 禁用TOTP对话框 -->
            <el-dialog v-model="showDisableTOTPDialog" title="禁用TOTP双因素认证" width="400px">
                <el-form ref="disableTOTPFormRef" :model="disableTOTPForm" :rules="disableTOTPRules">
                    <el-form-item label="验证码" prop="code">
                        <el-input v-model="disableTOTPForm.code" placeholder="请输入6位验证码确认" maxlength="6" />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showDisableTOTPDialog = false">取消</el-button>
                    <el-button type="danger" :loading="disableTOTPLoading"
                        @click="handleConfirmDisableTOTP">确认禁用</el-button>
                </template>
            </el-dialog>

            <!-- 设置密码对话框 -->
            <el-dialog v-model="showSetPasswordDialog" title="设置密码" width="400px">
                <el-form ref="setPasswordFormRef" :model="setPasswordForm" :rules="setPasswordRules">
                    <el-form-item label="新密码" prop="new_password">
                        <el-input v-model="setPasswordForm.new_password" type="password" show-password />
                    </el-form-item>
                    <el-form-item label="确认密码" prop="confirm_password">
                        <el-input v-model="setPasswordForm.confirm_password" type="password" show-password />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showSetPasswordDialog = false">取消</el-button>
                    <el-button type="primary" :loading="setPasswordLoading" @click="handleSetPassword">确定</el-button>
                </template>
            </el-dialog>

            <!-- 修改用户名对话框 -->
            <el-dialog v-model="showUpdateUsernameDialog" title="修改用户名" width="400px">
                <el-form ref="updateUsernameFormRef" :model="updateUsernameForm" :rules="updateUsernameRules">
                    <el-form-item label="新用户名" prop="username">
                        <el-input v-model="updateUsernameForm.username" />
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="showUpdateUsernameDialog = false">取消</el-button>
                    <el-button type="primary" :loading="updateUsernameLoading"
                        @click="handleUpdateUsername">确定</el-button>
                </template>
            </el-dialog>

            <!-- 删除账户对话框 -->
            <el-dialog v-model="showDeleteAccountDialog" title="删除账户" width="500px" @open="onOpenDeleteAccountDialog"
                @closed="resetDeleteAccountDialog">
                <el-alert title="警告" type="error" :closable="false" style="margin-bottom: 20px">
                    <template #default>
                        <p>此操作将永久删除您的账户和所有相关数据，包括：</p>
                        <ul class="danger-list">
                            <li>所有已上传的账单文件</li>
                            <li>Git 远程仓库</li>
                            <li>所有平台配置（映射、账户等）</li>
                        </ul>
                        <p><strong>此操作不可恢复！</strong></p>
                        <el-text type="warning" size="small">建议在删除前导出或备份重要数据。</el-text>
                    </template>
                </el-alert>
                <el-form ref="deleteAccountFormRef" :model="deleteAccountForm" :rules="deleteAccountRules">
                    <el-form-item label="确认操作" prop="confirm">
                        <el-input v-model="deleteAccountForm.confirm" placeholder="请输入 'DELETE' 确认删除" />
                    </el-form-item>
                    <el-form-item>
                        <el-checkbox v-model="deleteAccountConfirmChecked">
                            我已了解上述信息，并确认删除后所有数据将立即清空且无法恢复
                        </el-checkbox>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <el-button @click="handleCancelDeleteAccount">取消</el-button>
                    <el-button type="danger" :disabled="!canSubmitDeleteAccount" :loading="deleteAccountLoading"
                        @click="handleDeleteAccount">
                        删除账户
                    </el-button>
                </template>
            </el-dialog>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules, InputInstance } from 'element-plus'
import { User, Phone, Lock, DocumentCopy } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import router from '~/routers'
import { useRoute } from 'vue-router'
import { getGitRepository } from '../../api/git'
import type { GitRepository } from '../../types/git'
import {
    listPersonalAccessTokens,
    createPersonalAccessToken,
    updatePersonalAccessToken,
    deletePersonalAccessToken
} from '../../api/token'
import type { PersonalAccessToken, CreateTokenRequest } from '../../types/token'
import {
    listSharedLedgers,
    bindSharedLedger,
    unbindSharedLedger,
    updateSharedLedgerAliases
} from '../../api/assistant'
import type {
    SharedLedgerBinding,
    BindSharedLedgerRequest,
    UpdateSharedLedgerAliasesRequest
} from '../../types/assistant'
import { copyText } from '../../utils/clipboard'
import GitSetup from '../../components/git/GitSetup.vue'
import GitRepositoryComponent from '../../components/git/GitRepository.vue'
import LedgerExportCard from '../../components/ledger/LedgerExportCard.vue'

const unauthorizedNotified = ref(false)

// Git 仓库状态
const gitRepository = ref<GitRepository | null>(null)

// 访问令牌状态
const tokens = ref<PersonalAccessToken[]>([])
const tokensLoading = ref(false)
const editingTokenId = ref<number | null>(null)
const editingTokenName = ref('')
const savingTokenId = ref<number | null>(null)
const tokenEditInput = ref<InputInstance | null>(null)
const setTokenEditInput = (el: unknown) => {
    if (el) tokenEditInput.value = el as InputInstance
}
const showCreateTokenDialog = ref(false)
const showCreatedTokenDialog = ref(false)
const createTokenLoading = ref(false)
const createTokenFormRef = ref<FormInstance>()
const createTokenForm = reactive({
    name: '',
    expires_in_days: undefined as number | undefined
})
const createTokenRules: FormRules = {
    name: [
        { required: true, message: '请输入用途说明', trigger: 'blur' },
        { max: 64, message: '用途说明不能超过 64 个字符', trigger: 'blur' }
    ]
}
// 明文令牌仅在创建响应中返回一次，关闭对话框即清空
const createdToken = ref('')

// 共享账本状态
const sharedLedgers = ref<SharedLedgerBinding[]>([])
const sharedLedgersLoading = ref(false)
const showBindSharedLedgerDialog = ref(false)
const bindSharedLedgerLoading = ref(false)
const bindSharedLedgerFormRef = ref<FormInstance>()
const bindSharedLedgerForm = reactive({
    token: '',
    aliases: [] as string[]
})
const bindSharedLedgerRules: FormRules = {
    token: [{ required: true, message: '请输入对方的访问令牌', trigger: 'blur' }]
}

// 编辑共享账本别名状态
const showEditSharedLedgerAliasesDialog = ref(false)
const editSharedLedgerAliasesLoading = ref(false)
const editSharedLedgerAliasesFormRef = ref<FormInstance>()
const editSharedLedgerAliasesForm = reactive({
    id: 0,
    ownerUsername: '',
    aliases: [] as string[]
})

const handleUnauthorized = () => {
    if (!unauthorizedNotified.value) {
        ElMessage.info('未认证，请登录后重试')
        unauthorizedNotified.value = true
    }
}

const route = useRoute()
const activeTab = ref(route.query.tab === 'git' ? 'git' : 'bindings')
const showBindPhoneDialog = ref(false)
const showSetPasswordDialog = ref(false)
const showTOTPDialog = ref(false)
const showDisableTOTPDialog = ref(false)
const showUpdateUsernameDialog = ref(false)
const showDeleteAccountDialog = ref(false)

const defaultConfirmOptions = {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning' as const,
    center: false,
    customClass: 'settings-confirm-dialog',
    confirmButtonClass: 'settings-confirm-primary',
    cancelButtonClass: 'settings-confirm-cancel'
}

const bindings = ref<any>({
    username: '',
    phone_number: null,
    phone_verified: false,
    social_accounts: [],
    has_password: false
})

const twoFactorStatus = ref({
    totp_enabled: false,
    has_2fa: false
})

const bindPhoneFormRef = ref<FormInstance>()
const totpFormRef = ref<FormInstance>()
const disableTOTPFormRef = ref<FormInstance>()
const setPasswordFormRef = ref<FormInstance>()
const updateUsernameFormRef = ref<FormInstance>()
const deleteAccountFormRef = ref<FormInstance>()

const bindPhoneForm = reactive({
    phone_number: '',
    code: ''
})

const totpForm = reactive({
    code: ''
})

const disableTOTPForm = reactive({
    code: ''
})

const setPasswordForm = reactive({
    new_password: '',
    confirm_password: ''
})

const updateUsernameForm = reactive({
    username: ''
})

const deleteAccountForm = reactive({
    confirm: ''
})

const deleteAccountConfirmChecked = ref(false)

const totpQRCode = ref('')
const totpSecret = ref('')
const codeSending = ref(false)
const countdown = ref(60)
let countdownTimer: number | null = null

const bindPhoneLoading = ref(false)
const totpLoading = ref(false)
const disableTOTPLoading = ref(false)
const setPasswordLoading = ref(false)
const updateUsernameLoading = ref(false)
const deleteAccountLoading = ref(false)

const bindPhoneRules: FormRules = {
    phone_number: [
        { required: true, message: '请输入手机号', trigger: 'blur' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
    ],
    code: [
        { required: true, message: '请输入验证码', trigger: 'blur' },
        { pattern: /^\d{6}$/, message: '验证码为6位数字', trigger: 'blur' }
    ]
}

const updateUsernameRules: FormRules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 150, message: '用户名长度为3-150个字符', trigger: 'blur' },
        { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
    ]
}

const deleteAccountRules: FormRules = {
    confirm: [
        { required: true, message: '请输入确认信息', trigger: 'blur' },
        {
            validator: (rule, value, callback) => {
                if (value !== 'DELETE') {
                    callback(new Error("请输入 'DELETE' 确认删除"))
                } else {
                    callback()
                }
            },
            trigger: 'blur'
        }
    ]
}

const totpRules: FormRules = {
    code: [
        { required: true, message: '请输入验证码', trigger: 'blur' },
        { pattern: /^\d{6}$/, message: '验证码为6位数字', trigger: 'blur' }
    ]
}

const disableTOTPRules: FormRules = {
    code: [
        { required: true, message: '请输入验证码', trigger: 'blur' },
        { pattern: /^\d{6}$/, message: '验证码为6位数字', trigger: 'blur' }
    ]
}

const setPasswordRules: FormRules = {
    new_password: [
        { required: true, message: '请输入新密码', trigger: 'blur' },
        { min: 8, message: '密码长度至少8个字符', trigger: 'blur' }
    ],
    confirm_password: [
        { required: true, message: '请确认密码', trigger: 'blur' },
        {
            validator: (rule, value, callback) => {
                if (value !== setPasswordForm.new_password) {
                    callback(new Error('两次输入的密码不一致'))
                } else {
                    callback()
                }
            },
            trigger: 'blur'
        }
    ]
}

const canSendCode = computed(() => {
    return bindPhoneForm.phone_number.length === 11
})

const canSubmitDeleteAccount = computed(() => {
    return (
        deleteAccountForm.confirm.trim() === 'DELETE' &&
        deleteAccountConfirmChecked.value &&
        !deleteAccountLoading.value
    )
})

// 手机号格式化
const normalizePhone = (phone: string): string => {
    const trimmed = phone.trim()
    if (trimmed.startsWith('+')) return trimmed
    if (trimmed.startsWith('86')) return '+' + trimmed
    return '+86' + trimmed
}

// 开始倒计时
const startCountdown = () => {
    codeSending.value = true
    countdown.value = 60
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = window.setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
            codeSending.value = false
            if (countdownTimer) clearInterval(countdownTimer)
        }
    }, 1000)
}

// 获取绑定信息
const fetchBindings = async () => {
    try {
        const res = await axios.get('/auth/bindings/')
        bindings.value = res.data
        // 初始化表单
        updateUsernameForm.username = res.data.username || ''
    } catch (error: any) {
        if (error?.response?.status === 401) {
            handleUnauthorized()
        } else {
            ElMessage.error('获取绑定信息失败')
        }
    }
}

// 获取2FA状态
const fetch2FAStatus = async () => {
    try {
        const res = await axios.get('/auth/2fa/status/')
        twoFactorStatus.value = res.data
    } catch (error: any) {
        if (error?.response?.status === 401) {
            handleUnauthorized()
        } else {
            ElMessage.error('获取2FA状态失败')
        }
    }
}

// 获取GitHub账号
const getGitHubAccount = () => {
    const githubAccount = bindings.value.social_accounts?.find((acc: any) => acc.provider === 'github')
    return githubAccount ? githubAccount.uid : null
}

// 发送绑定手机号验证码
const sendBindCode = async () => {
    if (!bindPhoneFormRef.value) return
    await bindPhoneFormRef.value.validateField('phone_number')

    try {
        const resp = await axios.post('/auth/phone/send-code/', {
            phone_number: normalizePhone(bindPhoneForm.phone_number)
        })
        if (resp.status === 200) {
            ElMessage.success('验证码已发送')
            startCountdown()
        }
    } catch (e: any) {
        ElMessage.error(e?.response?.data?.error || '发送失败')
    }
}

// 绑定手机号
const handleBindPhone = async () => {
    if (!bindPhoneFormRef.value) return
    await bindPhoneFormRef.value.validate()

    bindPhoneLoading.value = true
    try {
        await axios.post('/auth/bindings/bind-phone/', {
            phone_number: normalizePhone(bindPhoneForm.phone_number),
            code: bindPhoneForm.code
        })
        ElMessage.success('手机号绑定成功')
        showBindPhoneDialog.value = false
        Object.assign(bindPhoneForm, { phone_number: '', code: '' })
        await fetchBindings()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '绑定失败')
    } finally {
        bindPhoneLoading.value = false
    }
}

// 解绑手机号
const handleUnbindPhone = async () => {
    try {
        await ElMessageBox.confirm('确定要解绑手机号吗？', '提示', {
            ...defaultConfirmOptions
        })
        await axios.delete('/auth/bindings/unbind-phone/')
        ElMessage.success('手机号解绑成功')
        await fetchBindings()
    } catch (error: any) {
        if (error !== 'cancel') {
            ElMessage.error(error.response?.data?.error || '解绑失败')
        }
    }
}

// 解绑社交账号
const handleUnbindSocial = async (provider: string) => {
    try {
        await ElMessageBox.confirm(`确定要解绑${provider === 'github' ? 'GitHub' : provider}吗？`, '提示', {
            ...defaultConfirmOptions
        })
        await axios.delete(`/auth/bindings/unbind-social/${provider}/`)
        ElMessage.success('解绑成功')
        await fetchBindings()
    } catch (error: any) {
        if (error !== 'cancel') {
            ElMessage.error(error.response?.data?.error || '解绑失败')
        }
    }
}

// 绑定GitHub
const bindGitHub = () => {
    const providerId = 'github'
    const callbackURL = window.location.origin + '/auth/github/token'

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/api/_allauth/browser/v1/auth/provider/redirect'
    form.style.display = 'none'

    const providerInput = document.createElement('input')
    providerInput.type = 'hidden'
    providerInput.name = 'provider'
    providerInput.value = providerId
    form.appendChild(providerInput)

    const callbackInput = document.createElement('input')
    callbackInput.type = 'hidden'
    callbackInput.name = 'callback_url'
    callbackInput.value = callbackURL
    form.appendChild(callbackInput)

    const processInput = document.createElement('input')
    processInput.type = 'hidden'
    processInput.name = 'process'
    processInput.value = 'connect'
    form.appendChild(processInput)

    document.body.appendChild(form)
    form.submit()
}

// 修改用户名
const handleUpdateUsername = async () => {
    if (!updateUsernameFormRef.value) return
    await updateUsernameFormRef.value.validate()

    updateUsernameLoading.value = true
    try {
        const newUsername = updateUsernameForm.username
        await axios.patch('/auth/profile/update_me/', {
            username: newUsername
        })
        ElMessage.success('用户名修改成功')
        showUpdateUsernameDialog.value = false
        await fetchBindings()
        // 更新本地存储的用户名
        localStorage.setItem('username', newUsername)
        Object.assign(updateUsernameForm, { username: '' })
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '修改失败')
    } finally {
        updateUsernameLoading.value = false
    }
}

// 设置密码
const handleSetPassword = async () => {
    if (!setPasswordFormRef.value) return
    await setPasswordFormRef.value.validate()

    setPasswordLoading.value = true
    try {
        await axios.post('/auth/profile/set_password/', {
            new_password: setPasswordForm.new_password
        })
        ElMessage.success('密码设置成功')
        showSetPasswordDialog.value = false
        Object.assign(setPasswordForm, { new_password: '', confirm_password: '' })
        await fetchBindings()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '设置失败')
    } finally {
        setPasswordLoading.value = false
    }
}

// 删除账户
const handleDeleteAccount = async () => {
    if (!deleteAccountFormRef.value) return
    await deleteAccountFormRef.value.validate()

    try {
        await ElMessageBox.confirm('确定要删除账户吗？此操作不可恢复！', '最终确认', {
            ...defaultConfirmOptions,
            confirmButtonText: '确定删除',
            type: 'error',
            confirmButtonClass: 'settings-confirm-danger'
        })

        deleteAccountLoading.value = true
        try {
            await axios.delete('/auth/profile/delete_account/')
            ElMessage.success('账户已删除')
            // 清除本地存储
            localStorage.clear()
            sessionStorage.clear()
            // 跳转到登录页面
            showDeleteAccountDialog.value = false
            router.push('/login')
            resetDeleteAccountDialog()
        } catch (error: any) {
            ElMessage.error(error.response?.data?.error || '删除失败')
        } finally {
            deleteAccountLoading.value = false
        }
    } catch (error: any) {
        if (error !== 'cancel') {
            ElMessage.error('操作已取消')
        }
    }
}

const resetDeleteAccountDialog = () => {
    deleteAccountForm.confirm = ''
    deleteAccountConfirmChecked.value = false
}

const onOpenDeleteAccountDialog = () => {
    resetDeleteAccountDialog()
}

const handleCancelDeleteAccount = () => {
    resetDeleteAccountDialog()
    showDeleteAccountDialog.value = false
}

// 启用TOTP
const handleEnableTOTP = async () => {
    try {
        const res = await axios.get('/auth/2fa/totp/qrcode/')
        totpQRCode.value = res.data.qr_code
        totpSecret.value = res.data.secret
        showTOTPDialog.value = true
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '获取二维码失败')
    }
}

// 复制Secret密钥
const copySecret = async () => {
    try {
        await navigator.clipboard.writeText(totpSecret.value)
        ElMessage.success('密钥已复制到剪贴板')
    } catch (error) {
        ElMessage.error('复制失败，请手动复制')
    }
}

// 确认启用TOTP
const handleConfirmTOTP = async () => {
    if (!totpFormRef.value) return
    await totpFormRef.value.validate()

    totpLoading.value = true
    try {
        await axios.post('/auth/2fa/totp/enable/', {
            code: totpForm.code
        })
        ElMessage.success('TOTP已启用')
        showTOTPDialog.value = false
        Object.assign(totpForm, { code: '' })
        totpQRCode.value = ''
        totpSecret.value = ''
        await fetch2FAStatus()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '启用失败')
    } finally {
        totpLoading.value = false
    }
}

// 禁用TOTP
const handleDisableTOTP = () => {
    showDisableTOTPDialog.value = true
}

// 确认禁用TOTP
const handleConfirmDisableTOTP = async () => {
    if (!disableTOTPFormRef.value) return
    await disableTOTPFormRef.value.validate()

    disableTOTPLoading.value = true
    try {
        await axios.post('/auth/2fa/totp/disable/', {
            code: disableTOTPForm.code
        })
        ElMessage.success('TOTP已禁用')
        showDisableTOTPDialog.value = false
        Object.assign(disableTOTPForm, { code: '' })
        await fetch2FAStatus()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '禁用失败')
    } finally {
        disableTOTPLoading.value = false
    }
}

// Git 仓库相关（webhook_secret 仅关联/创建接口首次返回，GET 通常不含；同一会话内合并保留便于展示）
const mergeGitRepositoryPreservingSecret = (
    next: GitRepository,
    prev: GitRepository | null
): GitRepository => {
    if (
        prev &&
        prev.id === next.id &&
        next.webhook_secret == null &&
        prev.webhook_secret != null &&
        prev.webhook_secret !== ''
    ) {
        return { ...next, webhook_secret: prev.webhook_secret }
    }
    return next
}

const fetchGitRepository = async () => {
    try {
        const prev = gitRepository.value
        const data = await getGitRepository()
        gitRepository.value = mergeGitRepositoryPreservingSecret(data, prev)
    } catch (error: any) {
        // 404 表示未启用 Git，这是正常的
        if (error.response?.status !== 404) {
            console.error('Failed to fetch git repository:', error)
        }
        gitRepository.value = null
    }
}

const onGitRepositoryCreated = (repository: GitRepository) => {
    gitRepository.value = repository
    // 切换到Git tab以显示新创建的仓库
    activeTab.value = 'git'
}

const onGitRepositoryUpdated = (repository: GitRepository) => {
    gitRepository.value = mergeGitRepositoryPreservingSecret(
        repository,
        gitRepository.value
    )
}

const onGitRepositoryDeleted = () => {
    gitRepository.value = null
}

// 访问令牌相关
const fetchTokens = async () => {
    tokensLoading.value = true
    try {
        tokens.value = await listPersonalAccessTokens()
    } catch (error: any) {
        if (error?.response?.status === 401) {
            handleUnauthorized()
        } else {
            ElMessage.error('获取访问令牌失败')
        }
    } finally {
        tokensLoading.value = false
    }
}

const formatTokenTime = (value: string | null, fallback = '—') => {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return date.toLocaleString('zh-CN', { hour12: false })
}

const formatTokenDate = (value: string | null, fallback = '—') => {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return date.toLocaleDateString('zh-CN')
}

const getTokenExpiry = (token: PersonalAccessToken) => {
    if (token.revoked_at) {
        return { text: '已撤销', type: 'info' as const }
    }
    if (!token.expires_at) {
        return { text: '长期有效', type: 'warning' as const }
    }
    if (new Date(token.expires_at).getTime() <= Date.now()) {
        return { text: `已于 ${formatTokenDate(token.expires_at)} 过期`, type: 'danger' as const }
    }
    return { text: `到期 ${formatTokenDate(token.expires_at)}`, type: 'default' as const }
}

const startEditToken = (token: PersonalAccessToken) => {
    editingTokenId.value = token.id
    editingTokenName.value = token.name
    nextTick(() => tokenEditInput.value?.focus())
}

const cancelEditToken = () => {
    editingTokenId.value = null
    editingTokenName.value = ''
}

const saveTokenName = async (token: PersonalAccessToken) => {
    if (editingTokenId.value !== token.id || savingTokenId.value === token.id) return
    const name = editingTokenName.value.trim()
    if (!name) {
        ElMessage.warning('用途不能为空')
        cancelEditToken()
        return
    }
    if (name === token.name) {
        cancelEditToken()
        return
    }
    savingTokenId.value = token.id
    try {
        const updated = await updatePersonalAccessToken(token.id, { name })
        tokens.value = tokens.value.map((item) => (item.id === updated.id ? updated : item))
        ElMessage.success('用途已更新')
        if (editingTokenId.value === token.id) cancelEditToken()
    } catch (error: any) {
        const detail = error.response?.data?.name?.[0] || error.response?.data?.detail
        ElMessage.error(detail || '更新用途失败')
    } finally {
        savingTokenId.value = null
    }
}

const resetCreateTokenForm = () => {
    createTokenFormRef.value?.resetFields()
}

const handleCreateToken = async () => {
    if (!createTokenFormRef.value) return
    await createTokenFormRef.value.validate()

    createTokenLoading.value = true
    try {
        const payload: CreateTokenRequest = { name: createTokenForm.name.trim() }
        if (typeof createTokenForm.expires_in_days === 'number') {
            payload.expires_in_days = createTokenForm.expires_in_days
        }
        const created = await createPersonalAccessToken(payload)
        createdToken.value = created.token
        showCreateTokenDialog.value = false
        showCreatedTokenDialog.value = true
        ElMessage.success('访问令牌已创建')
        await fetchTokens()
    } catch (error: any) {
        const detail = error.response?.data?.name?.[0] || error.response?.data?.detail
        ElMessage.error(detail || '创建访问令牌失败')
    } finally {
        createTokenLoading.value = false
    }
}

const copyToken = async () => {
    try {
        await copyText(createdToken.value)
        ElMessage.success('令牌已复制到剪贴板')
    } catch {
        ElMessage.error('复制失败，请手动复制')
    }
}

const handleDeleteToken = async (token: PersonalAccessToken) => {
    try {
        await ElMessageBox.confirm(
            `删除后，使用「${token.name}」的 MCP 客户端将立即失去访问权限，此操作不可恢复。`,
            '删除访问令牌',
            {
                ...defaultConfirmOptions,
                confirmButtonClass: 'settings-confirm-danger'
            }
        )
    } catch {
        return
    }

    try {
        await deletePersonalAccessToken(token.id)
        ElMessage.success('访问令牌已删除')
        await fetchTokens()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.detail || '删除访问令牌失败')
    }
}

// 共享账本相关
const fetchSharedLedgers = async () => {
    sharedLedgersLoading.value = true
    try {
        const { data } = await listSharedLedgers()
        sharedLedgers.value = data
    } catch (error: any) {
        if (error?.response?.status === 401) {
            handleUnauthorized()
        } else {
            ElMessage.error('获取共享账本失败')
        }
    } finally {
        sharedLedgersLoading.value = false
    }
}

const getSharedLedgerDisplayName = (binding: SharedLedgerBinding) => {
    return [binding.owner_username, ...(binding.aliases ?? [])].filter(Boolean).join('、')
}

const resetBindSharedLedgerForm = () => {
    bindSharedLedgerFormRef.value?.resetFields()
    bindSharedLedgerForm.aliases = []
}

/**
 * 归一化别名输入：去首尾空白、丢弃空项、按不区分大小写去重。
 * 任一项超过 64 个字符时提示并返回 null，调用方据此中止提交。
 */
const normalizeSharedLedgerAliases = (raw: string[]): string[] | null => {
    const normalized: string[] = []
    const seen = new Set<string>()
    for (const item of raw) {
        const value = item.trim()
        if (!value) continue
        if (value.length > 64) {
            ElMessage.warning('别名不能超过 64 个字符')
            return null
        }
        const key = value.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        normalized.push(value)
    }
    return normalized
}

const handleBindSharedLedger = async () => {
    if (!bindSharedLedgerFormRef.value) return
    await bindSharedLedgerFormRef.value.validate()

    const normalized = normalizeSharedLedgerAliases(bindSharedLedgerForm.aliases)
    if (!normalized) return

    bindSharedLedgerLoading.value = true
    try {
        const payload: BindSharedLedgerRequest = {
            token: bindSharedLedgerForm.token.trim(),
            aliases: normalized
        }
        await bindSharedLedger(payload)
        ElMessage.success('共享账本已添加')
        showBindSharedLedgerDialog.value = false
        await fetchSharedLedgers()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.detail || '添加共享账本失败')
    } finally {
        bindSharedLedgerLoading.value = false
    }
}

const openEditSharedLedgerAliasesDialog = (binding: SharedLedgerBinding) => {
    editSharedLedgerAliasesForm.id = binding.id
    editSharedLedgerAliasesForm.ownerUsername = binding.owner_username
    editSharedLedgerAliasesForm.aliases = [...binding.aliases]
    showEditSharedLedgerAliasesDialog.value = true
}

const resetEditSharedLedgerAliasesForm = () => {
    editSharedLedgerAliasesFormRef.value?.resetFields()
    editSharedLedgerAliasesForm.id = 0
    editSharedLedgerAliasesForm.ownerUsername = ''
    editSharedLedgerAliasesForm.aliases = []
}

const handleUpdateSharedLedgerAliases = async () => {
    const normalized = normalizeSharedLedgerAliases(editSharedLedgerAliasesForm.aliases)
    if (!normalized) return

    editSharedLedgerAliasesLoading.value = true
    try {
        const payload: UpdateSharedLedgerAliasesRequest = { aliases: normalized }
        await updateSharedLedgerAliases(editSharedLedgerAliasesForm.id, payload)
        ElMessage.success('别名已更新')
        showEditSharedLedgerAliasesDialog.value = false
        await fetchSharedLedgers()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.detail || '更新别名失败')
    } finally {
        editSharedLedgerAliasesLoading.value = false
    }
}

const handleUnbindSharedLedger = async (binding: SharedLedgerBinding) => {
    try {
        await ElMessageBox.confirm(
            '解除绑定只会移除你这里的共享账本，不会撤销对方的令牌。确定解除吗？',
            '解除绑定',
            {
                ...defaultConfirmOptions,
                confirmButtonClass: 'settings-confirm-danger'
            }
        )
    } catch {
        return
    }

    try {
        await unbindSharedLedger(binding.id)
        ElMessage.success('已解除绑定')
        await fetchSharedLedgers()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.detail || '解除绑定失败')
    }
}

// 共享账本列表按需加载：仅在切换到该标签页时拉取
watch(activeTab, (tab) => {
    if (tab === 'shared-ledgers') {
        fetchSharedLedgers()
    }
})

onMounted(() => {
    fetchBindings()
    fetch2FAStatus()
    fetchGitRepository()
    fetchTokens()
})
</script>

<style scoped>
.settings-container {
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
    background: var(--el-bg-color);
    border-radius: 16px;
}

.settings-card {
    border-radius: 12px;
}

.card-header {
    text-align: center;
}

.card-header h2 {
    margin: 0 0 8px 0;
    color: var(--el-text-color-primary);
    font-size: 24px;
}

.settings-tabs {
    margin-top: 20px;
}

.section-card {
    margin-top: 20px;
}

.danger-card {
    border: 1px solid var(--el-border-color);
    padding: 0;
    background: var(--el-fill-color-light);
}

.danger-zone {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
}

.danger-zone__item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border: 1px solid var(--el-color-danger-light-7);
    background: var(--el-color-danger-light-9);
    border-radius: 8px;
    padding: 20px 24px;
    gap: 24px;
}

.danger-zone__content {
    flex: 1;
    color: var(--el-text-color-regular);
    line-height: 1.6;
}

.danger-zone__title {
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 6px;
    font-size: 16px;
}

.danger-zone__content p {
    margin: 0;
}

.danger-zone__content p strong {
    color: var(--el-color-danger);
}

.danger-zone__actions {
    display: flex;
    align-items: center;
}

.danger-zone__button {
    border-color: var(--el-color-danger);
    color: var(--el-color-danger);
    font-weight: 600;
    padding: 10px 20px;
}

.danger-zone__button:hover,
.danger-zone__button:focus {
    background: var(--el-color-danger-light-7);
    color: var(--el-color-danger);
    border-color: var(--el-color-danger);
}

.binding-item,
.security-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color);
}

.binding-item:last-child,
.security-item:last-child {
    border-bottom: none;
}

.binding-info,
.security-info {
    display: flex;
    align-items: center;
    flex: 1;
}

.binding-icon,
.security-icon {
    font-size: 24px;
    margin-right: 12px;
    color: var(--el-color-primary);
}

.binding-details,
.security-details {
    flex: 1;
}

.binding-label,
.security-label {
    font-weight: 500;
    margin-bottom: 4px;
}

.binding-value,
.security-value {
    color: var(--el-text-color-regular);
    font-size: 14px;
}

.binding-actions,
.security-actions {
    margin-left: 16px;
}

.code-input-group {
    display: flex;
    gap: 8px;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.section-header h3 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
}

.token-help {
    font-size: 15px;
    color: var(--el-text-color-placeholder);
    cursor: default;
    transition: color 0.2s;
}

.token-help:hover,
.token-help:focus-visible {
    color: var(--el-color-primary);
}

.token-tip {
    margin-bottom: 16px;
}

.shared-ledger-dialog-tip {
    margin-bottom: 16px;
}

.shared-ledger-alias-select {
    width: 100%;
}

.shared-ledger-alias-hint {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
}

/* 共享账本卡片：沿用访问令牌卡片的视觉与交互 */
.shared-ledger-card--unusable {
    opacity: 0.72;
}

.token-panel {
    min-height: 120px;
    text-align: left;
}

.token-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.token-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-fill-color-blank);
    text-align: left;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.token-card:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.token-card__body {
    flex: 1;
    min-width: 0;
}

.token-card__head {
    display: flex;
    align-items: center;
    min-width: 0;
}

.token-card__name {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.token-card__last-used {
    margin-left: auto;
    padding-left: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
}

.token-card__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.token-card__edit {
    padding: 2px;
    opacity: 0.6;
    transition: opacity 0.2s;
}

.token-card__edit:hover {
    opacity: 1;
}

.token-card__edit-input {
    flex: 1;
    min-width: 0;
}

.token-card__delete {
    padding: 2px;
    opacity: 0.6;
    transition: opacity 0.2s;
}

.token-card__delete:hover {
    opacity: 1;
}

.token-card__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.token-card__prefix {
    font-family: monospace;
    color: var(--el-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.token-card__sep {
    flex-shrink: 0;
    color: var(--el-text-color-placeholder);
}

.token-card__expiry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}

.token-card__expiry--default {
    color: var(--el-text-color-secondary);
}

.token-card__expiry--warning {
    color: var(--el-color-warning);
}

.token-card__expiry--danger {
    color: var(--el-color-danger);
}

.token-card__expiry--info {
    color: var(--el-text-color-placeholder);
}

.token-add {
    display: inline-flex;
    margin-top: 12px;
}

@media (max-width: 768px) {
    .token-card__meta {
        flex-wrap: wrap;
    }

    .token-card__last-used {
        margin-left: 0;
        padding-left: 0;
    }
}

.token-plain {
    margin-top: 16px;
}

.code-input-group :deep(.el-input) {
    flex: 1;
}

:deep(.el-tabs__item) {
    font-size: 16px;
}

:deep(.el-form-item) {
    margin-bottom: 20px;
}

.auth-required-result {
    margin: 80px auto 0;
    max-width: 420px;
}

:global(.settings-confirm-dialog) {
    border-radius: 12px;
    padding: 20px 24px 24px;
    max-width: 420px;
}

:global(.settings-confirm-dialog .el-message-box__header) {
    justify-content: flex-start;
    padding-bottom: 12px;
}

:global(.settings-confirm-dialog .el-message-box__title) {
    font-weight: 600;
    font-size: 18px;
    color: var(--el-text-color-primary);
}

:global(.settings-confirm-dialog .el-message-box__content) {
    color: var(--el-text-color-regular);
    line-height: 1.6;
    text-align: left;
    padding: 12px 0 0;
}

:global(.settings-confirm-dialog .el-message-box__btns) {
    justify-content: flex-end;
    gap: 12px;
    padding-top: 24px;
}

:global(.settings-confirm-primary) {
    background-color: var(--el-color-success);
    border-color: var(--el-color-success);
    border-radius: 6px;
    min-width: 96px;
    font-weight: 600;
}

:global(.settings-confirm-primary:hover) {
    filter: brightness(0.95);
}

:global(.settings-confirm-cancel) {
    border-radius: 6px;
    min-width: 96px;
}

:global(.settings-confirm-danger) {
    background-color: var(--el-color-danger);
    border-color: var(--el-color-danger);
    border-radius: 6px;
    min-width: 110px;
    font-weight: 600;
}

:global(.settings-confirm-danger:hover) {
    filter: brightness(0.92);
}

.danger-list {
    text-align: left;
    padding-left: 24px;
    margin: 12px 0;
    list-style-type: disc;
}

.danger-list li {
    margin-bottom: 8px;
    line-height: 1.5;
}

.danger-list li:last-child {
    margin-bottom: 0;
}
</style>