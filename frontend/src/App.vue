<template>
  <!-- 页面最外层容器，限制最大宽度并居中 -->
  <main class="app-shell">

    <!--
      顶部状态栏组件
      board-count     → 留言总数
      wallet-label    → 钱包状态文字（"已连接" / "未连接" 等）
      network-label   → 当前网络名称（"Hardhat Local"）
      account-label   → 缩短后的钱包地址（"0x1234...5678"）
      connect-label   → 连接按钮文字（"连接钱包" / "切换网络" 等）
      connect-disabled → 正在操作中 或 已连接且网络正确时禁用按钮
      @connect        → 点击连接按钮，触发连接/切换网络逻辑
      @refresh        → 点击刷新按钮，重新从链上读取留言
    -->
    <BoardHeader
      :board-count="messages.length"
      :wallet-label="walletLabel"
      :network-label="config.chainName"
      :account-label="shortenAddress(account)"
      :connect-label="connectLabel"
      :connect-disabled="walletBusy || (connectLabel === '已连接' && !wrongNetwork)"
      @connect="handleConnect"
      @refresh="loadMessages"
    />

    <!-- 主内容区，两列布局：左边写留言，右边看留言 -->
    <section class="content-grid">

      <!--
        发留言组件
        v-model      → 双向绑定草稿内容，输入框的值和 draft 变量实时同步
        byte-count   → 当前草稿的字节数，组件显示"xx / 100 bytes"
        disabled     → 不满足发帖条件时禁用发布按钮
        posting      → 是否提交中，true 时按钮显示"发布中..."
        helper-text  → 引导提示文字，告诉用户当前需要做什么
        status-text  → 操作结果文字（成功/失败提示）
        status-kind  → 结果类型（'success' / 'error'），决定提示框颜色
        @submit      → 点击发布按钮，触发发帖逻辑
        @clear       → 点击清空按钮，清空草稿
      -->
      <MessageComposer
        v-model="draft"
        :byte-count="countMessageBytes(draft)"
        :disabled="!canPost"
        :posting="posting"
        :helper-text="helperText"
        :status-text="postStatus?.text ?? null"
        :status-kind="postStatus?.kind ?? null"
        @submit="handlePost"
        @clear="draft = ''"
      />

      <!--
        留言列表组件
        messages   → 从链上读到的留言数组
        loading    → 是否加载中，true 时显示"加载中..."
        error-text → 错误提示文字，有错误时显示给用户
      -->
      <MessageFeed
        :messages="messages"
        :loading="loadingMessages"
        :error-text="boardError"
      />

    </section>

  </main>
</template>

<script setup lang="ts">
// 从 Vue 引入需要用到的功能
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
// computed        → 计算属性，依赖的值变了它自动重新计算
// onBeforeUnmount → 组件销毁前的钩子，用来做清理工作
// onMounted       → 组件挂载完成后的钩子，页面加载完自动执行
// ref             → 定义响应式变量，值变化时页面自动更新

// 引入三个子组件
import BoardHeader from './components/BoardHeader.vue'
import MessageComposer from './components/MessageComposer.vue'
import MessageFeed from './components/MessageFeed.vue'

// 从工具库引入所有需要用到的函数和类型
import {
  connectWallet,       // 主动连接钱包（会弹出授权窗口）
  countMessageBytes,   // 计算字符串的字节数
  getErrorText,        // 把报错转成用户能看懂的提示
  getRuntimeConfig,    // 读取 .env 配置
  getWalletInfo,       // 静默获取钱包状态（不弹窗）
  hasWallet,           // 检测是否安装了钱包插件
  postMessage,         // 发布留言到链上
  readMessages,        // 从链上读取所有留言
  shortenAddress,      // 缩短钱包地址显示
  switchToTargetChain, // 切换到目标网络
} from './lib/messageBoard'
import type { MessageItem } from './lib/messageBoard'  // 留言数据的类型定义

// 读取 .env 配置，整个应用共用这一份
const config = getRuntimeConfig()

// ─── 留言相关状态 ─────────────────────────────────────────────────────────────

