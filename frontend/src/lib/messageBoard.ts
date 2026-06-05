// 从 ethers 库里引入需要用到的工具：
// BrowserProvider   把 MetaMask 包装成 ethers 能用的格式
// Contract          用来和智能合约交互
// JsonRpcProvider   直接连接本地节点（不需要钱包）
// getAddress        把地址格式标准化（统一大小写）
// isAddress         检查一个字符串是不是合法的以太坊地址
// toUtf8Bytes       把字符串转成字节数组，用于计算字节长度
import { BrowserProvider, Contract, JsonRpcProvider, getAddress, isAddress, toUtf8Bytes } from 'ethers'

// ─── 类型定义 ────────────────────────────────────────────────────────────────

// 一条留言的数据结构
export type MessageItem = {
  index: number    // 这条留言在合约数组里的位置（第几条）
  author: string   // 发帖人的钱包地址
  content: string  // 留言内容
  createdAt: number // 发布时间（Unix 时间戳，单位：秒）
}

// 前端运行时需要的配置项
export type RuntimeConfig = {
  rpcUrl: string              // 本地节点的地址，前端通过它读取链上数据
  chainId: number             // 链的 ID，用来判断钱包是否在正确的网络
  chainName: string           // 链的名称，显示给用户看
  contractAddress: string | null  // 合约地址，null 表示还没配置
  configError: string | null  // 配置出错时的提示语，null 表示配置正常
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

const DEFAULT_RPC_URL = 'http://127.0.0.1:8545'  // Hardhat 本地节点默认地址
const DEFAULT_CHAIN_ID = 31337                    // Hardhat 本地链默认 ID
const DEFAULT_CHAIN_NAME = 'Hardhat Local'        // 显示给用户的链名称

// 合约 ABI：告诉 ethers 这个合约有哪些函数可以调用，只需列出前端用到的
const ABI = [
  'function postMessage(string content)',           // 发布留言
  'function getMessageCount() view returns (uint256)',  // 获取留言总数
  'function getMessage(uint256 index) view returns (address author, string content, uint256 createdAt)', // 按索引获取一条留言
] as const

// ─── 内部工具 ────────────────────────────────────────────────────────────────

// 获取浏览器里的钱包对象（window.ethereum 就是 MetaMask 注入的），
// as any 是告诉 TypeScript 不用检查这个对象的类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEth = () => window.ethereum as any

// 检查钱包是否安装，没安装就直接抛出错误，避免后面每个函数都重复写这个判断
function requireWallet() {
  if (!hasWallet()) throw new Error('请先安装 MetaMask 或其他钱包插件。')
}

// 获取钱包账户和所在网络，connect=false 时静默查询，connect=true 时弹出授权窗口
async function fetchWallet(connect = false) {
  const eth = getEth()  // 拿到钱包对象

  // request 是钱包提供的通用方法，传不同的 method 做不同的事情：
  // eth_accounts        → 静默获取已授权的账户列表（不弹窗）
  // eth_requestAccounts → 请求授权，会弹出 MetaMask 确认窗口
  const accounts = await eth.request({ method: connect ? 'eth_requestAccounts' : 'eth_accounts' }) as string[]

  // 获取当前钱包所在链的 ID，返回的是十六进制字符串，比如 "0x7a69"
  const chainIdHex = await eth.request({ method: 'eth_chainId' }) as string

  return {
    address: accounts[0] ? getAddress(accounts[0]) : null, // 取第一个账户，没账户就返回 null
    chainId: parseInt(chainIdHex, 16),  // 把十六进制转成十进制数字，比如 "0x7a69" → 31337
  }
}

// ─── 配置 ────────────────────────────────────────────────────────────────────

// 从 .env 文件读取配置，校验合约地址，返回一个配置对象给整个前端使用
export function getRuntimeConfig(): RuntimeConfig {
  // import.meta.env 是 Vite 读取 .env 文件的方式，?.trim() 去掉前后空格
  const rpcUrl = import.meta.env.VITE_RPC_URL?.trim() || DEFAULT_RPC_URL
  // || DEFAULT_CHAIN_ID 处理解析失败（NaN）的情况
  const chainId = Number.parseInt(import.meta.env.VITE_CHAIN_ID ?? '', 10) || DEFAULT_CHAIN_ID
  const raw = import.meta.env.VITE_MESSAGE_BOARD_ADDRESS?.trim()  // 原始合约地址字符串

  // 把三个公共字段提出来，避免下面重复写
  const base = { rpcUrl, chainId, chainName: DEFAULT_CHAIN_NAME }

  // 没填合约地址
  if (!raw) return { ...base, contractAddress: null, configError: '请先配置 VITE_MESSAGE_BOARD_ADDRESS。' }
  // 填了但格式不对
  if (!isAddress(raw)) return { ...base, contractAddress: null, configError: 'VITE_MESSAGE_BOARD_ADDRESS 不是有效的合约地址。' }
  // 一切正常，getAddress 把地址转成标准的 checksum 格式
  return { ...base, contractAddress: getAddress(raw), configError: null }
}

// ─── 钱包 ────────────────────────────────────────────────────────────────────

// 检测浏览器里有没有安装钱包插件，window.ethereum 是 MetaMask 注入的全局对象
export const hasWallet = () => typeof window !== 'undefined' && !!window.ethereum

// 静默获取当前钱包信息，页面加载时用来同步状态，不会打扰用户
export async function getWalletInfo() {
  if (!hasWallet()) return { address: null, chainId: null }  // 没钱包直接返回空
  return fetchWallet()  // connect=false，静默查询
}

// 主动连接钱包，点击"连接钱包"按钮时调用，会弹出 MetaMask 授权窗口
export async function connectWallet() {
  requireWallet()        // 没装钱包直接报错
  return fetchWallet(true)  // connect=true，弹窗请求授权
}

// 切换钱包到指定网络，钱包在错误网络时调用
export async function switchToTargetChain(config: RuntimeConfig) {
  requireWallet()  // 没装钱包直接报错

  // 把链 ID 转成十六进制，这是钱包 API 要求的格式，比如 31337 → "0x7a69"
  const chainIdHex = `0x${config.chainId.toString(16)}`

  try {
    // 尝试切换到目标链
    await getEth().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] })
  } catch (e: any) {
    // 错误码 4902 表示钱包里根本没有这条链，需要先添加再切换
    if (e.code !== 4902) throw e  // 其他错误直接往上抛

    // 往钱包里添加这条链的信息
    await getEth().request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainIdHex,
        chainName: config.chainName,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },  // 链的原生代币信息
        rpcUrls: [config.rpcUrl],  // 节点地址，钱包通过它连接这条链
      }],
    })
  }
}

