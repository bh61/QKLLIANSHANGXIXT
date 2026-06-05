<template>
  <!-- 整个发帖面板容器 -->
  <section class="panel">

    <!-- 标题行：左边标题，右边显示当前字节数 / 上限 -->
    <div class="heading">
      <div><p class="eyebrow">发布</p><h2>留下一条消息</h2></div>
      <span class="byte-badge">{{ byteCount }} / 100 bytes</span>
    </div>

    <!--
      输入框区域
      :value   → 显示当前草稿内容（由父组件通过 v-model 传入）
      @input   → 每次输入时把最新内容通过 update:modelValue 事件发给父组件，实现双向绑定
      $event.target as HTMLTextAreaElement → 从原生输入事件里拿到输入框元素，再取它的 value
    -->
    <label class="field">
      <span>消息内容</span>
      <textarea
        :value="modelValue"
        rows="6"
        placeholder="写一条简短的留言。"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <!-- 引导提示文字，告诉用户当前需要做什么（来自父组件的 helperText） -->
    <p class="helper">{{ helperText }}</p>

    <!--
      操作按钮区
      发布按钮：disabled 为 true 时禁用；posting 为 true 时显示"发布中..."；点击发出 submit 事件
      清空按钮：提交进行中时禁用，防止误操作；点击发出 clear 事件清空输入框
    -->
    <div class="actions">
      <button :disabled="disabled" @click="$emit('submit')">{{ posting ? '发布中...' : '发布' }}</button>
      <button class="secondary" :disabled="posting" @click="$emit('clear')">清空</button>
    </div>

    <!--
      操作结果提示，只有 statusText 有内容时才显示
      :class="statusKind" → 绑定 'error' 或 'success' 类名，控制提示框颜色
    -->
    <p v-if="statusText" class="status" :class="statusKind">{{ statusText }}</p>

  </section>
</template>

<script setup lang="ts">
/*
  接收来自 App.vue 的 props：
  modelValue  → 输入框的当前值，配合 update:modelValue 事件实现 v-model
  byteCount   → 当前内容的字节数，显示在右上角计数器
  disabled    → 发布按钮是否禁用
  posting     → 是否正在提交，控制按钮文字和清空按钮的禁用状态
  helperText  → 输入框下方的引导提示
  statusText  → 操作结果文字，null 时不显示提示框
  statusKind  → 提示框类型，'success' 显示绿色，'error' 显示红色

  向 App.vue 发出的事件：
  update:modelValue → 输入框内容变化时触发，传出最新值（v-model 机制）
  submit            → 用户点击发布按钮
  clear             → 用户点击清空按钮
*/
defineProps<{
  modelValue: string
  byteCount: number
  disabled: boolean
  posting: boolean
  helperText: string
  statusText: string | null
  statusKind: 'error' | 'success' | null
}>()

defineEmits<{ 'update:modelValue': [value: string]; submit: []; clear: [] }>()
</script>

<style scoped>
h2 { margin: 0; font-size: 24px; }

/* 标题行：标题和字节计数左右分布 */
.heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }

/* 字节计数徽标，圆角胶囊样式 */
.byte-badge {
  font-size: 13px;
  color: #4f6b85;
  border: 1px solid #dde4eb;
  border-radius: 999px;
  padding: 6px 10px;
}

.field { display: grid; gap: 8px; margin-top: 18px; }
.field span { font-weight: 600; }  /* "消息内容" 标签加粗 */

/* 输入框：撑满宽度，允许纵向拖拽调整高度 */
textarea {
  width: 100%;
  min-height: 170px;
  border: 1px solid #cad2db;
  border-radius: 8px;
  padding: 12px;
  resize: vertical;
}

.helper { margin: 12px 0 0; color: #5e6b78; }  /* 引导提示，灰色小字 */

/* 操作结果提示框 */
.status { margin: 14px 0 0; padding: 10px 12px; border-radius: 8px; border: 1px solid transparent; }
.status.error { background: #fff1f1; border-color: #f2c9c9; color: #8b2727; }    /* 失败：红色 */
.status.success { background: #eefaf4; border-color: #c7e9d2; color: #226245; }  /* 成功：绿色 */

/* 小屏幕标题行改为竖排 */
@media (max-width: 640px) {
  .heading { flex-direction: column; }
}
</style>
