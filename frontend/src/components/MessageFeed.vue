<template>
  <!-- 整个留言列表面板容器 -->
  <section class="panel">
    <p class="eyebrow">消息流</p>
    <h2>留言列表</h2>

    <!--
      四种状态互斥显示（v-if / v-else-if / v-else）：
      1. loading 为 true       → 显示"加载中..."
      2. errorText 有内容      → 显示错误提示
      3. messages 为空数组     → 显示"暂无留言"
      4. 以上都不满足          → 显示留言列表
    -->
    <p v-if="loading" class="state">加载中...</p>
    <p v-else-if="errorText" class="state error">{{ errorText }}</p>
    <p v-else-if="messages.length === 0" class="state">暂无留言。</p>

    <!--
      留言列表
      v-for       → 遍历 messages 数组，每条留言渲染一个 li
      :key        → 用留言索引作为唯一标识，帮助 Vue 精准更新 DOM
      shortenAddress → 把完整钱包地址缩短显示，比如"0x1234...5678"
      formatTime     → 把时间戳（秒）转成可读的日期时间字符串
    -->
    <ol v-else class="list">
      <li v-for="msg in messages" :key="msg.index">
        <div class="meta">
          <strong>{{ shortenAddress(msg.author) }}</strong>
          <span>{{ formatTime(msg.createdAt) }}</span>
        </div>
        <p>{{ msg.content }}</p>
      </li>
    </ol>

  </section>
</template>

<script setup lang="ts">
// 引入工具函数：缩短地址、格式化时间
import { formatTime, shortenAddress } from '../lib/messageBoard'
// 引入留言数据的类型定义
import type { MessageItem } from '../lib/messageBoard'

/*
  接收来自 App.vue 的 props：
  messages  → 留言数组，每项包含 index / author / content / createdAt
  loading   → 是否正在加载，true 时显示"加载中..."
  errorText → 错误提示文字，null 表示没有错误
*/
defineProps<{ messages: MessageItem[]; loading: boolean; errorText: string | null }>()
</script>

<style scoped>
h2 { margin: 0; font-size: 24px; }

.state { margin: 18px 0 0; color: #5e6b78; }       /* 状态提示文字，灰色 */
.state.error { color: #8b2727; }                    /* 错误提示，红色 */

.list { list-style: none; padding: 0; margin: 18px 0 0; }
/* 相邻两条留言之间加分隔线 */
.list li + li { border-top: 1px solid #e5e9ee; margin-top: 14px; padding-top: 14px; }

/* 每条留言的头部：作者地址左对齐，时间右对齐 */
.meta { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.meta span { color: #5e6b78; font-size: 14px; }    /* 时间，灰色小字 */
.list p { margin: 8px 0 0; overflow-wrap: anywhere; } /* 留言内容，长单词自动换行 */

/* 小屏幕作者和时间改为竖排 */
@media (max-width: 640px) {
  .meta { flex-direction: column; }
}
</style>