// ─── 合约读写 ────────────────────────────────────────────────────────────────

// 读取链上所有留言，按倒序返回（最新的排在前面）
export async function readMessages(config: RuntimeConfig): Promise<MessageItem[]> {
  // JsonRpcProvider 直接连本地节点，读数据不需要钱包
  const contract = new Contract(config.contractAddress!, ABI, new JsonRpcProvider(config.rpcUrl))

  // 先查总数，知道要读几条
  const total = Number(await contract.getMessageCount())
  if (total === 0) return []  // 没有留言直接返回空数组

  // 生成 [0,1,2,...,total-1] 再反转成 [total-1,...,1,0]，实现倒序读取
  return Promise.all(
    [...Array(total).keys()].reverse().map(async (index) => {
      // 按索引逐条读取，合约返回三个值
      const [author, content, createdAt] = await contract.getMessage(index)
      return {
        index,
        author: getAddress(author),    // 标准化地址格式
        content,
        createdAt: Number(createdAt),  // 合约返回 BigInt，转成普通数字
      }
    }),
  )
}

// 发布留言到链上，需要钱包签名，会消耗 gas
export async function postMessage(config: RuntimeConfig, content: string): Promise<void> {
  requireWallet()  // 没装钱包直接报错

  // BrowserProvider 把 MetaMask 包装成 ethers 能用的 provider
  const provider = new BrowserProvider(getEth())

  // 再次确认钱包当前所在的链，防止用户在调用过程中偷偷切了网络
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== config.chainId) throw new Error(`请将钱包切换到 ${config.chainName}。`)

  // getSigner 拿到当前账户的签名器，写操作必须有它
  const signer = await provider.getSigner()

  // 发送交易，MetaMask 会弹窗让用户确认
  const tx = await new Contract(config.contractAddress!, ABI, signer).postMessage(content)

  // 等待交易被矿工打包进区块，完成后才算真正上链
  await tx.wait()
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

// 计算字符串的 UTF-8 字节数，中文一个字占 3 字节，合约限制最多 100 字节
export const countMessageBytes = (value: string) => toUtf8Bytes(value.trim()).length

// 缩短钱包地址显示，比如 0x1234567890abcdef → 0x1234...cdef
export const shortenAddress = (value: string | null) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '未连接'

// 把 Unix 时间戳（秒）格式化成本地时间字符串，比如 "2024年4月17日 14:30"
export const formatTime = (timestamp: number) =>
  // timestamp * 1000 是因为 JS 的 Date 用毫秒，合约存的是秒
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp * 1000))

// 把各种奇怪的钱包/合约报错转成用户能看懂的中文提示
export function getErrorText(error: unknown): string {
  const e = error as any

  // 错误码 4001 或 ACTION_REJECTED 表示用户在钱包里点了"拒绝"
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED') return '你取消了钱包请求。'

  // 把所有可能包含错误描述的字段拼在一起，统一转小写方便匹配关键词
  const text = [e?.shortMessage, e?.info?.error?.message, e?.message].filter(Boolean).join(' ').toLowerCase()

  if (text.includes('failed to fetch') || text.includes('network error')) return '本地 Hardhat RPC 无法连接。'
  if (text.includes('insufficient funds')) return '当前钱包在本地链上没有足够的测试 ETH。'

  // 以上都不匹配，按优先级取第一个有内容的错误信息返回
  return e?.shortMessage ?? e?.info?.error?.message ?? e?.message ?? '发生了未知错误。'
}
