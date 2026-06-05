// Br是把metamask包装成ethers能用的格式
// Co用来和智能合约交互
// Js直接连接本地的节点（不需要钱包）
// get直接把地址格式标准化（统一大小写）
// is检查一个字符串是不是合法的以太坊地址
// to把字符串转成字节数组，用于计算字节长度
import {
    BrowserProvider,
    Contract,
    JsonRpcProvider,
    getAddress,
    isAddress,
    toUtf8Bytes,
} from "ethers";

// 类型定义++++++++++++++++++++++++++++++++++++
// 一条留言的数据结构
export type MessageItem = {
    index: number; // 这条留言在合约数组里的位置
    author: string; // 发帖人的钱包地址，是谁
    content: string; // 留言内容
    createdAt: number; // 创建时间,发布时间
};

// 前端运行时需要的配置项
export type RuntimeConfig = {
    rpcUrl: string; // 本地节点的地址，前端通过它读取链上数据
    chainId: number; // 链的ID，用来判断钱包是否在正确的网络
    chainName: string; // 链的名字，用来给用户看
    contractAddress: string | null; // 合约地址，用来和合约交互，null表示没有配置
    configError: string | null; // 配置错误信息的提示语，null表示没有错误
};

// 常量++++++++++++++++++++++++++++++++++++++++
const DEFAULT_RPC_URL = "http://127.0.0.1:8545"; // hardhat 本地节点默认地址
const DEFAULT_CHAIN_ID = 31337; // hardhat 本地链默认id
const DEFAULT_CHAIN_NAME = "Hardhat Local"; // 本地网络的名称

// 合约abi: 告诉ethers这个合约有哪些函数可以调用，只需列出前端用的
const ABI = [
  "function postMessage(string content)", // 发布留言
  "function getMessageCount() view returns (uint256)", // 获取留言总数
  "function getMessage(uint256 index) view returns (address author, string content, uint256 createdAt)", // 按索引获取一条留言
] as const;

// 内部工具++++++++++++++++++++++++++++++++++++++
// 获取浏览器里的钱包对象(window.ethereum就是metamask注入的)
// as any是告诉ts不用检查这个对象
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEth = () => window.ethereum as any;