const messages = ref<MessageItem[]>([])  // 留言列表，初始为空数组
const loadingMessages = ref(false)       // 是否正在加载留言，true 时显示"加载中..."
const boardError = ref<string | null>(config.configError)  // 错误提示，初始值来自配置校验

// ─── 钱包相关状态 ─────────────────────────────────────────────────────────────

const account = ref<string | null>(null)       // 当前钱包地址，null 表示未连接
const walletChainId = ref<number | null>(null) // 钱包当前所在链的 ID，null 表示还不知道
const walletBusy = ref(false)                  // 连接/切换网络进行中，防止用户重复点击

// ─── 发帖相关状态 ─────────────────────────────────────────────────────────────

const draft = ref('')   // 输入框里的草稿内容，和 v-model 双向绑定
const posting = ref(false)  // 是否正在提交留言，true 时按钮显示"发布中..."
const postStatus = ref<{ text: string; kind: 'error' | 'success' } | null>(null)  // 发帖结果提示，null 表示没有提示

// ─── 计算属性 ─────────────────────────────────────────────────────────────────

// 检测浏览器里有没有安装钱包插件
const walletInstalled = computed(() => hasWallet())

// 是否在错误网络：装了钱包 + 知道链ID + 链ID和目标不一致，三个条件同时满足才算
const wrongNetwork = computed(
  () => walletInstalled.value && walletChainId.value !== null && walletChainId.value !== config.chainId,
)

// 顶部栏显示的钱包状态文字，按优先级判断
const walletLabel = computed(() => {
  if (!walletInstalled.value) return '未安装钱包'  // 没装插件
  if (!account.value) return '未连接'              // 装了但没授权
  if (wrongNetwork.value) return '网络错误'        // 连了但网络不对
  return '已连接'                                  // 一切正常
})

// 连接按钮显示的文字，根据状态变化
const connectLabel = computed(() => {
  if (!walletInstalled.value) return '安装钱包'  // 点击后跳转到 MetaMask 下载页
  if (wrongNetwork.value) return '切换网络'      // 点击后自动切换到正确网络
  if (account.value) return '已连接'            // 已经连好了，按钮不需要操作
  return '连接钱包'                              // 点击后弹出授权窗口
})

// 输入框下方的引导提示，告诉用户当前缺什么条件
const helperText = computed(() => {
  if (!config.contractAddress) return config.configError ?? '缺少合约地址。'  // .env 没配好
  if (!walletInstalled.value) return '请先安装钱包。'                         // 没装插件
  if (!account.value) return '请先连接钱包。'                                 // 没授权
  if (wrongNetwork.value) return `请将钱包切换到 ${config.chainName}。`       // 网络不对
  if (!draft.value.trim()) return '请输入一条消息。'                          // 输入框为空
  const bytes = countMessageBytes(draft.value)
  if (bytes > 100) return `消息太长，当前 ${bytes} 字节，最多 100 字节。`     // 超出限制
  return '消息将发送到本地 Hardhat 链。'  // 所有条件满足，可以发了
})

// 是否允许发帖，所有条件都要同时满足
const canPost = computed(
  () =>
    !!config.contractAddress &&            // 合约地址已配置
    walletInstalled.value &&               // 安装了钱包
    !!account.value &&                     // 已连接账户
    !wrongNetwork.value &&                 // 网络正确
    !!draft.value.trim() &&               // 输入框不为空
    countMessageBytes(draft.value) <= 100 &&  // 未超过字节限制
    !posting.value,                        // 没有正在进行中的发帖
)

// ─── 生命周期 ─────────────────────────────────────────────────────────────────

// 页面加载完后立即执行：读留言 + 同步钱包状态 + 绑定钱包事件
// void 表示不等待这些异步操作，让它们在后台跑
onMounted(() => { void loadMessages(); void syncWallet(); bindWalletEvents() })

// 页面销毁前取消钱包事件监听，防止内存泄漏
// ?. 表示 unbindWalletEvents 为 null 时跳过不执行
onBeforeUnmount(() => unbindWalletEvents?.())

