<template>
  <!-- 整个顶部面板容器 -->
  <section class="panel">
    <p class="eyebrow">留言板</p>
    <h1>本地演示</h1>

    <!-- 四格信息展示：留言数、钱包状态、网络名称、账户地址 -->
    <div class="meta-grid">
      <div><span>留言数</span><strong>{{ boardCount }}</strong></div>
      <div><span>钱包</span><strong>{{ walletLabel }}</strong></div>
      <div><span>网络</span><strong>{{ networkLabel }}</strong></div>
      <div><span>账户</span><strong>{{ accountLabel }}</strong></div>
    </div>

    <!--
      操作按钮区
      连接按钮：显示 connectLabel 的文字，connectDisabled 为 true 时禁用，点击后向父组件发出 connect 事件
      刷新按钮：点击后向父组件发出 refresh 事件，由父组件重新读取留言
    -->
    <div class="actions">
      <button :disabled="connectDisabled" @click="$emit('connect')">{{ connectLabel }}</button>
      <button class="secondary" @click="$emit('refresh')">刷新</button>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
  接收来自 App.vue 的 props：
  boardCount      → 留言总数
  walletLabel     → 钱包状态文字（"已连接" / "未连接" / "网络错误" 等）
  networkLabel    → 当前网络名称
  accountLabel    → 缩短后的钱包地址
  connectLabel    → 连接按钮的文字
  connectDisabled → 按钮是否禁用

  向 App.vue 发出的事件：
  connect → 用户点击连接按钮
  refresh → 用户点击刷新按钮
*/
defineProps<{
  boardCount: number
  walletLabel: string
  networkLabel: string
  accountLabel: string
  connectLabel: string
  connectDisabled: boolean
}>()

defineEmits<{ connect: []; refresh: [] }>()
</script>

<style scoped>
h1 { margin: 0; font-size: 32px; }

/* 两列网格，每格显示一项状态信息 */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.meta-grid div { border: 1px solid #e3e7ed; border-radius: 8px; padding: 12px; }
.meta-grid span { display: block; font-size: 12px; color: #5e6b78; }           /* 标签文字（小字） */
.meta-grid strong { display: block; margin-top: 4px; overflow-wrap: anywhere; } /* 值（粗体，长地址自动换行） */

/* 小屏幕改为单列 */
@media (max-width: 640px) {
  .meta-grid { grid-template-columns: 1fr; }
}
</style>