// ─── 函数 ─────────────────────────────────────────────────────────────────────

// 从链上读取所有留言，成功后更新列表，失败后显示错误提示
async function loadMessages() {
  if (!config.contractAddress) { boardError.value = config.configError; return }  // 没有合约地址，直接报错
  loadingMessages.value = true   // 开始加载
  boardError.value = null        // 清除上次的错误提示
  try { messages.value = await readMessages(config) }    // 请求成功，更新列表
  catch (e) { boardError.value = getErrorText(e) }      // 请求失败，显示错误
  finally { loadingMessages.value = false }              // 无论成败，关闭加载状态
}

// 查询钱包当前的账户和所在网络，同步到页面状态
async function syncWallet() {
  if (!walletInstalled.value) { account.value = null; walletChainId.value = null; return }  // 没装钱包，直接置空
  const w = await getWalletInfo()  // 静默查询，不弹窗
  account.value = w.address        // 更新账户地址
  walletChainId.value = w.chainId  // 更新链 ID
}

// 点击连接按钮时触发
// 没装钱包 → 打开下载页；网络不对 → 切换网络；未连接 → 弹出授权窗口
async function handleConnect() {
  postStatus.value = null  // 清除之前的发帖提示
  if (!walletInstalled.value) { window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer'); return }
  walletBusy.value = true  // 标记操作进行中，禁用按钮防止重复点击
  try {
    if (wrongNetwork.value) { await switchToTargetChain(config); await syncWallet() }
    // 网络不对：切换后再同步一次钱包状态
    else if (!account.value) { const w = await connectWallet(); account.value = w.address; walletChainId.value = w.chainId }
    // 未连接：授权后直接更新状态
  } catch (e) {
    postStatus.value = { text: getErrorText(e), kind: 'error' }  // 操作失败，显示错误提示
  } finally { walletBusy.value = false }  // 无论成败，解除按钮禁用
}

// 点击发布按钮时触发，把草稿提交到链上
async function handlePost() {
  postStatus.value = null  // 清除上次的提示
  if (!canPost.value) { postStatus.value = { text: helperText.value, kind: 'error' }; return }
  // 条件不满足，把引导提示作为错误信息显示
  posting.value = true  // 标记提交中
  try {
    await postMessage(config, draft.value.trim())  // 发送交易，等待链上确认
    draft.value = ''  // 提交成功，清空输入框
    postStatus.value = { text: '留言发布成功。', kind: 'success' }
    await loadMessages()  // 刷新列表，显示刚发的留言
  } catch (e) {
    postStatus.value = { text: getErrorText(e), kind: 'error' }
    await syncWallet()  // 发帖失败时重新同步钱包，防止账户或网络已悄悄变化
  } finally { posting.value = false }  // 无论成败，关闭提交状态
}

// 监听 MetaMask 的账户切换和网络切换事件，自动同步页面状态
let unbindWalletEvents: (() => void) | null = null  // 存储取消监听的函数
function bindWalletEvents() {
  const p = window.ethereum
  if (!p?.on) return  // 没有钱包或不支持事件监听，直接跳过
  const sync = () => void syncWallet()
  p.on('accountsChanged', sync)  // 用户在 MetaMask 里切换了账户
  p.on('chainChanged', sync)     // 用户在 MetaMask 里切换了网络
  // 把取消监听的逻辑存起来，组件销毁时调用
  unbindWalletEvents = () => { p.removeListener?.('accountsChanged', sync); p.removeListener?.('chainChanged', sync) }
}
</script>

<style scoped>
/* 页面主容器：最大宽度 960px，小屏幕留 24px 边距，水平居中 */
.app-shell {
  width: min(960px, calc(100vw - 24px));
  margin: 0 auto;
  padding: 24px 0 40px;
}

/* 主内容区：两列等宽布局，间距 16px */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

/* 小屏幕（宽度小于 820px）改为单列布局 */
@media (max-width: 820px) {
  .content-grid { grid-template-columns: 1fr; }
}
</style>
